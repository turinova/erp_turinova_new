import twilio from 'twilio'
import { createClient } from '@supabase/supabase-js'
import { renderSmsTemplate, toAsciiSmsText, formatSmsPrice } from '@/lib/sms-text'

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

    // Fetch SMS template from database - use "Készre jelentés" template
    let messageTemplate = 'Kedves {customer_name}! A rendelese elkeszult es atveheto. Anyagok: {material_name} Udvozlettel, {company_name}'
    
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      
      const { data: settings } = await supabase
        .from('sms_settings')
        .select('message_template')
        .eq('template_name', 'Készre jelentés')
        .single()
      
      if (settings?.message_template) {
        messageTemplate = settings.message_template
        console.log('[SMS] Using "Készre jelentés" template from database')
      } else {
        console.log('[SMS] Using default template (no "Készre jelentés" template found)')
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
        
        // First try regular quotes table
        let materials: any[] | null = null
        const { data: regularMaterials } = await supabase
          .from('quote_materials_pricing')
          .select('material_name')
          .eq('quote_id', quoteId)
        
        if (regularMaterials && regularMaterials.length > 0) {
          materials = regularMaterials
        } else {
          // If not found, try worktop quotes table
          const { data: worktopMaterials } = await supabase
            .from('worktop_quote_materials_pricing')
            .select('material_name')
            .eq('worktop_quote_id', quoteId)
          
          if (worktopMaterials && worktopMaterials.length > 0) {
            materials = worktopMaterials
          }
        }
        
        if (materials && materials.length > 0) {
          const uniqueMaterials = [...new Set(materials.map(m => m.material_name))]
          materialNames = uniqueMaterials.map(name => toAsciiSmsText(name)).join(', ')
          console.log(`[SMS] Found materials: ${materialNames}`)
        }
      } catch (error) {
        console.error('[SMS] Error fetching materials:', error)
      }
    }

    const message = renderSmsTemplate(messageTemplate, {
      customer_name: customerName,
      order_number: orderNumber,
      company_name: companyName,
      material_name: materialNames,
    })

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

/**
 * Fronttervező: SMS when order becomes Beérkezett (ready).
 * Template: "Front beérkezés"
 */
export async function sendFronttervezoReadySMS(
  customerName: string,
  customerMobile: string,
  orderNumber: string,
  totalPrice: number,
  companyName: string = 'Turinova',
  arrivalDate?: string | null
): Promise<SMSResult> {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !twilioNumber) {
      console.error('[FT SMS] Missing Twilio credentials')
      return { success: false, error: 'Twilio credentials not configured' }
    }

    const normalizedMobile = customerMobile.replace(/\s+/g, '').trim()

    if (!normalizedMobile || !normalizedMobile.startsWith('+')) {
      return { success: false, error: 'Invalid phone number format (must start with +)' }
    }

    const e164Regex = /^\+[1-9]\d{1,14}$/
    if (!e164Regex.test(normalizedMobile)) {
      return { success: false, error: `Invalid phone number format: ${normalizedMobile}` }
    }

    const client = twilio(accountSid, authToken)

    let messageTemplate =
      'Kedves {customer_name}! A(z) {order_number} szamu front rendelese beerkezett es atveheto. Osszeg: {total_price}. Udvozlettel, {company_name}'

    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const { data: settings } = await supabase
        .from('sms_settings')
        .select('message_template')
        .eq('template_name', 'Front beérkezés')
        .single()

      if (settings?.message_template) {
        messageTemplate = settings.message_template
        console.log('[FT SMS] Using "Front beérkezés" template from database')
      }
    } catch (error) {
      console.error('[FT SMS] Error fetching template, using default:', error)
    }

    const message = renderSmsTemplate(messageTemplate, {
      customer_name: customerName,
      order_number: orderNumber,
      company_name: companyName,
      total_price: formatSmsPrice(totalPrice),
      arrival_date: arrivalDate || ''
    })

    console.log(`[FT SMS] Sending to ${normalizedMobile}: ${message}`)

    const twilioMessage = await client.messages.create({
      body: message,
      from: twilioNumber,
      to: normalizedMobile
    })

    console.log(`[FT SMS] Sent successfully. SID: ${twilioMessage.sid}`)

    return { success: true, messageSid: twilioMessage.sid }
  } catch (error) {
    console.error('[FT SMS] Error sending SMS:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

