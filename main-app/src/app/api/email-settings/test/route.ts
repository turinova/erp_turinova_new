import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import nodemailer from 'nodemailer'

/**
 * POST /api/email-settings/test
 * Test SMTP connection with provided credentials
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookies) => {
            cookies.forEach(({ name, value, ...options }) => {
              cookieStore.set(name, value, options)
            })
          }
        }
      }
    )

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { host, port, secure, user: smtpUser, password, from_email } = body

    // Validation
    if (!host || !port || !smtpUser || !password || !from_email) {
      return NextResponse.json(
        { error: 'Minden mező kitöltése kötelező a teszteléshez' },
        { status: 400 }
      )
    }

    // Create transporter for testing
    const transporter = nodemailer.createTransport({
      host: host,
      port: parseInt(port),
      secure: secure ?? true, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: password,
      },
      // Add timeout for faster failure detection
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 10000,
    })

    // Test connection by verifying credentials
    try {
      await transporter.verify()
      
      // If verification succeeds, try to send a test email to the from_email address
      // This ensures the "from" address is also valid
      const testInfo = await transporter.sendMail({
        from: `"Turinova Email Teszt" <${from_email}>`,
        to: from_email, // Send test email to the from address
        subject: 'SMTP Kapcsolat Teszt - Turinova',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #1976d2;">SMTP Kapcsolat Sikeres!</h2>
            <p>Ez egy automatikus teszt email a Turinova rendszerből.</p>
            <p>Az SMTP beállítások helyesek és működnek.</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
            <p style="color: #666; font-size: 12px;">
              Teszt időpont: ${new Date().toLocaleString('hu-HU')}
            </p>
          </div>
        `,
        text: `SMTP Kapcsolat Sikeres!\n\nEz egy automatikus teszt email a Turinova rendszerből.\n\nAz SMTP beállítások helyesek és működnek.\n\nTeszt időpont: ${new Date().toLocaleString('hu-HU')}`,
      })

      return NextResponse.json({
        success: true,
        message: 'SMTP kapcsolat sikeres! Teszt email elküldve.',
        messageId: testInfo.messageId,
      })
    } catch (verifyError: any) {
      console.error('SMTP verification error:', verifyError)
      
      // Provide user-friendly error messages
      let errorMessage = 'SMTP kapcsolat hiba'
      
      if (verifyError.code === 'EAUTH') {
        errorMessage = 'Hitelesítési hiba: Hibás felhasználónév vagy jelszó'
      } else if (verifyError.code === 'ETIMEDOUT' || verifyError.code === 'ECONNREFUSED') {
        errorMessage = 'Kapcsolódási hiba: Nem lehet csatlakozni az SMTP szerverhez. Ellenőrizze a szerver címet és portot.'
      } else if (verifyError.code === 'ESOCKET') {
        errorMessage = 'Hálózati hiba: Nem lehet elérni az SMTP szervert'
      } else if (verifyError.message) {
        errorMessage = `SMTP hiba: ${verifyError.message}`
      }

      return NextResponse.json(
        { 
          success: false, 
          error: errorMessage,
          details: verifyError.code || verifyError.message 
        },
        { status: 400 }
      )
    }
  } catch (e: any) {
    console.error('Error in POST /api/email-settings/test', e)
    return NextResponse.json(
      { 
        success: false,
        error: 'Váratlan hiba történt: ' + (e.message || 'Ismeretlen hiba')
      },
      { status: 500 }
    )
  }
}

