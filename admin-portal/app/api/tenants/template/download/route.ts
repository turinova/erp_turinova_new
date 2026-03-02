import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET() {
  try {
    // Read the template file from the database-templates directory
    const templatePath = join(process.cwd(), 'database-templates', 'tenant-database-template.sql')
    const templateContent = await readFile(templatePath, 'utf-8')

    // Return as downloadable file
    return new NextResponse(templateContent, {
      headers: {
        'Content-Type': 'application/sql',
        'Content-Disposition': 'attachment; filename="tenant-database-template.sql"',
        'Cache-Control': 'no-cache'
      }
    })
  } catch (error) {
    console.error('[Admin] Error serving template:', error)
    return NextResponse.json(
      { error: 'Failed to load template file' },
      { status: 500 }
    )
  }
}
