'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { getPartnerSession } from '@/lib/auth/partner-session'
import { clearPartnerMustSetPassword } from '@/lib/auth/partner-actions'
import { PARTNER_LOGIN_PATH } from '@/lib/auth/surface'
import { partnerServerHref } from '@/lib/auth/partner-href-server'
import { getInvoiceSettings, hasAgentKey } from '@/lib/invoicing/settings'
import {
  HU_TAX_NUMBER_RE,
  queryTaxpayerByTaxNumber,
  type TaxpayerLookupResult
} from '@/lib/invoicing/taxpayer'
import { partnerTenantIsAccepting } from '@/lib/partner/companies'
import {
  partnerBillingForProformaReady,
  partnerBillingIncompleteMessage
} from '@/lib/partner/auto-proforma-rules'
import {
  billingNameOrFallback,
  firstFieldError,
  parsePartnerProfileFormData,
  validatePartnerAccountStep,
  validatePartnerBillingStep,
  validatePartnerCompanyStep
} from '@/lib/partner/profile-fields'
import { createClient } from '@/lib/supabase/server'
import {
  createServiceClient,
  isServiceRoleConfigured
} from '@/lib/supabase/service'

export type PartnerSettingsState = {
  ok?: boolean
  message?: string
  fieldErrors?: Record<string, string>
  /** Mentés után vissza a beküldéshez. */
  redirectTo?: string
}

export type PartnerTaxpayerLookupResult =
  | { ok: true; taxpayer: TaxpayerLookupResult }
  | { ok: false; message: string }

/**
 * Partner adószám → NAV/Számlázz címkitöltés.
 * A kapcsolt cég Agent kulcsát használja (service role; partnernek nincs közvetlen jog).
 */
export async function queryPartnerTaxpayerAction(
  taxNumber: string
): Promise<PartnerTaxpayerLookupResult> {
  const session = await getPartnerSession()
  if (!session) {
    return { ok: false, message: 'Nincs bejelentkezés.' }
  }

  const tenantId = session.selectedTenantId
  if (!tenantId) {
    return {
      ok: false,
      message: 'Válassz kapcsolt céget a lekérdezéshez.'
    }
  }

  const clean = taxNumber.trim().replace(/\s+/g, '')
  if (!HU_TAX_NUMBER_RE.test(clean)) {
    return {
      ok: false,
      message: 'Érvényes adószám kell (pl. 12345678-1-42).'
    }
  }

  if (!isServiceRoleConfigured()) {
    return {
      ok: false,
      message: 'A lekérdezés most nem elérhető. Töltsd ki kézzel.'
    }
  }

  const admin = createServiceClient()
  if (!admin) {
    return {
      ok: false,
      message: 'A lekérdezés most nem elérhető. Töltsd ki kézzel.'
    }
  }

  let settings
  try {
    settings = await getInvoiceSettings(admin, tenantId)
  } catch {
    return {
      ok: false,
      message: 'A kapcsolt cég számlázási beállítása nem elérhető.'
    }
  }

  if (!hasAgentKey(settings)) {
    return {
      ok: false,
      message:
        'A kapcsolt cégnél nincs Számlázz kapcsolat — töltsd ki kézzel a címet.'
    }
  }

  const result = await queryTaxpayerByTaxNumber({
    agentKey: settings!.agent_key!.trim(),
    apiUrl: settings!.api_url,
    taxNumber: clean
  })
  if (!result.ok) return { ok: false, message: result.error }
  return { ok: true, taxpayer: result.taxpayer }
}

/** Csak belső, relatív partner útvonal (open redirect tilos). */
function safePartnerReturnPath(raw: string): string | null {
  const path = raw.trim()
  if (!path.startsWith('/')) return null
  if (path.startsWith('//')) return null
  if (path.includes('://')) return null
  if (path.includes('\\')) return null
  // Partner clean URL-ek + belső /partner prefix.
  if (
    path.startsWith('/ajanlatok') ||
    path.startsWith('/megrendelesek') ||
    path.startsWith('/opti') ||
    path.startsWith('/beallitasok') ||
    path.startsWith('/home') ||
    path.startsWith('/partner/')
  ) {
    return path.slice(0, 500)
  }
  return null
}

