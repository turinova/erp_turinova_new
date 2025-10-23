import twilio from 'twilio'
import { createClient } from '@supabase/supabase-js'

interface SMSResult {
  success: boolean
  messageSid?: string
  error?: string
}

/**
 * Send SMS notification to customer when order is ready
 */
export async function sendOrderReadySMS(
  customerName: string,
  customerMobile: string,
  orderNumber: string,
  companyName: string = 'Turinova',
  quoteId?: string
): Promise<SMSResult> {
  try {
    // Validate environment variables
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !twilioNumber) {
      console.error('[SMS] Missing Twilio credentials')
      return {
        success: false,
        error: 'Twilio credentials not configured'
      }
    }

    // Normalize phone number: remove spaces and keep only + and digits
    // Convert "+36 30 999 2800" to "+36309992800"
    const normalizedMobile = customerMobile.replace(/\s+/g, '').trim()

    // Validate phone number format (should start with +)
    if (!normalizedMobile || !normalizedMobile.startsWith('+')) {
      console.error('[SMS] Invalid phone number format:', customerMobile)
      return {
        success: false,
        error: 'Invalid phone number format (must start with +)'
      }
    }

    // Validate E.164 format (+ followed by 1-15 digits)
    const e164Regex = /^\+[1-9]\d{1,14}$/
    if (!e164Regex.test(normalizedMobile)) {
      console.error('[SMS] Phone number not in E.164 format:', normalizedMobile)
      return {
        success: false,
        error: `Invalid phone number format: ${normalizedMobile}`
      }
    }

    // Initialize Twilio client
    const client = twilio(accountSid, authToken)

    // Fetch SMS template from database
    let messageTemplate = 'Kedves {customer_name}! Az On {order_number} szamu rendelese elkeszult es atvehetο. Udvozlettel, {company_name}'
    
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      
      const { data: settings } = await supabase
        .from('sms_settings')
        .select('message_template')
        .limit(1)
        .single()
      
      if (settings?.message_template) {
        messageTemplate = settings.message_template
        console.log('[SMS] Using custom template from database')
      } else {
        console.log('[SMS] Using default template (no custom template found)')
      }
    } catch (error) {
      console.error('[SMS] Error fetching template, using default:', error)
    }

    // Fetch unique material names if quoteId is provided
    let materialNames = ''
    if (quoteId) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        
        const { data: materials } = await supabase
          .from('quote_materials_pricing')
          .select('material_name')
          .eq('quote_id', quoteId)
        
        if (materials && materials.length > 0) {
          // Get unique material names
          const uniqueMaterials = [...new Set(materials.map(m => m.material_name))]
          materialNames = uniqueMaterials.join(', ')
          console.log(`[SMS] Found materials: ${materialNames}`)
        }
      } catch (error) {
        console.error('[SMS] Error fetching materials:', error)
      }
    }

    // Replace placeholders in template
    const message = messageTemplate
      .replace(/{customer_name}/g, customerName)
      .replace(/{order_number}/g, orderNumber)
      .replace(/{company_name}/g, companyName)
      .replace(/{material_name}/g, materialNames)

    console.log(`[SMS] Sending to ${normalizedMobile} (original: ${customerMobile}): ${message}`)

    // Send SMS (use normalized phone number)
    const twilioMessage = await client.messages.create({
      body: message,
      from: twilioNumber,
      to: normalizedMobile
    })

    console.log(`[SMS] Sent successfully. SID: ${twilioMessage.sid}`)

    return {
      success: true,
      messageSid: twilioMessage.sid
    }

  } catch (error) {
    console.error('[SMS] Error sending SMS:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

