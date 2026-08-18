export type CatalogProductDraft = {
  externalProductId: string;
  sku: string;
  modelNumber?: string | null;
  gtin?: string | null;
  name?: string | null;
  active: boolean;
  minQty: number;
  qtyStep: number;
  costNet?: number | null;
  listPriceNet?: number | null;
};

export type ProductPage = {
  items: CatalogProductDraft[];
  nextCursor: string | null;
  pageCount?: number;
};

export type CommerceAdapter = {
  platform: string;
  rateLimit: { maxRps: number; pageDelayMs: number };
  ping(): Promise<boolean>;
  listProductsPage(cursor: string | null): Promise<ProductPage>;
};
