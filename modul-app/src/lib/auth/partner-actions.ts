'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { isSupabaseConfigured } from '@/lib/auth/config'
import {
  userHasPartnerProfile,
  userHasTenantMembership
} from '@/lib/auth/partner-session'
import { partnerServerHref } from '@/lib/auth/partner-href-server'
import { PARTNER_HOME_PATH, PARTNER_LOGIN_PATH, PARTNER_RESET_PASSWORD_PATH } from '@/lib/auth/surface'
import { partnerTenantIsAccepting } from '@/lib/partner/companies'
import {
  billingNameOrFallback,
  firstFieldError,
  parsePartnerProfileFormData,
  validatePartnerRegistration
} from '@/lib/partner/profile-fields'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export type PartnerAuthState = {
  error?: string
  success?: string
  fieldErrors?: Record<string, string>
}

export async function partnerLoginAction(
  _prev: PartnerAuthState,
  formData: FormData
): Promise<PartnerAuthState> {
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')

  if (!email || !password) {
    return { error: 'Add meg az emailedet és a jelszavadat.' }
  }

  if (!isSupabaseConfigured()) {
    return {
      error: 'A belépés most nem működik. Próbáld újra később.'
    }
  }

  const supabase = await createClient()
  if (!supabase) {
    return { error: 'A belépés most nem elérhető. Próbáld újra később.' }
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error || !data.user) {
    const msg = error?.message?.toLowerCase() ?? ''
    if (msg.includes('email not confirmed')) {
      return {
        error:
          'Előbb erősítsd meg az emailedet. Nézd meg a postaládádat (spam mappa is).'
      }
    }
    if (msg.includes('invalid login')) {
      return {
        error:
          'Hibás email vagy jelszó. Próbáld újra, vagy kérj új jelszót.'
      }
    }
    return {
      error: 'Hibás email vagy jelszó. Próbáld újra, vagy kérj új jelszót.'
    }
  }

  if (await userHasTenantMembership(data.user.id)) {
    await supabase.auth.signOut()
    return {
      error:
        'Ez a fiók a céges belépéshez való. Itt csak a rendelős fiókkal lehet belépni.'
    }
  }

  if (!(await userHasPartnerProfile(data.user.id))) {
    await supabase.auth.signOut()
    return {
      error:
        'Ehhez az emailhez még nincs rendelős fiók. Előbb regisztrálj.'
    }
  }

  const { data: statusRow } = await supabase
    .from('partner_profiles')
    .select('status')
    .eq('user_id', data.user.id)
    .maybeSingle()

  if (statusRow?.status === 'disabled') {
    await supabase.auth.signOut()
    return {
      error: 'A fiókod ki van kapcsolva. Ha szerinted ez hiba, írj nekünk.'
    }
  }

  redirect(await partnerServerHref(PARTNER_HOME_PATH))
}

type ProfileInsert = {
  userId: string
  name: string
  email: string
  mobile: string
  billing_name: string
  billing_country: string
  billing_city: string | null
  billing_postal_code: string | null
  billing_street: string | null
  billing_house_number: string | null
  billing_tax_number: string | null
  billing_company_reg_number: string | null
  selected_tenant_id: string
  terms_accepted_at: string
}

async function insertPartnerProfile(
  input: ProfileInsert
): Promise<{ error?: string }> {
  const admin = createServiceClient()
  const client = admin ?? (await createClient())
  if (!client) {
    return { error: 'Profil mentéshez nincs adatbázis-kapcsolat.' }
  }

  const { error: profileError } = await client.from('partner_profiles').insert({
    user_id: input.userId,
    name: input.name,
    email: input.email,
    mobile: input.mobile,
    billing_name: input.billing_name,
    billing_country: input.billing_country,
    billing_city: input.billing_city,
    billing_postal_code: input.billing_postal_code,
    billing_street: input.billing_street,
    billing_house_number: input.billing_house_number,
    billing_tax_number: input.billing_tax_number,
    billing_company_reg_number: input.billing_company_reg_number,
    selected_tenant_id: input.selected_tenant_id,
    terms_accepted_at: input.terms_accepted_at
  })

  if (profileError) {
    console.error('partner_profiles insert', profileError.message)
    if (
      profileError.message.includes('Staff felhasználó') ||
      profileError.code === '23505'
    ) {
      return {
        error:
          profileError.message.includes('Staff')
            ? 'Ez az email céges fiókhoz tartozik. Partner regisztráció nem lehetséges.'
            : 'Ehhez a fiókhoz már van partner profil. Jelentkezz be.'
      }
    }
    return {
      error:
        'A partner profil mentése sikertelen. Próbáld újra, vagy írj az ügyfélszolgálatnak.'
    }
  }

  return {}
}