export async function updatePartnerProfileAction(
  _prev: PartnerSettingsState,
  formData: FormData
): Promise<PartnerSettingsState> {
  const session = await getPartnerSession()
  if (!session) {
    return { message: 'Nincs bejelentkezés.' }
  }

  const input = parsePartnerProfileFormData(formData)
  // Email a formból nem megbízható — session email
  input.email = session.email
  const returnTo = safePartnerReturnPath(
    String(formData.get('return_to') || '')
  )

  const fieldErrors = {
    ...validatePartnerAccountStep(
      { ...input, password: undefined },
      { requirePassword: false }
    ),
    ...validatePartnerBillingStep(input),
    ...validatePartnerCompanyStep(input)
  }
  // Account step may set password error if empty string — clear password key
  delete fieldErrors.password

  // Beküldésről jött: díjbekérőhöz kötelező a cím (Stripe-szerű).
  if (returnTo) {
    const billing = partnerBillingForProformaReady({
      name: input.name,
      billing_name: billingNameOrFallback(input.billing_name, input.name),
      email: input.email,
      billing_postal_code: input.billing_postal_code,
      billing_city: input.billing_city,
      billing_street: input.billing_street
    })
    if (!billing.ok) {
      if (billing.missing.includes('name')) {
        fieldErrors.billing_name = 'Add meg a számlázási nevet.'
      }
      if (billing.missing.includes('postal')) {
        fieldErrors.billing_postal_code = 'Add meg az irányítószámot.'
      }
      if (billing.missing.includes('city')) {
        fieldErrors.billing_city = 'Add meg a várost.'
      }
      if (billing.missing.includes('street')) {
        fieldErrors.billing_street = 'Add meg az utcát.'
      }
      return {
        message: partnerBillingIncompleteMessage(billing),
        fieldErrors
      }
    }
  }

  const first = firstFieldError(fieldErrors)
  if (first) {
    return { message: first, fieldErrors }
  }

  const accepts = await partnerTenantIsAccepting(input.selected_tenant_id)
  if (!accepts) {
    return {
      message: 'A választott cég nem fogad online partner rendelést.',
      fieldErrors: { selected_tenant_id: 'Ez a cég most nem érhető el.' }
    }
  }

  const supabase = await createClient()
  if (!supabase) {
    return { message: 'Mentés most nem elérhető.' }
  }

  const { error } = await supabase
    .from('partner_profiles')
    .update({
      name: input.name,
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
      updated_at: new Date().toISOString()
    })
    .eq('user_id', session.id)

  if (error) {
    console.error('updatePartnerProfileAction', error.message)
    return { message: 'A profil mentése sikertelen. Próbáld újra.' }
  }

  // Ügyféltörzs számlázás frissítése (auto díjbekérő ebből olvas).
  if (input.selected_tenant_id) {
    const { error: syncErr } = await supabase.rpc('ensure_partner_customer', {
      p_tenant_id: input.selected_tenant_id
    })
    if (syncErr) {
      console.warn(
        'updatePartnerProfileAction customer sync',
        syncErr.message
      )
    }
  }

  revalidatePath('/partner/beallitasok')
  revalidatePath('/partner/home')
  revalidatePath('/beallitasok')
  revalidatePath('/home')
  if (returnTo) {
    revalidatePath(returnTo.split('?')[0]!)
  }
  return {
    ok: true,
    message: returnTo
      ? 'Profil mentve. Folytathatod a beküldést.'
      : 'Profil mentve.',
    redirectTo: returnTo ?? undefined
  }
}

