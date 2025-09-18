import type { SupabaseClient } from '@supabase/supabase-js'

interface PermissionSchemaConfig {
  pageTable: string
  pagePathColumn: string
  mappingTable: string
  userIdColumn: string
  pageIdColumn: string
  roleTable?: string
  roleIdColumn?: string
  userRoleTable?: string
  userRoleUserIdColumn?: string
  userRoleRoleIdColumn?: string
}

let cachedSchema: PermissionSchemaConfig | null = null

export async function detectPermissionSchema(supabase: SupabaseClient): Promise<PermissionSchemaConfig> {
  // Return cached schema if available
  if (cachedSchema) {
    return cachedSchema
  }

  try {
    console.log('Detecting permission schema...')

    // Query information_schema to find tables with permission-related names
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .in('table_schema', ['public'])
      .or('table_name.ilike.%page%,table_name.ilike.%route%,table_name.ilike.%perm%,table_name.ilike.%access%,table_name.ilike.%role%')

    if (tablesError) {
      console.error('Error querying tables:', tablesError)
      throw new Error('Failed to detect permission tables')
    }

    const tableNames = tables?.map(t => t.table_name) || []
    console.log('Found candidate tables:', tableNames)

    // Find page table (likely contains path column)
    let pageTable = ''
    let pagePathColumn = ''

    for (const tableName of tableNames) {
      const { data: columns, error: columnsError } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', tableName)
        .in('table_schema', ['public'])

      if (columnsError) continue

      const columnNames = columns?.map(c => c.column_name) || []
      
      // Look for path column in page-related tables
      if (columnNames.includes('path') && (tableName.includes('page') || tableName.includes('route'))) {
        pageTable = tableName
        pagePathColumn = 'path'
        break
      }
    }

    if (!pageTable) {
      throw new Error('Could not detect page table with path column')
    }

    console.log(`Detected page table: ${pageTable} with path column: ${pagePathColumn}`)

    // Find mapping table (user to page or user to role)
    let mappingTable = ''
    let userIdColumn = ''
    let pageIdColumn = ''
    let roleTable = ''
    let roleIdColumn = ''
    let userRoleTable = ''
    let userRoleUserIdColumn = ''
    let userRoleRoleIdColumn = ''

    for (const tableName of tableNames) {
      const { data: columns, error: columnsError } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', tableName)
        .in('table_schema', ['public'])

      if (columnsError) continue

      const columnNames = columns?.map(c => c.column_name) || []
      
      // Check if this is a user-page mapping table
      if (columnNames.includes('user_id') && columnNames.includes('page_id')) {
        mappingTable = tableName
        userIdColumn = 'user_id'
        pageIdColumn = 'page_id'
        break
      }
      
      // Check if this is a user-role mapping table
      if (columnNames.includes('user_id') && columnNames.includes('role_id')) {
        userRoleTable = tableName
        userRoleUserIdColumn = 'user_id'
        userRoleRoleIdColumn = 'role_id'
        
        // Look for role table
        for (const roleTableName of tableNames) {
          if (roleTableName.includes('role') && roleTableName !== tableName) {
            const { data: roleColumns, error: roleColumnsError } = await supabase
              .from('information_schema.columns')
              .select('column_name')
              .eq('table_name', roleTableName)
              .in('table_schema', ['public'])

            if (roleColumnsError) continue

            const roleColumnNames = roleColumns?.map(c => c.column_name) || []
            
            if (roleColumnNames.includes('id') && roleColumnNames.includes('page_id')) {
              roleTable = roleTableName
              roleIdColumn = 'id'
              pageIdColumn = 'page_id'
              break
            }
          }
        }
        break
      }
    }

    if (!mappingTable && !userRoleTable) {
      throw new Error('Could not detect user-page or user-role mapping table')
    }

    console.log(`Detected mapping table: ${mappingTable || userRoleTable}`)
    if (userRoleTable) {
      console.log(`Detected role table: ${roleTable}`)
    }

    // Create the configuration
    const config: PermissionSchemaConfig = {
      pageTable,
      pagePathColumn,
      mappingTable: mappingTable || userRoleTable,
      userIdColumn: userIdColumn || userRoleUserIdColumn,
      pageIdColumn,
      ...(roleTable && {
        roleTable,
        roleIdColumn,
        userRoleTable,
        userRoleUserIdColumn,
        userRoleRoleIdColumn
      })
    }

    // Cache the configuration
    cachedSchema = Object.freeze(config)
    
    console.log('Permission schema detected:', config)
    return config

  } catch (error) {
    console.error('Error detecting permission schema:', error)
    throw error
  }
}

export function getCachedSchema(): PermissionSchemaConfig | null {
  return cachedSchema
}

export function clearSchemaCache(): void {
  cachedSchema = null
}
