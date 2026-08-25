/**
 * Árszámítás — „melyik ár győz” (S0 szerint igazítandó).
 * Alapértelmezés: saját ár > sáv (S2) > kedvezmény % > listaár.
 */

export type PriceSource = "own" | "tier" | "percent" | "list" | "special";

export type TierSpecial = {
  price: number;
  minQty: number;
  maxQty: number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
};

export type EffectivePriceInput = {
  listNet: number;
  /** 0–100; null/0 = nincs csoport % */
  groupPercent: number | null;
  /** Fix csoportár nettó */
  ownGroupNet: number | null;
  /** productSpecial sávok (S2); S1-ben üres */
  specials?: TierSpecial[];
  qty?: number;
  now?: Date;
};

export type EffectivePriceResult = {
  net: number;
  source: PriceSource;
};

function parseSrDate(raw: string | null | undefined): Date | null {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t || t.startsWith("0000")) return null;
  const d = new Date(t.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

function isSpecialActive(
  sp: TierSpecial,
  now: Date,
): boolean {
  const from = parseSrDate(sp.dateFrom ?? null);
  const to = parseSrDate(sp.dateTo ?? null);
  if (from && now < from) return false;
  if (to && now > to) return false;
  return true;
}

function matchesQty(sp: TierSpecial, qty: number): boolean {
  const min = Math.max(0, sp.minQty || 0);
  const max = sp.maxQty != null && sp.maxQty > 0 ? sp.maxQty : null;
  if (min > 0 && qty < min) return false;
  if (max != null && qty > max) return false;
  return true;
}

/** HUF nettó kerekítés. */
export function roundNetHuf(n: number): number {
  return Math.round(n);
}

/**
 * Effektív nettó ár.
 * S0.2 ha mást mond a bolt: ezt a sorrendet cseréld, ne a UI copy-t felejtsd el.
 */
export function effectiveNet(input: EffectivePriceInput): EffectivePriceResult {
  const list = Number(input.listNet);
  if (!Number.isFinite(list) || list < 0) {
    return { net: 0, source: "list" };
  }

  const qty = Math.max(1, Math.round(input.qty ?? 1));
  const now = input.now ?? new Date();
  const own =
    input.ownGroupNet != null && Number.isFinite(input.ownGroupNet)
      ? roundNetHuf(input.ownGroupNet)
      : null;

  // 1) Saját csoportár
  if (own != null) {
    return { net: own, source: "own" };
  }

  // 2) Sáv / special (S2) — qty + dátum; legalacsonyabb illeszkedő
  const specials = input.specials ?? [];
  let bestTier: number | undefined;
  for (const sp of specials) {
    if (!Number.isFinite(sp.price)) continue;
    if (!isSpecialActive(sp, now)) continue;
    if (!matchesQty(sp, qty)) continue;
    const p = roundNetHuf(sp.price);
    if (bestTier == null || p < bestTier) bestTier = p;
  }
  if (bestTier != null && bestTier < list) {
    return { net: bestTier, source: "tier" };
  }

  // 3) Csoport %
  const pct = input.groupPercent;
  if (pct != null && pct > 0 && pct <= 100) {
    const discounted = roundNetHuf(list * (1 - pct / 100));
    if (discounted < list) {
      return { net: discounted, source: "percent" };
    }
  }

  return { net: roundNetHuf(list), source: "list" };
}

export type NextTierInfo = {
  minQty: number;
  priceNet: number;
  missingQty: number;
  /** Megtakarítás % a jelenlegi egységárhoz képest */
  savePct: number;
  /** FOMO: kevés db hiányzik */
  near: boolean;
};

/**
 * Következő (magasabb minQty) sáv, ami olcsóbb a jelenlegi egységárnál.
 * Fix saját árnál null.
 */
export function findNextTier(opts: {
  specials: TierSpecial[];
  qty: number;
  currentNet: number;
  listNet: number;
  blockedByOwn?: boolean;
  now?: Date;
  /** near = missingQty <= max(2, ceil(minQty * 0.2)) */
  nearFactor?: number;
}): NextTierInfo | null {
  if (opts.blockedByOwn) return null;
  const qty = Math.max(1, Math.round(opts.qty));
  const now = opts.now ?? new Date();
  const current = roundNetHuf(opts.currentNet);
  const list = Number(opts.listNet);
  if (!Number.isFinite(list) || list <= 0) return null;

  let best: NextTierInfo | null = null;
  for (const sp of opts.specials) {
    if (!Number.isFinite(sp.price)) continue;
    if (!isSpecialActive(sp, now)) continue;
    const minQty = Math.max(1, Math.round(sp.minQty || 0));
    if (minQty <= qty) continue;
    const priceNet = roundNetHuf(sp.price);
    if (priceNet >= current) continue;
    if (priceNet >= list) continue;
    const missingQty = minQty - qty;
    const savePct =
      current > 0
        ? Math.round(((current - priceNet) / current) * 1000) / 10
        : 0;
    if (savePct <= 0) continue;
    const nearLimit = Math.max(2, Math.ceil(minQty * (opts.nearFactor ?? 0.2)));
    const cand: NextTierInfo = {
      minQty,
      priceNet,
      missingQty,
      savePct,
      near: missingQty <= nearLimit,
    };
    if (
      !best ||
      cand.minQty < best.minQty ||
      (cand.minQty === best.minQty && cand.priceNet < best.priceNet)
    ) {
      best = cand;
    }
  }
  return best;
}

/** Aktív csoport sávjai (qty-től független lista, UI ladder). */
export function listActiveTiers(
  specials: TierSpecial[],
  listNet: number,
  now = new Date(),
): { minQty: number; priceNet: number }[] {
  const byMin = new Map<number, number>();
  for (const sp of specials) {
    if (!Number.isFinite(sp.price)) continue;
    if (!isSpecialActive(sp, now)) continue;
    const minQty = Math.max(0, Math.round(sp.minQty || 0));
    if (minQty < 1) continue;
    const priceNet = roundNetHuf(sp.price);
    if (priceNet >= listNet) continue;
    const prev = byMin.get(minQty);
    if (prev == null || priceNet < prev) byMin.set(minQty, priceNet);
  }
  return [...byMin.entries()]
    .map(([minQty, priceNet]) => ({ minQty, priceNet }))
    .sort((a, b) => a.minQty - b.minQty);
}

/** Listaár − X% → saját árnak menthető nettó. */
export function percentOffList(listNet: number, percentOff: number): number {
  const p = Math.min(100, Math.max(0, percentOff));
  return roundNetHuf(listNet * (1 - p / 100));
}

/**
 * Cost-plus javaslat: beszerzés + árrés % → fix nettó (P-10).
 * markupPct pl. 25 → cost × 1.25
 */
export function costPlusNet(costNet: number, markupPct: number): number | null {
  if (!Number.isFinite(costNet) || costNet <= 0) return null;
  const m = Math.min(500, Math.max(0, markupPct));
  return roundNetHuf(costNet * (1 + m / 100));
}

/**
 * true ha az effektív árrés a floor alatt van (P-11).
 * Floor pl. 15 = legalább 15% árrés kellene.
 */
export function belowMarginFloor(
  effectiveNet: number,
  costNet: number | null | undefined,
  floorPct: number,
): boolean {
  const m = marginPercent(effectiveNet, costNet);
  if (m == null) return false;
  const floor = Number.isFinite(floorPct) ? floorPct : 0;
  return m < floor;
}

/** Nettó → bruttó (HU B2B default ÁFA 27%, amíg nincs product vat_rate). */
export function netToGross(net: number, vatRate = 27): number {
  const vat = Number.isFinite(vatRate) && vatRate >= 0 ? vatRate : 27;
  return Math.round(net * (1 + vat / 100));
}

/**
 * Árrés % = (eladási nettó − beszerzés) / eladási nettó × 100.
 * null ha nincs cost vagy érvénytelen.
 */
export function marginPercent(
  effectiveNet: number,
  costNet: number | null | undefined,
): number | null {
  if (
    costNet == null ||
    !Number.isFinite(costNet) ||
    costNet < 0 ||
    !Number.isFinite(effectiveNet) ||
    effectiveNet <= 0
  ) {
    return null;
  }
  return Math.round(((effectiveNet - costNet) / effectiveNet) * 1000) / 10;
}