export async function partnerRegisterAction(
  _prev: PartnerAuthState,
  formData: FormData
): Promise<PartnerAuthState> {
  const acceptedTerms =
    formData.get('accept_terms') === 'on' ||
    formData.get('accept_terms') === 'true' ||
    formData.get('accept_terms') === '1'

  if (!acceptedTerms) {
    return {
      error: 'Fogadd el az ÁSZF-et és az adatkezelési tájékoztatót.'
    }
  }

  const input = parsePartnerProfileFormData(formData)
  const fieldErrors = validatePartnerRegistration(input)
  const first = firstFieldError(fieldErrors)
  if (first) {
    return { error: first, fieldErrors }
  }

  if (!isSupabaseConfigured()) {
    return {
      error:
        'A regisztrációhoz Supabase kell. Állítsd be a NEXT_PUBLIC_SUPABASE_* értékeket.'
    }
  }

  const accepts = await partnerTenantIsAccepting(input.selected_tenant_id)
  if (!accepts) {
    return {
      error:
        'A választott cég nem fogad online partner rendelést. Válassz másik céget.',
      fieldErrors: {
        selected_tenant_id: 'Ez a cég most nem érhető el.'
      }
    }
  }

  const supabase = await createClient()
  if (!supabase) {
    return { error: 'A regisztráció most nem elérhető. Próbáld újra később.' }
  }

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password || '',
    options: {
      data: { full_name: input.name }
    }
  })

  if (error || !data.user) {
    const msg = error?.message?.toLowerCase() ?? ''
    if (
      msg.includes('already registered') ||
      msg.includes('already been registered') ||
      msg.includes('user already')
    ) {
      return {
        error:
          'Ez az email már foglalt. Ha céges fiókod van, az app.optinova.hu-n lépj be. Ha asztalos vagy, jelentkezz be.'
      }
    }
    if (msg.includes('rate limit') || msg.includes('email rate')) {
      return {
        error:
          'Túl sok email ment ki rövid idő alatt (Supabase limit). Localhoz: Authentication → Providers → Email → „Confirm email” kikapcsolása, majd várj 1–2 percet, vagy erősítsd meg / töröld a user-t a Supabase → Authentication → Users listában.'
      }
    }
    return {
      error: error?.message
        ? `Regisztráció sikertelen: ${error.message}`
        : 'Regisztráció sikertelen.'
    }
  }

  const admin = createServiceClient()
  if (admin) {
    const { data: memRows } = await admin
      .from('tenant_memberships')
      .select('id')
      .eq('user_id', data.user.id)
      .limit(1)

    if ((memRows?.length ?? 0) > 0) {
      return {
        error:
          'Ez az email céges (tenant) fiókhoz tartozik. Partner regisztráció nem lehetséges — lépj be az app.optinova.hu-n.'
      }
    }

    const { data: existingPartner } = await admin
      .from('partner_profiles')
      .select('user_id')
      .eq('user_id', data.user.id)
      .maybeSingle()

    if (existingPartner) {
      return {
        error: 'Ehhez az emailhez már van asztalos fiók. Jelentkezz be.'
      }
    }
  }

  const identities = data.user.identities ?? []
  if (!data.session && identities.length === 0) {
    return {
      error:
        'Ez az email már foglalt. Ha céges fiókod van, az app.optinova.hu-n lépj be. Ha asztalos vagy, jelentkezz be.'
    }
  }

  if (await userHasTenantMembership(data.user.id)) {
    if (data.session) await supabase.auth.signOut()
    return {
      error:
        'Ez az email céges fiókhoz tartozik. Partner regisztráció nem lehetséges.'
    }
  }

  const profileResult = await insertPartnerProfile({
    userId: data.user.id,
    name: input.name,
    email: input.email,
    mobile: input.mobile,
    billing_name: billingNameOrFallback(input.billing_name, input.name),
    billing_country: input.billing_country || 'Magyarország',
    billing_city: input.billing_city || null,
    billing_postal_code: input.billing_postal_code || null,
    billing_street: input.billing_street || null,
    billing_house_number: input.billing_house_number || null,
    billing_tax_number: input.billing_tax_number || null,
    billing_company_reg_number: input.billing_company_reg_number || null,
    selected_tenant_id: input.selected_tenant_id,
    terms_accepted_at: new Date().toISOString()
  })
  if (profileResult.error) {
    if (data.session) await supabase.auth.signOut()
    return { error: profileResult.error }
  }

  if (!data.session) {
    return {
      success:
        'A fiókod kész. Ha kaptál megerősítő emailt, előbb azt nyisd meg, aztán lépj be.'
    }
  }

  redirect(await partnerServerHref(PARTNER_HOME_PATH))
}

