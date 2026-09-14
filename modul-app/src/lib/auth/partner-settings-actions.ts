'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { getPartnerSession } from '@/lib/auth/partner-session'
import { PARTNER_LOGIN_PATH } from '@/lib/auth/surface'
import { partnerTenantIsAccepting } from '@/lib/partner/companies'
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

  revalidatePath('/partner/beallitasok')
  revalidatePath('/partner/home')
  return { ok: true, message: 'Profil mentve.' }
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
  redirect(`${PARTNER_LOGIN_PATH}?reason=account_deleted`)
}
