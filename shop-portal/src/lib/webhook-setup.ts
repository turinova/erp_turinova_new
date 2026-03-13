/**
 * Webhook Setup Utility
 * 
 * Automatically sets up ShopRenter webhooks when connections are created or activated.
 * Based on ShopRenter API documentation: https://doc.shoprenter.hu/api/webhook.html
 */

/**
 * Automatically create webhook in ShopRenter for a connection
 * This should be called when:
 * - A new ShopRenter connection is created and is_active = true
 * - An existing ShopRenter connection is activated (is_active changes from false to true)
 */
export async function setupShopRenterWebhook(
  connection: {
    id: string
    name: string
    api_url: string
    username: string
    password: string
    connection_type: string
    is_active: boolean
  },
  webhookUrl?: string
): Promise<{ success: boolean; webhook_id?: string; error?: string }> {
  try {
    // Only setup webhook for active ShopRenter connections
    if (connection.connection_type !== 'shoprenter' || !connection.is_active) {
      return { success: true, error: 'Not a ShopRenter connection or not active' }
    }

    // Get webhook URL from parameter or environment
    const finalWebhookUrl = webhookUrl || 
      process.env.NEXT_PUBLIC_WEBHOOK_URL || 
      process.env.WEBHOOK_URL

    if (!finalWebhookUrl) {
      console.warn('[WEBHOOK SETUP] No webhook URL configured. Set NEXT_PUBLIC_WEBHOOK_URL environment variable.')
      return { 
        success: false, 
        error: 'Webhook URL not configured. Set NEXT_PUBLIC_WEBHOOK_URL environment variable.' 
      }
    }

    // Extract shop name from API URL
    // e.g., "http://vasalatmester.api.myshoprenter.hu" -> "vasalatmester"
    const apiUrlMatch = connection.api_url.match(/https?:\/\/([^.]+)\.api(2)?\.myshoprenter\.hu/)
    if (!apiUrlMatch || !apiUrlMatch[1]) {
      return { 
        success: false, 
        error: 'Invalid ShopRenter API URL format' 
      }
    }

    const apiBaseUrl = connection.api_url.replace(/\/$/, '') // Remove trailing slash

    // Prepare webhook payload according to ShopRenter API documentation
    // https://doc.shoprenter.hu/api/webhook.html#properties
    const webhookPayload = {
      event: 'order_confirm', // Order confirmed event
      status: '1', // Active
      label: `ERP Order Webhook - ${connection.name}`,
      webHookParameters: [
        {
          type: 'json',
          url: finalWebhookUrl
        }
      ]
      // webHookDelay is optional - omit for immediate delivery
    }

    // Create webhook in ShopRenter using Basic Auth
    const authString = Buffer.from(`${connection.username}:${connection.password}`).toString('base64')
    
    // ShopRenter API endpoint: http://shopname.api.myshoprenter.hu/webHooks
    const webhookApiUrl = `${apiBaseUrl}/webHooks`
    
    console.log(`[WEBHOOK SETUP] Creating webhook for connection ${connection.name} at ${webhookApiUrl}`)

    const shoprenterResponse = await fetch(webhookApiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`
      },
      body: JSON.stringify(webhookPayload)
    })

    if (!shoprenterResponse.ok) {
      const errorText = await shoprenterResponse.text()
      console.error(`[WEBHOOK SETUP] ShopRenter API error:`, {
        status: shoprenterResponse.status,
        statusText: shoprenterResponse.statusText,
        body: errorText
      })

      return { 
        success: false, 
        error: `Failed to create webhook in ShopRenter: ${errorText}` 
      }
    }

    const webhookData = await shoprenterResponse.json()

    console.log(`[WEBHOOK SETUP] Webhook created successfully:`, webhookData.id)

    return {
      success: true,
      webhook_id: webhookData.id
    }

  } catch (error) {
    console.error('[WEBHOOK SETUP] Unexpected error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
