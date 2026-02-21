import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getConnectionById } from '@/lib/connections-server'
import { getShopRenterAuthHeader, extractShopNameFromUrl } from '@/lib/shoprenter-api'

/**
 * GET /api/categories/[id]/url-alias
 * Get current URL alias for a category
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get category
    const { data: category, error: categoryError } = await supabase
      .from('shoprenter_categories')
      .select('id, connection_id, url_slug, url_alias_id, category_url')
      .eq('id', id)
      .single()

    if (categoryError || !category) {
      return NextResponse.json(
        { success: false, error: 'Kategória nem található' },
        { status: 404 }
      )
    }

    // Get connection for API access
    const connection = await getConnectionById(category.connection_id)
    if (!connection) {
      return NextResponse.json(
        { success: false, error: 'Kapcsolat nem található' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        urlSlug: category.url_slug || '',
        urlAliasId: category.url_alias_id || null,
        categoryUrl: category.category_url || null
      }
    })
  } catch (error: any) {
    console.error('Error fetching URL alias:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Hiba történt' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/categories/[id]/url-alias
 * Update URL alias for a category
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { urlSlug } = body

    if (!urlSlug || typeof urlSlug !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL slug megadása kötelező' },
        { status: 400 }
      )
    }

    // Sanitize slug
    const sanitizedSlug = urlSlug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')  // Replace non-alphanumeric with hyphens
      .replace(/-+/g, '-')          // Replace multiple hyphens with single
      .replace(/^-|-$/g, '')        // Remove leading/trailing hyphens

    if (!sanitizedSlug) {
      return NextResponse.json(
        { success: false, error: 'Érvénytelen URL slug' },
        { status: 400 }
      )
    }

    // Get category
    const { data: category, error: categoryError } = await supabase
      .from('shoprenter_categories')
      .select('id, connection_id, url_alias_id, shoprenter_id')
      .eq('id', id)
      .single()

    if (categoryError || !category) {
      return NextResponse.json(
        { success: false, error: 'Kategória nem található' },
        { status: 404 }
      )
    }

    // Get connection
    const connection = await getConnectionById(category.connection_id)
    if (!connection) {
      return NextResponse.json(
        { success: false, error: 'Kapcsolat nem található' },
        { status: 404 }
      )
    }

    // Extract shop name from API URL
    const shopName = extractShopNameFromUrl(connection.api_url)
    if (!shopName) {
      return NextResponse.json(
        { success: false, error: 'Érvénytelen API URL' },
        { status: 400 }
      )
    }

    // Get ShopRenter auth header (handles OAuth and Basic auth)
    const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
      shopName,
      connection.username || '',
      connection.password || '',
      connection.api_url
    )

    // Update via ShopRenter API
    const apiUrl = `${apiBaseUrl}/urlAliases`
    let urlAliasId = category.url_alias_id

    // If no existing alias ID, check if category already has a URL alias via categoryExtend
    if (!urlAliasId) {
      try {
        // First, try to get the category's URL alias from categoryExtend
        const categoryExtendResponse = await fetch(`${apiBaseUrl}/categoryExtend/${category.shoprenter_id}`, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json'
          }
        })

        if (categoryExtendResponse.ok) {
          const categoryExtend = await categoryExtendResponse.json()
          if (categoryExtend.urlAliases && categoryExtend.urlAliases.id) {
            urlAliasId = categoryExtend.urlAliases.id
            console.log('Found existing URL alias from categoryExtend:', urlAliasId)
          }
        }
      } catch (e) {
        console.warn('Could not fetch categoryExtend to check for existing URL alias:', e)
        // Continue with creation if check fails
      }
    }

    // If still no alias ID, create a new one
    if (!urlAliasId) {
      // Create new URL alias
      const createResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          type: 'CATEGORY',
          urlAlias: sanitizedSlug,
          urlAliasEntity: {
            id: category.shoprenter_id
          }
        })
      })

      if (!createResponse.ok) {
        let errorText = ''
        let errorJson = null
        try {
          errorText = await createResponse.text()
          try {
            errorJson = JSON.parse(errorText)
          } catch {
            // Not JSON, use text as is
          }
        } catch (e) {
          errorText = 'Unknown error'
        }
        
        console.error('Failed to create URL alias:', {
          status: createResponse.status,
          statusText: createResponse.statusText,
          errorText,
          errorJson,
          requestBody: {
            type: 'CATEGORY',
            urlAlias: sanitizedSlug,
            urlAliasEntity: { id: category.shoprenter_id }
          }
        })
        
        // If 409 Conflict, ShopRenter returns the existing alias ID in the error response!
        if (createResponse.status === 409) {
          if (errorJson?.id) {
            urlAliasId = errorJson.id
            console.log('URL alias already exists, using existing ID from 409 response:', urlAliasId)
            
            // Verify it's for the correct category by fetching the alias details
            try {
              const verifyResponse = await fetch(`${apiUrl}/${urlAliasId}`, {
                method: 'GET',
                headers: {
                  'Authorization': authHeader,
                  'Accept': 'application/json'
                }
              })
              
              if (verifyResponse.ok) {
                const aliasData = await verifyResponse.json()
                const aliasResponse = aliasData.response || aliasData
                
                // Extract category ID from urlAliasEntity
                let aliasCategoryId = null
                if (aliasResponse.urlAliasEntity) {
                  if (typeof aliasResponse.urlAliasEntity === 'string') {
                    const match = aliasResponse.urlAliasEntity.match(/\/categories\/([^\/]+)/)
                    aliasCategoryId = match ? match[1] : null
                  } else if (aliasResponse.urlAliasEntity.id) {
                    aliasCategoryId = aliasResponse.urlAliasEntity.id
                  } else if (aliasResponse.urlAliasEntity.href) {
                    const match = aliasResponse.urlAliasEntity.href.match(/\/categories\/([^\/]+)/)
                    aliasCategoryId = match ? match[1] : null
                  }
                }
                
                // If it's for a different category, return error
                if (aliasCategoryId && aliasCategoryId !== category.shoprenter_id) {
                  return NextResponse.json(
                    { 
                      success: false, 
                      error: `Ez az URL alias már használatban van egy másik kategóriához. Kérjük, válasszon másik URL-t.` 
                    },
                    { status: 409 }
                  )
                }
                
                // If slug matches and it's for the same category, we're good to go
                if (aliasResponse.urlAlias === sanitizedSlug && aliasCategoryId === category.shoprenter_id) {
                  console.log('Existing alias is correct, no update needed')
                  // Continue to update local DB below
                }
              }
            } catch (verifyError) {
              console.warn('Could not verify existing alias:', verifyError)
              // Continue anyway - we have the ID from the error response
            }
          } else {
            // No ID in error response, try to search for it (fallback)
            try {
              // Search for existing URL alias with this slug using full=1 to get complete data
              const searchResponse = await fetch(`${apiUrl}?urlAlias=${encodeURIComponent(sanitizedSlug)}&type=CATEGORY&full=1`, {
                method: 'GET',
                headers: {
                  'Authorization': authHeader,
                  'Accept': 'application/json'
                }
              })
              
              if (searchResponse.ok) {
                const searchData = await searchResponse.json()
                const responseData = searchData.response || searchData
                const aliases = responseData.items || (responseData.id ? [responseData] : [])
                
                if (aliases.length > 0) {
                  const existingAlias = aliases[0]
                  // Extract category ID from urlAliasEntity
                  let existingCategoryId = null
                  if (existingAlias.urlAliasEntity) {
                    if (typeof existingAlias.urlAliasEntity === 'string') {
                      const match = existingAlias.urlAliasEntity.match(/\/categories\/([^\/]+)/)
                      existingCategoryId = match ? match[1] : null
                    } else if (existingAlias.urlAliasEntity.id) {
                      existingCategoryId = existingAlias.urlAliasEntity.id
                    } else if (existingAlias.urlAliasEntity.href) {
                      const match = existingAlias.urlAliasEntity.href.match(/\/categories\/([^\/]+)/)
                      existingCategoryId = match ? match[1] : null
                    }
                  }
                  
                  // If it's for the same category, update it
                  if (existingCategoryId === category.shoprenter_id) {
                    urlAliasId = existingAlias.id
                    console.log('Found existing URL alias for same category, will update:', urlAliasId)
                  } else {
                    // It's for a different category - return error
                    return NextResponse.json(
                      { 
                        success: false, 
                        error: `Ez az URL alias már használatban van egy másik kategóriához. Kérjük, válasszon másik URL-t.` 
                      },
                      { status: 409 }
                    )
                  }
                }
              }
            } catch (searchError) {
              console.warn('Could not search for existing URL alias:', searchError)
              // Fall through to return error
            }
            
            // If we didn't find a matching alias to update, return the conflict error
            if (!urlAliasId) {
              const errorMessage = errorJson?.message || errorJson?.error || errorText || 'Ez az URL alias már használatban van. Kérjük, válasszon másik URL-t.'
              return NextResponse.json(
                { success: false, error: errorMessage },
                { status: 409 }
              )
            }
          }
        } else {
          // For other errors, return as normal
          const errorMessage = errorJson?.message || errorJson?.error || errorText || 'URL alias létrehozása sikertelen'
          return NextResponse.json(
            { success: false, error: errorMessage },
            { status: createResponse.status }
          )
        }
      } else {
        // Successfully created
        const createdAlias = await createResponse.json()
        urlAliasId = createdAlias.id
      }
    }
    
    // If we have a urlAliasId, first check if the new slug is already in use by another category
    try {
      const checkResponse = await fetch(`${apiUrl}?urlAlias=${encodeURIComponent(sanitizedSlug)}&type=CATEGORY&full=1`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      })
      
      if (checkResponse.ok) {
        const checkData = await checkResponse.json()
        const responseData = checkData.response || checkData
        const existingAliases = responseData.items || (responseData.id ? [responseData] : [])
        
        if (existingAliases.length > 0) {
          const existingAlias = existingAliases[0]
          // Extract category ID from urlAliasEntity
          let existingCategoryId = null
          if (existingAlias.urlAliasEntity) {
            if (typeof existingAlias.urlAliasEntity === 'string') {
              const match = existingAlias.urlAliasEntity.match(/\/categories\/([^\/]+)/)
              existingCategoryId = match ? match[1] : null
            } else if (existingAlias.urlAliasEntity.id) {
              existingCategoryId = existingAlias.urlAliasEntity.id
            } else if (existingAlias.urlAliasEntity.href) {
              const match = existingAlias.urlAliasEntity.href.match(/\/categories\/([^\/]+)/)
              existingCategoryId = match ? match[1] : null
            }
          }
          
          // If it's for a different category, return error
          if (existingCategoryId && existingCategoryId !== category.shoprenter_id) {
            return NextResponse.json(
              { 
                success: false, 
                error: `Ez az URL alias már használatban van egy másik kategóriához. Kérjük, válasszon másik URL-t.` 
              },
              { status: 409 }
            )
          }
          
          // If it's for the same category and we have the same alias ID, no update needed
          if (existingCategoryId === category.shoprenter_id && existingAlias.id === urlAliasId) {
            // Slug is already set correctly, just update local DB
            const categoryUrl = shopName ? `https://${shopName}.shoprenter.hu/${sanitizedSlug}` : null
            const { error: updateError } = await supabase
              .from('shoprenter_categories')
              .update({
                url_slug: sanitizedSlug,
                url_alias_id: urlAliasId,
                category_url: categoryUrl,
                last_synced_at: new Date().toISOString()
              })
              .eq('id', id)
            
            if (updateError) {
              console.error('Error updating category URL:', updateError)
              return NextResponse.json(
                { success: false, error: 'Adatbázis frissítése sikertelen' },
                { status: 500 }
              )
            }
            
            return NextResponse.json({
              success: true,
              data: {
                urlSlug: sanitizedSlug,
                urlAliasId,
                categoryUrl
              }
            })
          }
        }
      }
    } catch (checkError) {
      console.warn('Could not check for existing URL alias before update:', checkError)
      // Continue with update attempt
    }
    
    // Update existing URL alias
    if (urlAliasId) {
      // Update existing URL alias - ONLY send writable fields (urlAlias)
      const updateResponse = await fetch(`${apiUrl}/${urlAliasId}`, {
        method: 'PUT',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          urlAlias: sanitizedSlug
        })
      })

      if (!updateResponse.ok) {
        let errorText = ''
        let errorJson = null
        try {
          errorText = await updateResponse.text()
          try {
            errorJson = JSON.parse(errorText)
          } catch {
            // Not JSON, use text as is
          }
        } catch (e) {
          errorText = 'Unknown error'
        }
        
        console.error('Failed to update URL alias:', {
          status: updateResponse.status,
          statusText: updateResponse.statusText,
          errorText,
          errorJson,
          urlAliasId,
          categoryShoprenterId: category.shoprenter_id,
          sanitizedSlug,
          requestBody: { urlAlias: sanitizedSlug }
        })
        
        // If 409 Conflict, the slug might already exist
        if (updateResponse.status === 409) {
          try {
            const conflictCheckResponse = await fetch(`${apiUrl}?urlAlias=${encodeURIComponent(sanitizedSlug)}&type=CATEGORY&full=1`, {
              method: 'GET',
              headers: {
                'Authorization': authHeader,
                'Accept': 'application/json'
              }
            })
            
            if (conflictCheckResponse.ok) {
              const conflictData = await conflictCheckResponse.json()
              const conflictResponseData = conflictData.response || conflictData
              const conflictAliases = conflictResponseData.items || (conflictResponseData.id ? [conflictResponseData] : [])
              
              if (conflictAliases.length > 0) {
                const conflictAlias = conflictAliases[0]
                let conflictCategoryId = null
                if (conflictAlias.urlAliasEntity) {
                  if (typeof conflictAlias.urlAliasEntity === 'string') {
                    const match = conflictAlias.urlAliasEntity.match(/\/categories\/([^\/]+)/)
                    conflictCategoryId = match ? match[1] : null
                  } else if (conflictAlias.urlAliasEntity.id) {
                    conflictCategoryId = conflictAlias.urlAliasEntity.id
                  } else if (conflictAlias.urlAliasEntity.href) {
                    const match = conflictAlias.urlAliasEntity.href.match(/\/categories\/([^\/]+)/)
                    conflictCategoryId = match ? match[1] : null
                  }
                }
                
                // If it's for a different category, return clear error
                if (conflictCategoryId && conflictCategoryId !== category.shoprenter_id) {
                  return NextResponse.json(
                    { 
                      success: false, 
                      error: `Ez az URL alias már használatban van egy másik kategóriához. Kérjük, válasszon másik URL-t.` 
                    },
                    { status: 409 }
                  )
                }
                
                // If it's for the same category but different alias ID, delete the old one and use the existing one
                if (conflictCategoryId === category.shoprenter_id && conflictAlias.id !== urlAliasId) {
                  try {
                    const deleteResponse = await fetch(`${apiUrl}/${urlAliasId}`, {
                      method: 'DELETE',
                      headers: {
                        'Authorization': authHeader,
                        'Accept': 'application/json'
                      }
                    })
                    
                    if (deleteResponse.ok || deleteResponse.status === 404) {
                      urlAliasId = conflictAlias.id
                      console.log('Deleted old alias and using existing one:', urlAliasId)
                    }
                  } catch (deleteError) {
                    console.warn('Could not delete old alias:', deleteError)
                  }
                  
                  // Update local DB with the existing alias
                  const categoryUrl = shopName ? `https://${shopName}.shoprenter.hu/${sanitizedSlug}` : null
                  const { error: updateError } = await supabase
                    .from('shoprenter_categories')
                    .update({
                      url_slug: sanitizedSlug,
                      url_alias_id: conflictAlias.id,
                      category_url: categoryUrl,
                      last_synced_at: new Date().toISOString()
                    })
                    .eq('id', id)
                  
                  if (updateError) {
                    console.error('Error updating category URL:', updateError)
                    return NextResponse.json(
                      { success: false, error: 'Adatbázis frissítése sikertelen' },
                      { status: 500 }
                    )
                  }
                  
                  return NextResponse.json({
                    success: true,
                    data: {
                      urlSlug: sanitizedSlug,
                      urlAliasId: conflictAlias.id,
                      categoryUrl
                    }
                  })
                }
              }
            }
          } catch (conflictError) {
            console.warn('Could not check conflict details:', conflictError)
          }
        }
        
        const errorMessage = errorJson?.message || errorJson?.error || errorText || 'URL alias frissítése sikertelen'
        return NextResponse.json(
          { success: false, error: errorMessage },
          { status: updateResponse.status }
        )
      }
    }

    // Update local database
    const categoryUrl = shopName ? `https://${shopName}.shoprenter.hu/${sanitizedSlug}` : null

    const { error: updateError } = await supabase
      .from('shoprenter_categories')
      .update({
        url_slug: sanitizedSlug,
        url_alias_id: urlAliasId,
        category_url: categoryUrl,
        last_synced_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error updating category URL:', updateError)
      return NextResponse.json(
        { success: false, error: 'Adatbázis frissítése sikertelen' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        urlSlug: sanitizedSlug,
        urlAliasId,
        categoryUrl
      }
    })
  } catch (error: any) {
    console.error('Error updating URL alias:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Hiba történt' },
      { status: 500 }
    )
  }
}