export async function updatePartnerLinkedCompanyAction(
  _prev: PartnerSettingsState,
  formData: FormData
): Promise<PartnerSettingsState> {
  const session = await getPartnerSession()
  if (!session) {
    return { message: 'Nincs bejelentkezés.' }
  }

  const selectedTenantId = String(
    formData.get('selected_tenant_id') || ''
  ).trim()

  if (!selectedTenantId) {
    return {
      message: 'Válassz kapcsolt céget.',
      fieldErrors: { selected_tenant_id: 'Kötelező.' }
    }
  }

  const accepts = await partnerTenantIsAccepting(selectedTenantId)
  if (!accepts) {
    return {
      message: 'A választott cég nem fogad online partner rendelést.',
      fieldErrors: { selected_tenant_id: 'Ez a cég most nem érhető el.' }
    }
  }

  const supabase = await createClient()
  if (!supabase) {
    return { message: 'Mentés most nem elérhető.' }
  }

  const { error } = await supabase
    .from('partner_profiles')
    .update({
      selected_tenant_id: selectedTenantId,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', session.id)

  if (error) {
    console.error('updatePartnerLinkedCompanyAction', error.message)
    return { message: 'A kapcsolt cég mentése sikertelen. Próbáld újra.' }
  }

  revalidatePath('/partner/beallitasok')
  revalidatePath('/partner/home')
  revalidatePath('/beallitasok')
  revalidatePath('/home')
  return { ok: true, message: 'Kapcsolt cég mentve.' }
}

export async function changePartnerPasswordAction(
  _prev: PartnerSettingsState,
  formData: FormData
): Promise<PartnerSettingsState> {
  const session = await getPartnerSession()
  if (!session) {
    return { message: 'Nincs bejelentkezés.' }
  }

  const currentPassword = String(formData.get('current_password') || '')
  const newPassword = String(formData.get('new_password') || '')
  const confirmPassword = String(formData.get('confirm_password') || '')

  if (!currentPassword) {
    return {
      message: 'Add meg a jelenlegi jelszót.',
      fieldErrors: { current_password: 'Kötelező.' }
    }
  }
  if (newPassword.length < 8) {
    return {
      message: 'Az új jelszó legyen legalább 8 karakter.',
      fieldErrors: { new_password: 'Legalább 8 karakter.' }
    }
  }
  if (newPassword !== confirmPassword) {
    return {
      message: 'Az új jelszavak nem egyeznek.',
      fieldErrors: { confirm_password: 'Nem egyezik.' }
    }
  }

  const supabase = await createClient()
  if (!supabase) {
    return { message: 'A jelszócsere most nem elérhető.' }
  }

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: session.email,
    password: currentPassword
  })
  if (verifyError) {
    return {
      message: 'A jelenlegi jelszó helytelen.',
      fieldErrors: { current_password: 'Helytelen jelszó.' }
    }
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword
  })
  if (updateError) {
    console.error('changePartnerPasswordAction', updateError.message)
    return { message: 'A jelszó módosítása sikertelen. Próbáld újra.' }
  }

  await clearPartnerMustSetPassword(session.id)

  return { ok: true, message: 'A jelszavad megváltozott.' }
}

export async function deletePartnerAccountAction(
  _prev: PartnerSettingsState,
  formData: FormData
): Promise<PartnerSettingsState> {
  const session = await getPartnerSession()
  if (!session) {
    return { message: 'Nincs bejelentkezés.' }
  }

  const confirmText = String(formData.get('confirm_text') || '').trim()
  const password = String(formData.get('password') || '')

  if (confirmText !== 'TORLES') {
    return {
      message: 'A megerősítéshez írd be pontosan: TORLES'
    }
  }
  if (!password) {
    return { message: 'Add meg a jelszavad a törléshez.' }
  }

  if (!isServiceRoleConfigured()) {
    return {
      message:
        'A fióktörléshez SUPABASE_SERVICE_ROLE_KEY kell a szerveren. Értesítsd az üzemeltetőt.'
    }
  }

  const supabase = await createClient()
  const admin = createServiceClient()
  if (!supabase || !admin) {
    return { message: 'A törlés most nem elérhető.' }
  }

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: session.email,
    password
  })
  if (verifyError) {
    return { message: 'A jelszó helytelen.' }
  }

  // Nem beküldött saját draftok soft-delete
  const { error: softError } = await admin
    .from('quotes')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('partner_profile_id', session.id)
    .eq('source', 'portal')
    .is('portal_submitted_at', null)
    .is('deleted_at', null)

  if (softError) {
    console.error('deletePartnerAccount soft quotes', softError.message)
  }

  const { error: profileError } = await admin
    .from('partner_profiles')
    .delete()
    .eq('user_id', session.id)

  if (profileError) {
    console.error('deletePartnerAccount profile', profileError.message)
    return { message: 'A profil törlése sikertelen. Próbáld újra.' }
  }

  const { error: authError } = await admin.auth.admin.deleteUser(session.id)
  if (authError) {
    console.error('deletePartnerAccount auth', authError.message)
    return {
      message:
        'A profil törlődött, de az auth fiók törlése sikertelen. Írj az ügyfélszolgálatnak.'
    }
  }

  await supabase.auth.signOut()
  redirect(`${await partnerServerHref(PARTNER_LOGIN_PATH)}?reason=account_deleted`)
}
