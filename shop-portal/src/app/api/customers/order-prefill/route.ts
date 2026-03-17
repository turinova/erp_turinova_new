import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/customers/order-prefill?type=person|company&id=...
 * Returns entity + default billing and shipping addresses for prefill on order form.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'person' | 'company'
    const id = searchParams.get('id')

    if (!type || !id || !['person', 'company'].includes(type)) {
      return NextResponse.json(
        { error: 'type (person|company) and id are required' },
        { status: 400 }
      )
    }

    if (type === 'person') {
      const { data: person, error: personError } = await supabase
        .from('customer_persons')
        .select('id, firstname, lastname, email, telephone, default_billing_address_id, default_shipping_address_id')
        .eq('id', id)
        .is('deleted_at', null)
        .single()

      if (personError || !person) {
        return NextResponse.json({ error: 'Személy nem található' }, { status: 404 })
      }

      const { data: addresses } = await supabase
        .from('customer_addresses')
        .select('*')
        .eq('person_id', id)
        .is('deleted_at', null)
        .order('is_default_billing', { ascending: false })
        .order('is_default_shipping', { ascending: false })
        .order('created_at', { ascending: true })

      const defaultBilling =
        addresses?.find((a: any) => a.id === person.default_billing_address_id || a.is_default_billing) ||
        addresses?.find((a: any) => a.address_type === 'billing')
      const defaultShipping =
        addresses?.find((a: any) => a.id === person.default_shipping_address_id || a.is_default_shipping) ||
        addresses?.find((a: any) => a.address_type === 'shipping')

      return NextResponse.json({
        type: 'person',
        entity: {
          id: person.id,
          firstname: person.firstname,
          lastname: person.lastname,
          email: person.email,
          telephone: person.telephone
        },
        defaultBilling: defaultBilling
          ? {
              firstname: defaultBilling.firstname,
              lastname: defaultBilling.lastname,
              company: defaultBilling.company,
              address1: defaultBilling.address1,
              address2: defaultBilling.address2,
              postcode: defaultBilling.postcode,
              city: defaultBilling.city,
              country_code: defaultBilling.country_code
            }
          : null,
        defaultShipping: defaultShipping
          ? {
              firstname: defaultShipping.firstname,
              lastname: defaultShipping.lastname,
              company: defaultShipping.company,
              address1: defaultShipping.address1,
              address2: defaultShipping.address2,
              postcode: defaultShipping.postcode,
              city: defaultShipping.city,
              country_code: defaultShipping.country_code
            }
          : null
      })
    }

    // type === 'company'
    const { data: company, error: companyError } = await supabase
      .from('customer_companies')
      .select('id, name, email, telephone, tax_number, eu_tax_number, group_tax_number, default_billing_address_id, default_shipping_address_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: 'Cég nem található' }, { status: 404 })
    }

    const { data: addresses } = await supabase
      .from('customer_addresses')
      .select('*')
      .eq('company_id', id)
      .is('deleted_at', null)
      .order('is_default_billing', { ascending: false })
      .order('is_default_shipping', { ascending: false })
      .order('created_at', { ascending: true })

    const defaultBilling =
      addresses?.find((a: any) => a.id === company.default_billing_address_id || a.is_default_billing) ||
      addresses?.find((a: any) => a.address_type === 'billing')
    const defaultShipping =
      addresses?.find((a: any) => a.id === company.default_shipping_address_id || a.is_default_shipping) ||
      addresses?.find((a: any) => a.address_type === 'shipping')

    return NextResponse.json({
      type: 'company',
      entity: {
        id: company.id,
        name: company.name,
        email: company.email,
        telephone: company.telephone,
        tax_number: company.tax_number,
        eu_tax_number: company.eu_tax_number,
        group_tax_number: company.group_tax_number
      },
      defaultBilling: defaultBilling
        ? {
            firstname: defaultBilling.firstname,
            lastname: defaultBilling.lastname,
            company: defaultBilling.company,
            address1: defaultBilling.address1,
            address2: defaultBilling.address2,
            postcode: defaultBilling.postcode,
            city: defaultBilling.city,
            country_code: defaultBilling.country_code
          }
        : null,
      defaultShipping: defaultShipping
        ? {
            firstname: defaultShipping.firstname,
            lastname: defaultShipping.lastname,
            company: defaultShipping.company,
            address1: defaultShipping.address1,
            address2: defaultShipping.address2,
            postcode: defaultShipping.postcode,
            city: defaultShipping.city,
            country_code: defaultShipping.country_code
          }
        : null
    })
  } catch (error) {
    console.error('Error in order-prefill API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
