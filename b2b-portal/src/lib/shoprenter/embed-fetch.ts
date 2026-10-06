import { EMBED_SESSION_HEADER } from "@/lib/shoprenter/embed-token";

/** fetch for embed UI — sends signed session header when 3P cookies are blocked. */
export function embedFetch(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  embedToken?: string | null,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (embedToken) {
    headers.set(EMBED_SESSION_HEADER, embedToken);
  }
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(input, { ...init, headers });
}
