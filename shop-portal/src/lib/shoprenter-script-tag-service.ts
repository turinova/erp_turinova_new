// ShopRenter Script Tag API Service
// Manages script tags for injecting enhanced structured data

export interface ScriptTag {
  id?: string
  src: string
  event?: 'ONLOAD'
  displayScope?: 'FRONTEND' | 'THANK_YOU_PAGE' | 'ALL'
  displayArea?: 'HEADER' | 'BODY'
  dateCreated?: string
  dateUpdated?: string
}

export interface ShopRenterConnection {
  id: string
  api_url: string
  auth_header: string
  shop_name: string
}

/**
 * Get existing script tags for a connection
 */
export async function getScriptTags(connection: ShopRenterConnection): Promise<ScriptTag[]> {
  try {
    const apiBaseUrl = connection.api_url
    const authHeader = connection.auth_header

    const response = await fetch(`${apiBaseUrl}/scriptTags`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch script tags: ${response.status}`)
    }

    const data = await response.json()
    
    // ShopRenter returns items in a collection format
    if (data.items && Array.isArray(data.items)) {
      return data.items.map((item: any) => ({
        id: item.id,
        src: item.src,
        event: item.event || 'ONLOAD',
        displayScope: item.displayScope || 'ALL',
        displayArea: item.displayArea || 'HEADER',
        dateCreated: item.dateCreated,
        dateUpdated: item.dateUpdated
      }))
    }

    return []
  } catch (error) {
    console.error('[Script Tag] Error fetching script tags:', error)
    throw error
  }
}

/**
 * Find existing structured data script tag
 */
export async function findStructuredDataScriptTag(
  connection: ShopRenterConnection,
  scriptUrl: string
): Promise<ScriptTag | null> {
  try {
    const scriptTags = await getScriptTags(connection)
    
    // Look for script tag with matching URL
    const existing = scriptTags.find(tag => 
      tag.src.includes('shoprenter-structured-data.js') ||
      tag.src === scriptUrl
    )

    return existing || null
  } catch (error) {
    console.error('[Script Tag] Error finding script tag:', error)
    return null
  }
}

/**
 * Create a new script tag
 */
export async function createScriptTag(
  connection: ShopRenterConnection,
  scriptUrl: string
): Promise<ScriptTag> {
  try {
    const apiBaseUrl = connection.api_url
    const authHeader = connection.auth_header

    const scriptTag: ScriptTag = {
      src: scriptUrl,
      event: 'ONLOAD',
      displayScope: 'FRONTEND', // Only on frontend pages (includes product pages)
      displayArea: 'HEADER' // Inject in header for early execution
    }

    const response = await fetch(`${apiBaseUrl}/scriptTags`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(scriptTag)
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`Failed to create script tag: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    
    return {
      id: data.id,
      src: data.src,
      event: data.event || 'ONLOAD',
      displayScope: data.displayScope || 'FRONTEND',
      displayArea: data.displayArea || 'HEADER',
      dateCreated: data.dateCreated,
      dateUpdated: data.dateUpdated
    }
  } catch (error) {
    console.error('[Script Tag] Error creating script tag:', error)
    throw error
  }
}

/**
 * Update an existing script tag
 */
export async function updateScriptTag(
  connection: ShopRenterConnection,
  scriptTagId: string,
  scriptUrl: string
): Promise<ScriptTag> {
  try {
    const apiBaseUrl = connection.api_url
    const authHeader = connection.auth_header

    const scriptTag: ScriptTag = {
      src: scriptUrl,
      event: 'ONLOAD',
      displayScope: 'FRONTEND',
      displayArea: 'HEADER'
    }

    const response = await fetch(`${apiBaseUrl}/scriptTags/${scriptTagId}`, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(scriptTag)
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`Failed to update script tag: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    
    return {
      id: data.id,
      src: data.src,
      event: data.event || 'ONLOAD',
      displayScope: data.displayScope || 'FRONTEND',
      displayArea: data.displayArea || 'HEADER',
      dateCreated: data.dateCreated,
      dateUpdated: data.dateUpdated
    }
  } catch (error) {
    console.error('[Script Tag] Error updating script tag:', error)
    throw error
  }
}

/**
 * Delete a script tag
 */
export async function deleteScriptTag(
  connection: ShopRenterConnection,
  scriptTagId: string
): Promise<void> {
  try {
    const apiBaseUrl = connection.api_url
    const authHeader = connection.auth_header

    const response = await fetch(`${apiBaseUrl}/scriptTags/${scriptTagId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader
      }
    })

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`Failed to delete script tag: ${response.status} - ${errorText}`)
    }
  } catch (error) {
    console.error('[Script Tag] Error deleting script tag:', error)
    throw error
  }
}

/**
 * Ensure structured data script tag exists (create or update)
 */
export async function ensureStructuredDataScriptTag(
  connection: ShopRenterConnection,
  scriptUrl: string
): Promise<ScriptTag> {
  try {
    // Check if script tag already exists
    const existing = await findStructuredDataScriptTag(connection, scriptUrl)

    if (existing && existing.id) {
      // Update existing script tag
      return await updateScriptTag(connection, existing.id, scriptUrl)
    } else {
      // Create new script tag
      return await createScriptTag(connection, scriptUrl)
    }
  } catch (error) {
    console.error('[Script Tag] Error ensuring script tag:', error)
    throw error
  }
}
