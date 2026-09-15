export type TenantStatus =
  | 'provisioning'
  | 'active'
  | 'read_only'
  | 'suspended'
  | 'churned'

export type TenantRole = 'owner' | 'admin' | 'member' | 'viewer'

export type TenantBillingStatus =
  | 'none'
  | 'trial'
  | 'active'
  | 'past_due'
  | 'canceled'

export type Tenant = {
  id: string
  name: string
  slug: string
  status: TenantStatus
  plan_id: string | null
  max_seats: number | null
  billing_status: TenantBillingStatus
  trial_ends_at: string | null
  paid_through: string | null
  billing_notes: string | null
  internal_notes: string | null
  contact_phone: string | null
  contact_email: string | null
  created_at: string
  updated_at: string
}

export type TenantMembership = {
  id: string
  tenant_id: string
  user_id: string
  role: TenantRole
  created_at: string
}

export type MembershipWithTenant = TenantMembership & {
  tenants: Pick<Tenant, 'id' | 'name' | 'slug' | 'status'> | null
}

export type TaxRate = {
  id: string
  tenant_id: string
  name: string
  rate_percent: number
  is_default: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type Manufacturer = {
  id: string
  tenant_id: string
  name: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type Unit = {
  id: string
  tenant_id: string
  name: string
  shortform: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type FeeType = {
  id: string
  tenant_id: string
  tax_rate_id: string
  unit_id: string
  name: string
  price_net: number
  active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type Accessory = {
  id: string
  tenant_id: string
  manufacturer_id: string
  tax_rate_id: string
  unit_id: string
  name: string
  sku: string
  barcode: string | null
  barcode_internal: string | null
  price_net: number
  active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type LinearMaterial = {
  id: string
  tenant_id: string
  manufacturer_id: string
  tax_rate_id: string
  name: string
  material_type: 'hatfal' | 'munkalap' | 'asztalap'
  length_mm: number
  width_mm: number
  thickness_mm: number
  on_stock: boolean
  active: boolean
  image_url: string | null
  price_net: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type Equipment = {
  id: string
  tenant_id: string
  name: string
  export_format: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type EdgeMaterial = {
  id: string
  tenant_id: string
  manufacturer_id: string
  tax_rate_id: string
  equipment_id: string
  type: string
  decor: string
  width_mm: number
  thickness_mm: number
  price_net: number
  allowance_mm: number
  favourite_priority: number | null
  active: boolean
  machine_code: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type SheetMaterial = {
  id: string
  tenant_id: string
  manufacturer_id: string
  tax_rate_id: string
  equipment_id: string
  name: string
  length_mm: number
  width_mm: number
  thickness_mm: number
  on_stock: boolean
  active: boolean
  image_url: string | null
  trim_top_mm: number
  trim_right_mm: number
  trim_bottom_mm: number
  trim_left_mm: number
  kerf_mm: number
  waste_multi: number
  usage_limit: number
  grain_direction: boolean
  rotatable: boolean
  price_net: number
  machine_code: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type Customer = {
  id: string
  tenant_id: string
  partner_profile_id: string | null
  name: string
  email: string | null
  mobile: string | null
  billing_name: string | null
  billing_country: string
  billing_city: string | null
  billing_postal_code: string | null
  billing_street: string | null
  billing_house_number: string | null
  billing_tax_number: string | null
  billing_company_reg_number: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type PartnerProfile = {
  user_id: string
  name: string
  email: string
  mobile: string | null
  billing_name: string | null
  billing_country: string
  billing_city: string | null
  billing_postal_code: string | null
  billing_street: string | null
  billing_house_number: string | null
  billing_tax_number: string | null
  billing_company_reg_number: string | null
  selected_tenant_id: string | null
  status: 'active' | 'disabled'
  disabled_at: string | null
  disabled_reason: string | null
  disabled_by: string | null
  created_at: string
  updated_at: string
}

export type CuttingFee = {
  id: string
  tenant_id: string
  fee_per_meter: number
  tax_rate_id: string
  pricing_mode: 'standard' | 'always_full_board' | 'always_panel_area'
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type QuoteStatus =
  | 'draft'
  | 'ordered'
  | 'in_production'
  | 'ready'
  | 'finished'
  | 'cancelled'

export type Quote = {
  id: string
  tenant_id: string
  customer_id: string
  quote_number: string
  order_number: string | null
  status: QuoteStatus
  payment_status: 'not_paid' | 'partial' | 'paid'
  source: 'opti' | 'portal' | 'internal'
  pricing_mode: 'standard' | 'always_full_board' | 'always_panel_area'
  currency: string
  total_net: number
  total_vat: number
  total_gross: number
  fees_total_net: number
  fees_total_vat: number
  fees_total_gross: number
  accessories_total_net: number
  accessories_total_vat: number
  accessories_total_gross: number
  final_total_gross: number
  comment: string | null
  project_name: string | null
  production_machine_id: string | null
  production_date: string | null
  barcode: string | null
  in_production_at: string | null
  ready_at: string | null
  finished_at: string | null
  partner_profile_id: string | null
  portal_submitted_at: string | null
  ordered_at: string | null
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type QuoteFee = {
  id: string
  tenant_id: string
  quote_id: string
  fee_type_id: string | null
  kind: 'fee' | 'credit'
  fee_name: string
  quantity: number
  unit_id: string | null
  unit_shortform: string
  unit_price_net: number
  tax_rate_percent: number
  vat_amount: number
  gross_price: number
  comment: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type QuoteAccessory = {
  id: string
  tenant_id: string
  quote_id: string
  accessory_id: string | null
  accessory_name: string
  sku: string
  barcode: string | null
  barcode_internal: string | null
  quantity: number
  unit_id: string | null
  unit_shortform: string
  unit_price_net: number
  tax_rate_percent: number
  vat_amount: number
  gross_price: number
  comment: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type QuotePanel = {
  id: string
  quote_id: string
  sheet_material_id: string
  grain_mm: number
  cross_mm: number
  quantity: number
  label: string | null
  edge_a_id: string | null
  edge_b_id: string | null
  edge_c_id: string | null
  edge_d_id: string | null
  sort_index: number
  created_at: string
}

export type QuoteMaterialLine = {
  id: string
  quote_id: string
  sheet_material_id: string
  material_name: string
  board_grain_mm: number
  board_cross_mm: number
  thickness_mm: number
  on_stock: boolean
  price_per_sqm: number
  vat_rate: number
  usage_limit: number
  waste_multi: number
  boards_charged: number
  charged_sqm: number
  pricing_method: 'full_board' | 'panel_area' | 'mixed'
  material_net: number
  material_vat: number
  material_gross: number
  edge_length_m: number
  edge_net: number
  edge_vat: number
  edge_gross: number
  cutting_length_m: number
  cutting_net: number
  cutting_vat: number
  cutting_gross: number
  total_net: number
  total_vat: number
  total_gross: number
  created_at: string
}

export type QuoteEdgeLine = {
  id: string
  quote_material_line_id: string
  edge_material_id: string
  edge_name: string
  length_m: number
  price_per_m: number
  net_price: number
  vat_amount: number
  gross_price: number
  created_at: string
}

export type TenantCompany = {
  tenant_id: string
  name: string
  country: string
  postal_code: string | null
  city: string | null
  address: string | null
  phone_number: string | null
  email: string | null
  website: string | null
  tax_number: string | null
  company_registration_number: string | null
  vat_id: string | null
  logo_url: string | null
  quote_validity_days: number
  created_at: string
  updated_at: string
}

export type PaymentMethod = {
  id: string
  tenant_id: string
  name: string
  comment: string | null
  active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type QuotePayment = {
  id: string
  tenant_id: string
  quote_id: string
  amount: number
  payment_method_id: string | null
  payment_method_name: string
  comment: string | null
  payment_date: string
  created_by: string
  created_at: string
  deleted_at: string | null
}

export type ProductionMachine = {
  id: string
  tenant_id: string
  name: string
  comment: string | null
  usage_limit_per_day: number
  active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: Tenant
        Insert: {
          id?: string
          name: string
          slug: string
          status?: TenantStatus
          plan_id?: string | null
          max_seats?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Tenant>
      }
      tenant_memberships: {
        Row: TenantMembership
        Insert: {
          id?: string
          tenant_id: string
          user_id: string
          role?: TenantRole
          created_at?: string
        }
        Update: Partial<TenantMembership>
      }
      tax_rates: {
        Row: TaxRate
        Insert: {
          id?: string
          tenant_id: string
          name: string
          rate_percent: number
          is_default?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: Partial<TaxRate>
      }
      manufacturers: {
        Row: Manufacturer
        Insert: {
          id?: string
          tenant_id: string
          name: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: Partial<Manufacturer>
      }
      units: {
        Row: Unit
        Insert: {
          id?: string
          tenant_id: string
          name: string
          shortform: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: Partial<Unit>
      }
      fee_types: {
        Row: FeeType
        Insert: {
          id?: string
          tenant_id: string
          tax_rate_id: string
          unit_id: string
          name: string
          price_net: number
          active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: Partial<FeeType>
      }
      accessories: {
        Row: Accessory
        Insert: {
          id?: string
          tenant_id: string
          manufacturer_id: string
          tax_rate_id: string
          unit_id: string
          name: string
          sku: string
          barcode?: string | null
          barcode_internal?: string | null
          price_net: number
          active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: Partial<Accessory>
      }
      linear_materials: {
        Row: LinearMaterial
        Insert: {
          id?: string
          tenant_id: string
          manufacturer_id: string
          tax_rate_id: string
          name: string
          material_type: 'hatfal' | 'munkalap' | 'asztalap'
          length_mm: number
          width_mm: number
          thickness_mm: number
          on_stock?: boolean
          active?: boolean
          image_url?: string | null
          price_net: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: Partial<LinearMaterial>
      }
      equipment: {
        Row: Equipment
        Insert: {
          id?: string
          tenant_id: string
          name: string
          export_format?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: Partial<Equipment>
      }
      edge_materials: {
        Row: EdgeMaterial
        Insert: {
          id?: string
          tenant_id: string
          manufacturer_id: string
          tax_rate_id: string
          equipment_id: string
          type: string
          decor: string
          width_mm: number
          thickness_mm: number
          price_net: number
          allowance_mm?: number
          favourite_priority?: number | null
          active?: boolean
          machine_code: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: Partial<EdgeMaterial>
      }
      sheet_materials: {
        Row: SheetMaterial
        Insert: {
          id?: string
          tenant_id: string
          manufacturer_id: string
          tax_rate_id: string
          equipment_id: string
          name: string
          length_mm: number
          width_mm: number
          thickness_mm: number
          on_stock?: boolean
          active?: boolean
          image_url?: string | null
          trim_top_mm?: number
          trim_right_mm?: number
          trim_bottom_mm?: number
          trim_left_mm?: number
          kerf_mm?: number
          waste_multi?: number
          usage_limit?: number
          grain_direction?: boolean
          rotatable?: boolean
          price_net: number
          machine_code: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: Partial<SheetMaterial>
      }
      customers: {
        Row: Customer
        Insert: {
          id?: string
          tenant_id: string
          partner_profile_id?: string | null
          name: string
          email?: string | null
          mobile?: string | null
          billing_name?: string | null
          billing_country?: string
          billing_city?: string | null
          billing_postal_code?: string | null
          billing_street?: string | null
          billing_house_number?: string | null
          billing_tax_number?: string | null
          billing_company_reg_number?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: Partial<Customer>
      }
      cutting_fees: {
        Row: CuttingFee
        Insert: {
          id?: string
          tenant_id: string
          fee_per_meter: number
          tax_rate_id: string
          pricing_mode?: CuttingFee['pricing_mode']
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: Partial<CuttingFee>
      }
      quotes: {
        Row: Quote
        Insert: {
          id?: string
          tenant_id: string
          customer_id: string
          quote_number: string
          order_number?: string | null
          status?: QuoteStatus
          payment_status?: Quote['payment_status']
          source?: Quote['source']
          pricing_mode?: Quote['pricing_mode']
          currency?: string
          total_net: number
          total_vat: number
          total_gross: number
          fees_total_net?: number
          fees_total_vat?: number
          fees_total_gross?: number
          accessories_total_net?: number
          accessories_total_vat?: number
          accessories_total_gross?: number
          final_total_gross?: number
          comment?: string | null
          project_name?: string | null
          partner_profile_id?: string | null
          portal_submitted_at?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: Partial<Quote>
      }
      quote_fees: {
        Row: QuoteFee
        Insert: {
          id?: string
          tenant_id: string
          quote_id: string
          fee_type_id?: string | null
          kind?: QuoteFee['kind']
          fee_name: string
          quantity: number
          unit_id?: string | null
          unit_shortform?: string
          unit_price_net: number
          tax_rate_percent: number
          vat_amount: number
          gross_price: number
          comment?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: Partial<QuoteFee>
      }
      quote_accessories: {
        Row: QuoteAccessory
        Insert: {
          id?: string
          tenant_id: string
          quote_id: string
          accessory_id?: string | null
          accessory_name: string
          sku: string
          barcode?: string | null
          barcode_internal?: string | null
          quantity: number
          unit_id?: string | null
          unit_shortform?: string
          unit_price_net: number
          tax_rate_percent: number
          vat_amount: number
          gross_price: number
          comment?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: Partial<QuoteAccessory>
      }
      quote_panels: {
        Row: QuotePanel
        Insert: {
          id?: string
          quote_id: string
          sheet_material_id: string
          grain_mm: number
          cross_mm: number
          quantity: number
          label?: string | null
          edge_a_id?: string | null
          edge_b_id?: string | null
          edge_c_id?: string | null
          edge_d_id?: string | null
          sort_index?: number
          created_at?: string
        }
        Update: Partial<QuotePanel>
      }
      quote_material_lines: {
        Row: QuoteMaterialLine
        Insert: Omit<QuoteMaterialLine, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<QuoteMaterialLine>
      }
      quote_edge_lines: {
        Row: QuoteEdgeLine
        Insert: {
          id?: string
          quote_material_line_id: string
          edge_material_id: string
          edge_name: string
          length_m: number
          price_per_m: number
          net_price: number
          vat_amount: number
          gross_price: number
          created_at?: string
        }
        Update: Partial<QuoteEdgeLine>
      }
      tenant_companies: {
        Row: TenantCompany
        Insert: {
          tenant_id: string
          name: string
          country?: string
          postal_code?: string | null
          city?: string | null
          address?: string | null
          phone_number?: string | null
          email?: string | null
          website?: string | null
          tax_number?: string | null
          company_registration_number?: string | null
          vat_id?: string | null
          logo_url?: string | null
          quote_validity_days?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<TenantCompany, 'tenant_id'>>
      }
      payment_methods: {
        Row: PaymentMethod
        Insert: {
          id?: string
          tenant_id: string
          name: string
          comment?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: Partial<PaymentMethod>
      }
      quote_payments: {
        Row: QuotePayment
        Insert: {
          id?: string
          tenant_id: string
          quote_id: string
          amount: number
          payment_method_id?: string | null
          payment_method_name: string
          comment?: string | null
          payment_date?: string
          created_by: string
          created_at?: string
          deleted_at?: string | null
        }
        Update: Partial<QuotePayment>
      }
      production_machines: {
        Row: ProductionMachine
        Insert: {
          id?: string
          tenant_id: string
          name: string
          comment?: string | null
          usage_limit_per_day?: number
          active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: Partial<ProductionMachine>
      }
      partner_profiles: {
        Row: PartnerProfile
        Insert: {
          user_id: string
          name: string
          email: string
          mobile?: string | null
          billing_name?: string | null
          billing_country?: string
          billing_city?: string | null
          billing_postal_code?: string | null
          billing_street?: string | null
          billing_house_number?: string | null
          billing_tax_number?: string | null
          billing_company_reg_number?: string | null
          selected_tenant_id?: string | null
          status?: 'active' | 'disabled'
          disabled_at?: string | null
          disabled_reason?: string | null
          disabled_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<PartnerProfile, 'user_id'>>
      }
    }
    Functions: {
      generate_quote_number: {
        Args: { p_tenant_id: string }
        Returns: string
      }
      generate_order_number: {
        Args: { p_tenant_id: string }
        Returns: string
      }
      convert_quote_to_order: {
        Args: {
          p_quote_id: string
          p_tenant_id: string
          p_amount?: number
          p_payment_method_id?: string | null
          p_payment_comment?: string | null
        }
        Returns: {
          order_number: string
          payment_status: string
        }
      }
      ensure_partner_customer: {
        Args: { p_tenant_id: string }
        Returns: string
      }
      tenant_accepts_partner_orders: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      is_partner: {
        Args: Record<string, never>
        Returns: boolean
      }
    }
  }
}
