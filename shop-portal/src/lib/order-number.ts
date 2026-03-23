/**
 * Unique order number for tenant (RPC or fallback).
 */
export async function generateOrderNumber(supabase: { rpc: (n: string) => Promise<{ data: unknown; error: unknown }>; from: (t: string) => any }): Promise<string> {
  const { data, error } = await supabase.rpc('generate_order_number')

  if (error || !data) {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '-')
    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .like('order_number', `ORD-${today}-%`)
      .is('deleted_at', null)

    const sequence = ((count || 0) + 1).toString().padStart(3, '0')
    return `ORD-${today}-${sequence}`
  }

  return data as string
}
