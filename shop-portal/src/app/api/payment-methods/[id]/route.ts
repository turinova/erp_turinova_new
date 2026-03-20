import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import type { ImportPaymentPolicy } from '@/lib/order-payment-import'

const IMPORT_PAYMENT_POLICIES: ImportPaymentPolicy[] = ['pending', 'paid_on_import']

function parseImportPaymentPolicyForUpdate(
  body: Record<string, unknown>
): ImportPaymentPolicy | { error: string } | undefined {
  if (!('import_payment_policy' in body)) return undefined
  const v = body.import_payment_policy
  if (v === null) return 'pending'
  if (typeof v === 'string' && IMPORT_PAYMENT_POLICIES.includes(v as ImportPaymentPolicy)) {
    return v as ImportPaymentPolicy
  }
  return { error: 'Érvénytelen import fizetési szabály' }
}

/**
 * PUT /api/payment-methods/[id]
 * Update a payment method
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, comment, active } = body
    const policyParsed = parseImportPaymentPolicyForUpdate(body as Record<string, unknown>)
    if (typeof policyParsed === 'object' && policyParsed !== null && 'error' in policyParsed) {
      return NextResponse.json({ error: policyParsed.error }, { status: 400 })
    }

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'A fizetési mód neve kötelező' },
        { status: 400 }
      )
    }

    // Check if name already exists (excluding current record)
    const { data: existingByName } = await supabase
      .from('payment_methods')
      .select('id')
      .eq('name', name.trim())
      .neq('id', id)
      .is('deleted_at', null)
      .single()

    if (existingByName) {
      return NextResponse.json(
        { error: 'Már létezik fizetési mód ezzel a névvel' },
        { status: 400 }
      )
    }

    // Update payment method
    const updatePayload: Record<string, unknown> = {
      name: name.trim(),
      comment: comment?.trim() || null,
      active: active !== undefined ? active : true,
      updated_at: new Date().toISOString()
    }
    if (policyParsed !== undefined) {
      updatePayload.import_payment_policy = policyParsed
    }

    const { data, error } = await supabase
      .from('payment_methods')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating payment method:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a fizetési mód frissítésekor' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Fizetési mód nem található' },
        { status: 404 }
      )
    }

    return NextResponse.json({ payment_method: data })
  } catch (error) {
    console.error('Error in payment-methods PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/payment-methods/[id]
 * Soft delete a payment method
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Soft delete payment method
    const { error } = await supabase
      .from('payment_methods')
      .update({
        deleted_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      console.error('Error deleting payment method:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a fizetési mód törlésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in payment-methods DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
