/**
 * Soft chip colors for customer groups.
 * Default / none stay semantic; non-default groups get a stable tint from groupInnerId.
 */

export type GroupChipTone = {
  className: string;
  style?: { backgroundColor: string; color: string };
};

/** Soft bg + readable ink — distinct on Partners tab, not competing with CTA accent. */
const PARTNER_PALETTE: { bg: string; fg: string }[] = [
  { bg: "#e8f3fc", fg: "#084a8c" }, // blue
  { bg: "#e6f4ea", fg: "#006b08" }, // green
  { bg: "#fff4e5", fg: "#8a4500" }, // amber
  { bg: "#e7f3f2", fg: "#0f5c56" }, // teal
  { bg: "#fce8ef", fg: "#9f1239" }, // rose
  { bg: "#eef1f5", fg: "#334155" }, // slate
  { bg: "#f3eee6", fg: "#6b4423" }, // warm brown
];

const CHIP_BASE =
  "inline-flex rounded-none px-2 py-0.5 text-[11px] font-medium";

function hashPositive(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}

function partnerTone(groupInnerId: number): GroupChipTone {
  const t = PARTNER_PALETTE[hashPositive(groupInnerId) % PARTNER_PALETTE.length]!;
  return {
    className: CHIP_BASE,
    style: { backgroundColor: t.bg, color: t.fg },
  };
}

export function groupChipTone(opts: {
  groupInnerId: number | null | undefined;
  groupName?: string | null;
  isDefaultGroup?: boolean;
  isPartner?: boolean;
}): GroupChipTone {
  const name = (opts.groupName || "").trim();
  const id = opts.groupInnerId;
  const hasId = id != null && Number.isFinite(id);

  if (!hasId || !name) {
    return {
      className: `${CHIP_BASE} bg-warn/15 text-warn`,
    };
  }

  const isDefault =
    opts.isDefaultGroup === true ||
    (opts.isPartner === false && opts.isDefaultGroup !== false);

  if (isDefault) {
    return {
      className: `${CHIP_BASE} bg-surface-2 text-text`,
    };
  }

  return partnerTone(id as number);
}
