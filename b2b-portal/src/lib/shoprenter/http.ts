/**
 * Shared Shoprenter HTTP helpers — timeout + AbortSignal.
 * Rate limit: 3 req/app/shop/sec (Shoprenter docs).
 */

export const SR_DEFAULT_TIMEOUT_MS = 12_000;

export class ShoprenterTimeoutError extends Error {
  constructor(path: string, ms: number) {
    super(`Shoprenter timeout (${ms}ms): ${path}`);
    this.name = "ShoprenterTimeoutError";
  }
}

export function withTimeoutSignal(
  ms: number,
  existing?: AbortSignal | null,
): { signal: AbortSignal; clear: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  const clear = () => clearTimeout(timer);

  if (existing) {
    if (existing.aborted) {
      clear();
      ctrl.abort();
    } else {
      existing.addEventListener(
        "abort",
        () => {
          clear();
          ctrl.abort();
        },
        { once: true },
      );
    }
  }

  return { signal: ctrl.signal, clear };
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit | undefined,
  opts: { timeoutMs?: number; pathLabel?: string },
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? SR_DEFAULT_TIMEOUT_MS;
  const { signal, clear } = withTimeoutSignal(
    timeoutMs,
    init?.signal ?? null,
  );
  try {
    return await fetch(url, { ...init, signal, cache: "no-store" });
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === "AbortError" || err.message.includes("aborted"))
    ) {
      throw new ShoprenterTimeoutError(opts.pathLabel || url, timeoutMs);
    }
    throw err;
  } finally {
    clear();
  }
}
