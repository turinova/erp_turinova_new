/** Client-safe embed session URL/header helpers (no next/headers / crypto). */

export const EMBED_SESSION_QUERY = "e";
export const EMBED_SESSION_HEADER = "x-progate-embed";

/** Append signed session to an embed path (keeps existing query). */
export function withEmbedToken(
  path: string,
  token?: string | null,
): string {
  if (!token) return path;
  const q = path.includes("?") ? "&" : "?";
  return `${path}${q}${EMBED_SESSION_QUERY}=${encodeURIComponent(token)}`;
}
