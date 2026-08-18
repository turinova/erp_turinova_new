/** URL-safe slug from organization name */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function ensureSlug(name: string, explicit?: string): string {
  const s = slugify(explicit?.trim() || name);
  return s || `org-${Date.now().toString(36)}`;
}

/** https://shop.hu → https://shop.hu ; bare host → https:// */
export function normalizeStoreUrl(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  try {
    const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    const u = new URL(withProto);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

export function originFromStoreUrl(storeUrl: string): string {
  const u = new URL(storeUrl);
  return `${u.protocol}//${u.host}`;
}
