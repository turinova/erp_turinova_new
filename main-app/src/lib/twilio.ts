import twilio from 'twilio'

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
  companyName: string = 'Turinova'
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

    // Create SMS message (Hungarian)
    // You can customize this message here:
    const message = `Kedves ${customerName}! Az On ${orderNumber} szamu rendelese elkeszult es atvehetο. Udvozlettel, ${companyName}`

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

