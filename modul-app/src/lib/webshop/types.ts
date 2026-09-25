export const WEBSHOP_ADDON_KEY = 'webshop' as const
export const WEBSHOP_FEATURE = 'webshop' as const

export const WEBSHOP_PAGE_KEYS = [
  '/webshop',
  '/webshop/katalogus',
  '/webshop/kategoriak',
  '/webshop/tulajdonsagok'
] as const

export type CategoryAttributeRole = 'key' | 'spec'

export type CategoryTemplateItem = {
  attributeId: string
  role: CategoryAttributeRole
  sortOrder: number
}

export type WebCategoryRow = {
  id: string
  name: string
  parentId: string | null
  parentName: string | null
  googleTaxonomyId: string | null
  sortOrder: number
  active: boolean
  productCount: number
  childCount: number
  measureImageUrl: string | null
  /** Saját sablon; üres = szülőtől örököl. */
  template: CategoryTemplateItem[]
}

export type AttributeValueType = 'list' | 'number' | 'range' | 'boolean'

export type ProductAttributeRow = {
  id: string
  name: string
  code: string
  isVariantAxis: boolean
  sortOrder: number
  active: boolean
  valueType: AttributeValueType
  unit: string | null
  measureHint: string | null
  allowMultiple: boolean
  /** Van-e már mentett termékérték (típusváltás tiltásához). */
  inUse: boolean
  values: AttributeValueRow[]
}

export type AttributeValueRow = {
  id: string
  attributeId: string
  label: string
  sortOrder: number
  active: boolean
}

/** Termék nem listás műszaki értéke. */
export type AttributeInput = {
  attributeId: string
  valueNum: number | null
  valueMax: number | null
  valueBool: boolean | null
}