export async function partnerForgotPasswordAction(
  _prev: PartnerAuthState,
  formData: FormData
): Promise<PartnerAuthState> {
  const email = String(formData.get('email') || '').trim().toLowerCase()
  if (!email) {
    return { error: 'Add meg az emailedet.' }
  }

  if (!isSupabaseConfigured()) {
    return { error: 'Ez most nem működik. Próbáld újra később.' }
  }

  const supabase = await createClient()
  if (!supabase) {
    return { error: 'Ez most nem elérhető. Próbáld újra később.' }
  }

  const redirectTo = await buildPartnerPasswordResetRedirect()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo
  })

  if (error) {
    console.error('partnerForgotPasswordAction', error.message)
    return {
      error: 'Nem sikerült elküldeni az emailt. Próbáld újra később.'
    }
  }

  // Mindig ugyanaz a szöveg (ne áruljuk el, létezik-e a fiók)
  return {
    success:
      'Ha van fiók ezzel az emaillel, küldtünk egy linket. Nézd meg a postaládádat (spam mappa is).'
  }
}

export async function partnerResetPasswordAction(
  _prev: PartnerAuthState,
  formData: FormData
): Promise<PartnerAuthState> {
  const password = String(formData.get('password') || '')
  const confirm = String(formData.get('confirm_password') || '')

  if (password.length < 8) {
    return {
      error: 'Az új jelszó legyen legalább 8 karakter.',
      fieldErrors: { password: 'Legalább 8 karakter.' }
    }
  }
  if (password !== confirm) {
    return {
      error: 'A két jelszó nem egyezik.',
      fieldErrors: { confirm_password: 'Nem egyezik.' }
    }
  }

  const supabase = await createClient()
  if (!supabase) {
    return { error: 'A jelszócsere most nem elérhető.' }
  }

  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) {
    return {
      error:
        'A link lejárt vagy már felhasználták. Kérj újat az „Elfelejtetted a jelszavad?” oldalon.'
    }
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    console.error('partnerResetPasswordAction', error.message)
    return { error: 'Nem sikerült menteni az új jelszót. Próbáld újra.' }
  }

  redirect(await partnerServerHref(PARTNER_HOME_PATH))
}

async function buildPartnerPasswordResetRedirect(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3010'
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const origin = `${proto}://${host}`
  const nextPath = await partnerServerHref(PARTNER_RESET_PASSWORD_PATH)
  return `${origin}/auth/confirm?next=${encodeURIComponent(nextPath)}`
}

export async function partnerLogoutAction() {
  const supabase = await createClient()
  if (supabase) {
    await supabase.auth.signOut()
  }
  redirect(await partnerServerHref(PARTNER_LOGIN_PATH))
}
