'use server'

import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import {
  CURRENT_TENANT_COOKIE,
  IMPERSONATION_SESSION_COOKIE,
  OPERATOR_REFRESH_COOKIE
} from '@/lib/auth/config'
import { writePlatformAudit } from '@/lib/platform/audit'
import { requirePlatformAdmin } from '@/lib/platform/auth'
import { createClient } from '@/lib/supabase/server'

const IMPERSONATION_TTL_MS = 60 * 60 * 1000

export type ImpersonationResult =
  | { ok: true }
  | { ok: false; message: string }

function cookieOpts(maxAge = 60 * 60) {
  const domain = process.env.COOKIE_DOMAIN?.trim() || undefined
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge,
    ...(domain ? { domain } : {})
  }
}

function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_ORIGIN?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    ''
  )
}

export async function startImpersonation(input: {
  tenantId: string
  userId: string
  reason?: string
}): Promise<ImpersonationResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  if (ctx.user.isDevSession) {
    return {
      ok: false,
      message: 'Dev bypass mellett az impersonation nem elérhető.'
    }
  }

  const { data: membership, error: memError } = await ctx.admin
    .from('tenant_memberships')
    .select('id, role')
    .eq('tenant_id', input.tenantId)
    .eq('user_id', input.userId)
    .maybeSingle()

  if (memError || !membership) {
    return { ok: false, message: 'A felhasználó nem tagja ennek a cégnek.' }
  }

  const {
    data: { user: targetUser },
    error: userError
  } = await ctx.admin.auth.admin.getUserById(input.userId)

  if (userError || !targetUser?.email) {
    return { ok: false, message: 'Cél felhasználó nem található.' }
  }

  const supabase = await createClient()
  if (!supabase) {
    return { ok: false, message: 'Nincs auth kliens.' }
  }

  const {
    data: { session: operatorSession }
  } = await supabase.auth.getSession()

  if (!operatorSession?.refresh_token) {
    return { ok: false, message: 'Nincs érvényes operator session.' }
  }

  const { data: linkData, error: linkError } =
    await ctx.admin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUser.email
    })

  const hashedToken = linkData?.properties?.hashed_token
  if (linkError || !hashedToken) {
    console.error('startImpersonation generateLink', linkError?.message)
    return { ok: false, message: 'Nem sikerült a cél session létrehozása.' }
  }

  const expiresAt = new Date(Date.now() + IMPERSONATION_TTL_MS).toISOString()
  const reason = input.reason?.trim() || null
  const handoffToken = randomBytes(24).toString('hex')

  const { data: sessionRow, error: insertError } = await ctx.admin
    .from('platform_impersonation_sessions')
    .insert({
      operator_user_id: ctx.user.id,
      target_user_id: input.userId,
      tenant_id: input.tenantId,
      reason,
      handoff_token: handoffToken,
      magic_hash: hashedToken,
      operator_refresh_token: operatorSession.refresh_token,
      expires_at: expiresAt
    })
    .select('id')
    .single()

  if (insertError || !sessionRow) {
    console.error('startImpersonation insert', insertError?.message)
    return { ok: false, message: 'Nem sikerült az impersonation session.' }
  }

  await writePlatformAudit(ctx.admin, {
    tenantId: input.tenantId,
    actorUserId: ctx.user.id,
    action: 'impersonation.start',
    details: {
      targetUserId: input.userId,
      targetEmail: targetUser.email,
      sessionId: sessionRow.id,
      reason
    }
  })

  const origin = appOrigin()
  const completePath = `/api/platform/impersonation/complete?sid=${sessionRow.id}&h=${handoffToken}`
  redirect(origin ? `${origin}${completePath}` : completePath)
}

export async function stopImpersonation(): Promise<ImpersonationResult> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(IMPERSONATION_SESSION_COOKIE)?.value

  const supabase = await createClient()
  if (!supabase) {
    return { ok: false, message: 'Nincs auth kliens.' }
  }

  let operatorRefresh: string | null =
    cookieStore.get(OPERATOR_REFRESH_COOKIE)?.value ?? null

  if (sessionId) {
    const { createServiceClient } = await import('@/lib/supabase/service')
    const admin = createServiceClient()
    if (admin) {
      const { data: row } = await admin
        .from('platform_impersonation_sessions')
        .select(
          'id, tenant_id, operator_user_id, target_user_id, ended_at, operator_refresh_token'
        )
        .eq('id', sessionId)
        .maybeSingle()

      if (row && !row.ended_at) {
        if (!operatorRefresh && row.operator_refresh_token) {
          operatorRefresh = row.operator_refresh_token
        }
        await admin
          .from('platform_impersonation_sessions')
          .update({
            ended_at: new Date().toISOString(),
            magic_hash: null,
            handoff_token: null,
            operator_refresh_token: null
          })
          .eq('id', sessionId)

        await writePlatformAudit(admin, {
          tenantId: row.tenant_id,
          actorUserId: row.operator_user_id,
          action: 'impersonation.end',
          details: {
            targetUserId: row.target_user_id,
            sessionId
          }
        })
      }
    }
  }

  cookieStore.delete(IMPERSONATION_SESSION_COOKIE)
  cookieStore.delete(OPERATOR_REFRESH_COOKIE)

  if (operatorRefresh) {
    const { error: refreshError } = await supabase.auth.refreshSession({
      refresh_token: operatorRefresh
    })
    if (refreshError) {
      console.error('stopImpersonation restore', refreshError.message)
      await supabase.auth.signOut()
      cookieStore.delete(CURRENT_TENANT_COOKIE)
      redirect('/login?reason=impersonation_end')
    }
  } else {
    await supabase.auth.signOut()
    cookieStore.delete(CURRENT_TENANT_COOKIE)
    redirect('/login?reason=impersonation_end')
  }

  const {
    data: { user: operator }
  } = await supabase.auth.getUser()
  if (operator) {
    const { registerAppSession } = await import('@/lib/auth/app-session')
    const { APP_SESSION_NONCE_COOKIE } = await import('@/lib/auth/config')
    const nonce = await registerAppSession(supabase, {
      userId: operator.id,
      tenantId: null
    })
    cookieStore.set(APP_SESSION_NONCE_COOKIE, nonce, cookieOpts(60 * 60 * 24 * 30))
  }

  const platformOrigin = process.env.NEXT_PUBLIC_PLATFORM_ORIGIN?.replace(
    /\/$/,
    ''
  )
  if (platformOrigin) {
    redirect(`${platformOrigin}/`)
  }
  redirect('/platform')
}

export { cookieOpts }
