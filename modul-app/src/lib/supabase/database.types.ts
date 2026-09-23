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

export type MembershipStatus = 'active' | 'disabled'

export type TenantMembership = {
  id: string
  tenant_id: string
  user_id: string
  role: TenantRole
  status: MembershipStatus
  disabled_at: string | null
  created_at: string
}

export type UserProfile = {
  user_id: string
  display_name: string | null
  updated_at: string
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

export type Warehouse = {
  id: string
  tenant_id: string
  name: string
  code: string
  is_default: boolean
  is_active: boolean
  country: string | null
  postal_code: string | null
  city: string | null
  street: string | null
  house_number: string | null
  note: string | null
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
  purchase_price_net: number | null
  margin_factor: number | null
  image_url: string | null
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
  purchase_price_net: number | null
  margin_factor: number | null
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
  purchase_price_net: number | null
  margin_factor: number | null
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

export type SupplierStatus = 'active' | 'inactive'
export type SupplierCurrency = 'HUF' | 'EUR' | 'USD'
export type SupplierAddressType = 'billing' | 'shipping' | 'other'

export type Supplier = {
  id: string
  tenant_id: string
  name: string
  email: string | null
  phone: string | null
  website: string | null
  tax_number: string | null
  eu_vat_number: string | null
  company_reg_number: string | null
  iban: string | null
  bic: string | null
  account_holder: string | null
  notes: string | null
  status: SupplierStatus
  default_currency: SupplierCurrency
  default_tax_rate_id: string | null
  default_payment_method_id: string | null
  default_payment_terms_days: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type SupplierAddress = {
  id: string
  tenant_id: string
  supplier_id: string
  label: string | null
  address_type: SupplierAddressType
  country: string
  postal_code: string | null
  city: string | null
  street: string | null
  house_number: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export type SupplierContact = {
  id: string
  tenant_id: string
  supplier_id: string
  name: string
  email: string | null
  phone: string | null
  is_primary: boolean
  note: string | null
  created_at: string
  updated_at: string
}

export type PurchaseOrderStatus =
  | 'draft'
  | 'ordered'
  | 'partial'
  | 'received'
  | 'cancelled'

export type PurchaseOrder = {
  id: string
  tenant_id: string
  supplier_id: string
  warehouse_id: string
  po_number: string
  status: PurchaseOrderStatus
  expected_date: string | null
  note: string | null
  currency: string
  email_sent: boolean
  email_sent_at: string | null
  ordered_at: string | null
  cancelled_at: string | null
  closed_incomplete_at: string | null
  closed_incomplete_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type PurchaseOrderItem = {
  id: string
  tenant_id: string
  purchase_order_id: string
  accessory_id: string
  name_snapshot: string
  sku_snapshot: string
  quantity: number
  net_price: number
  tax_rate_id: string
  tax_rate_percent: number
  unit_id: string
  unit_shortform: string
  sort_order: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type GoodsReceiptStatus = 'checking' | 'received' | 'cancelled'

export type GoodsReceipt = {
  id: string
  tenant_id: string
  purchase_order_id: string
  warehouse_id: string
  receipt_number: string
  status: GoodsReceiptStatus
  note: string | null
  received_at: string | null
  received_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type GoodsReceiptItem = {
  id: string
  tenant_id: string
  goods_receipt_id: string
  purchase_order_item_id: string | null
  accessory_id: string
  name_snapshot: string
  sku_snapshot: string
  unit_shortform: string
  target_quantity: number
  quantity_received: number
  is_extra: boolean
  sort_order: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type StockMovementType = 'in' | 'out'
export type StockMovementSource =
  | 'purchase_receipt'
  | 'adjustment'
  | 'sale'
  | 'transfer'
  | 'sale_return'

export type StockMovement = {
  id: string
  tenant_id: string
  warehouse_id: string
  product_type: 'accessory'
  accessory_id: string
  quantity: number
  movement_type: StockMovementType
  source_type: StockMovementSource
  source_id: string | null
  unit_cost_net: number | null
  note: string | null
  stock_movement_number: string
  created_by: string | null
  created_at: string
}

export type StockTransferStatus = 'completed' | 'cancelled'

export type StockTransfer = {
  id: string
  tenant_id: string
  from_warehouse_id: string
  to_warehouse_id: string
  transfer_number: string
  status: StockTransferStatus
  note: string | null
  completed_at: string | null
  completed_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type StockTransferItem = {
  id: string
  tenant_id: string
  stock_transfer_id: string
  accessory_id: string
  name_snapshot: string
  sku_snapshot: string
  unit_shortform: string
  quantity: number
  sort_order: number
  created_at: string
  deleted_at: string | null
}

export type SaleChannel = 'manual' | 'pos' | 'webshop'
export type SaleStatus =
  | 'draft'
  | 'confirmed'
  | 'fulfilled'
  | 'cancelled'
  | 'returned'
export type SalePaymentStatus = 'unpaid' | 'partial' | 'paid'

export type SalesOrder = {
  id: string
  tenant_id: string
  warehouse_id: string
  customer_id: string | null
  sale_number: string
  channel: SaleChannel
  external_ref: string | null
  status: SaleStatus
  payment_status: SalePaymentStatus
  customer_name_snapshot: string | null
  discount_percentage: number
  discount_amount: number
  subtotal_net: number
  total_vat: number
  total_gross: number
  cash_rounding_amount: number
  note: string | null
  fulfilled_at: string | null
  fulfilled_by: string | null
  cancelled_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type SalesOrderItem = {
  id: string
  tenant_id: string
  sales_order_id: string
  item_kind: 'product' | 'fee'
  accessory_id: string | null
  fee_type_id: string | null
  name_snapshot: string
  sku_snapshot: string | null
  unit_shortform: string
  quantity: number
  unit_price_net: number
  unit_price_gross: number
  tax_rate_percent: number
  discount_percentage: number
  discount_amount: number
  total_net: number
  total_vat: number
  total_gross: number
  sort_order: number
  created_at: string
  deleted_at: string | null
}

export type SalesPayment = {
  id: string
  tenant_id: string
  sales_order_id: string
  payment_method_id: string | null
  payment_method_name: string
  amount: number
  status: 'completed' | 'voided'
  provider_ref: string | null
  paid_at: string
  created_by: string | null
  created_at: string
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
  terms_accepted_at: string | null
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
          status?: MembershipStatus
          disabled_at?: string | null
          created_at?: string
        }
        Update: Partial<TenantMembership>
      }
      user_profiles: {
        Row: UserProfile
        Insert: {
          user_id: string
          display_name?: string | null
          updated_at?: string
        }
        Update: Partial<UserProfile>
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
      warehouses: {
        Row: Warehouse
        Insert: {
          id?: string
          tenant_id: string
          name: string
          code: string
          is_default?: boolean
          is_active?: boolean
          country?: string | null
          postal_code?: string | null
          city?: string | null
          street?: string | null
          house_number?: string | null
          note?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: Partial<Warehouse>
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
      media_files: {
        Row: {
          id: string
          tenant_id: string
          original_filename: string
          stored_filename: string
          storage_path: string
          public_url: string
          size_bytes: number
          mime_type: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          original_filename: string
          stored_filename: string
          storage_path: string
          public_url: string
          size_bytes: number
          mime_type: string
          created_by?: string | null
          created_at?: string
        }
        Update: Partial<{
          id: string
          tenant_id: string
          original_filename: string
          stored_filename: string
          storage_path: string
          public_url: string
          size_bytes: number
          mime_type: string
          created_by: string | null
          created_at: string
        }>
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
          purchase_price_net?: number | null
          margin_factor?: number | null
          image_url?: string | null
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
          purchase_price_net?: number | null
          margin_factor?: number | null
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
          purchase_price_net?: number | null
          margin_factor?: number | null
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
      suppliers: {
        Row: Supplier
        Insert: {
          id?: string
          tenant_id: string
          name: string
          email?: string | null
          phone?: string | null
          website?: string | null
          tax_number?: string | null
          eu_vat_number?: string | null
          company_reg_number?: string | null
          iban?: string | null
          bic?: string | null
          account_holder?: string | null
          notes?: string | null
          status?: SupplierStatus
          default_currency?: SupplierCurrency
          default_tax_rate_id?: string | null
          default_payment_method_id?: string | null
          default_payment_terms_days?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: Partial<Supplier>
      }
      supplier_addresses: {
        Row: SupplierAddress
        Insert: {
          id?: string
          tenant_id: string
          supplier_id: string
          label?: string | null
          address_type?: SupplierAddressType
          country?: string
          postal_code?: string | null
          city?: string | null
          street?: string | null
          house_number?: string | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<SupplierAddress>
      }
      supplier_contacts: {
        Row: SupplierContact
        Insert: {
          id?: string
          tenant_id: string
          supplier_id: string
          name: string
          email?: string | null
          phone?: string | null
          is_primary?: boolean
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<SupplierContact>
      }
      purchase_orders: {
        Row: PurchaseOrder
        Insert: {
          id?: string
          tenant_id: string
          supplier_id: string
          warehouse_id: string
          po_number: string
          status?: PurchaseOrderStatus
          expected_date?: string | null
          note?: string | null
          currency?: string
          email_sent?: boolean
          email_sent_at?: string | null
          ordered_at?: string | null
          cancelled_at?: string | null
          closed_incomplete_at?: string | null
          closed_incomplete_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: Partial<PurchaseOrder>
      }
      purchase_order_items: {
        Row: PurchaseOrderItem
        Insert: {
          id?: string
          tenant_id: string
          purchase_order_id: string
          accessory_id: string
          name_snapshot: string
          sku_snapshot: string
          quantity: number
          net_price: number
          tax_rate_id: string
          tax_rate_percent: number
          unit_id: string
          unit_shortform: string
          sort_order?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: Partial<PurchaseOrderItem>
      }
      goods_receipts: {
        Row: GoodsReceipt
        Insert: {
          id?: string
          tenant_id: string
          purchase_order_id: string
          warehouse_id: string
          receipt_number: string
          status?: GoodsReceiptStatus
          note?: string | null
          received_at?: string | null
          received_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: Partial<GoodsReceipt>
      }
      goods_receipt_items: {
        Row: GoodsReceiptItem
        Insert: {
          id?: string
          tenant_id: string
          goods_receipt_id: string
          purchase_order_item_id?: string | null
          accessory_id: string
          name_snapshot: string
          sku_snapshot: string
          unit_shortform: string
          target_quantity: number
          quantity_received?: number
          is_extra?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: Partial<GoodsReceiptItem>
      }
      stock_movements: {
        Row: StockMovement
        Insert: {
          id?: string
          tenant_id: string
          warehouse_id: string
          product_type?: 'accessory'
          accessory_id: string
          quantity: number
          movement_type: StockMovementType
          source_type: StockMovementSource
          source_id?: string | null
          unit_cost_net?: number | null
          note?: string | null
          stock_movement_number: string
          created_by?: string | null
          created_at?: string
        }
        Update: Partial<StockMovement>
      }
      stock_transfers: {
        Row: StockTransfer
        Insert: {
          id?: string
          tenant_id: string
          from_warehouse_id: string
          to_warehouse_id: string
          transfer_number: string
          status?: StockTransferStatus
          note?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: Partial<StockTransfer>
      }
      stock_transfer_items: {
        Row: StockTransferItem
        Insert: {
          id?: string
          tenant_id: string
          stock_transfer_id: string
          accessory_id: string
          name_snapshot: string
          sku_snapshot: string
          unit_shortform: string
          quantity: number
          sort_order?: number
          created_at?: string
          deleted_at?: string | null
        }
        Update: Partial<StockTransferItem>
      }
      sales_orders: {
        Row: SalesOrder
        Insert: {
          id?: string
          tenant_id: string
          warehouse_id: string
          customer_id?: string | null
          sale_number: string
          channel?: SaleChannel
          external_ref?: string | null
          status?: SaleStatus
          payment_status?: SalePaymentStatus
          customer_name_snapshot?: string | null
          discount_percentage?: number
          discount_amount?: number
          subtotal_net?: number
          total_vat?: number
          total_gross?: number
          cash_rounding_amount?: number
          note?: string | null
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          cancelled_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: Partial<SalesOrder>
      }
      sales_order_items: {
        Row: SalesOrderItem
        Insert: {
          id?: string
          tenant_id: string
          sales_order_id: string
          item_kind?: 'product' | 'fee'
          accessory_id?: string | null
          fee_type_id?: string | null
          name_snapshot: string
          sku_snapshot?: string | null
          unit_shortform?: string
          quantity: number
          unit_price_net?: number
          unit_price_gross?: number
          tax_rate_percent?: number
          discount_percentage?: number
          discount_amount?: number
          total_net?: number
          total_vat?: number
          total_gross?: number
          sort_order?: number
          created_at?: string
          deleted_at?: string | null
        }
        Update: Partial<SalesOrderItem>
      }
      sales_payments: {
        Row: SalesPayment
        Insert: {
          id?: string
          tenant_id: string
          sales_order_id: string
          payment_method_id?: string | null
          payment_method_name: string
          amount: number
          status?: 'completed' | 'voided'
          provider_ref?: string | null
          paid_at?: string
          created_by?: string | null
          created_at?: string
          deleted_at?: string | null
        }
        Update: Partial<SalesPayment>
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
          terms_accepted_at?: string | null
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
      generate_purchase_order_number: {
        Args: { p_tenant_id: string }
        Returns: string
      }
      generate_goods_receipt_number: {
        Args: { p_tenant_id: string }
        Returns: string
      }
      generate_stock_movement_number: {
        Args: { p_tenant_id: string }
        Returns: string
      }
      accessory_on_hand: {
        Args: {
          p_tenant_id: string
          p_accessory_id: string
          p_warehouse_id: string
        }
        Returns: number
      }
      generate_stock_transfer_number: {
        Args: { p_tenant_id: string }
        Returns: string
      }
      create_stock_transfer: {
        Args: {
          p_from_warehouse_id: string
          p_to_warehouse_id: string
          p_note: string | null
          p_items: unknown
        }
        Returns: Record<string, unknown>
      }
      generate_sale_number: {
        Args: { p_tenant_id: string }
        Returns: string
      }
      hungarian_cash_round: {
        Args: { p_amount: number }
        Returns: number
      }
      create_sale: {
        Args: {
          p_warehouse_id: string
          p_customer_id: string | null
          p_channel: string
          p_note: string | null
          p_items: unknown
          p_fees: unknown
          p_discount: unknown
          p_payments: unknown
          p_pos_register_id?: string | null
          p_fulfill_now?: boolean
        }
        Returns: Record<string, unknown>
      }
      fulfill_sale: {
        Args: { p_sales_order_id: string }
        Returns: Record<string, unknown>
      }
      record_sale_payment: {
        Args: {
          p_sales_order_id: string
          p_payment_method_id: string
          p_amount: number
        }
        Returns: Record<string, unknown>
      }
      receive_goods_receipt: {
        Args: { p_receipt_id: string }
        Returns: Record<string, unknown>
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
      search_materials_catalog: {
        Args: {
          p_tenant_id: string
          p_q: string
          p_kinds?: string[]
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          kind: string
          id: string
          name: string
          manufacturer_name: string
          type_label: string
          sku: string | null
          length_mm: number | null
          width_mm: number | null
          thickness_mm: number | null
          on_stock: boolean | null
          price_gross_per_m: number | null
          price_gross_sqm: number | null
          price_gross_piece: number | null
          unit_shortform: string | null
          total_count: number
        }[]
      }
    }
  }
}
