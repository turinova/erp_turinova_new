/** Shared embed readiness phase (Kezdőlap A–E). */

export type EmbedOpsPhase = "A" | "B" | "C" | "D" | "E";

export const EMBED_PHASE_LABEL: Record<EmbedOpsPhase, string> = {
  A: "Script hiányzik",
  B: "Gomb ki",
  C: "Katalógus tölt",
  D: "Él",
  E: "API hiba",
};

export function catalogIsReady(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  return s === "ready" || s === "synced";
}

export function scriptIsInstalled(opts: {
  method?: string | null;
  installedAt?: string | null;
}): boolean {
  return Boolean(opts.method || opts.installedAt);
}

export function resolveEmbedOpsPhase(opts: {
  scriptInstalled: boolean;
  widgetEnabled: boolean;
  catalogReady: boolean;
  needsReauth: boolean;
}): EmbedOpsPhase {
  if (opts.needsReauth) return "E";
  if (!opts.scriptInstalled) return "A";
  if (!opts.widgetEnabled) return "B";
  if (!opts.catalogReady) return "C";
  return "D";
}

export function phaseFromShop(opts: {
  widgetEnabled: boolean;
  catalogStatus: string | null | undefined;
  shopStatus: string | null | undefined;
  scriptMethod?: string | null;
  scriptInstalledAt?: string | null;
  hasCredentials?: boolean | null;
}): EmbedOpsPhase {
  const needsReauth =
    opts.shopStatus === "needs_reauth" ||
    opts.hasCredentials === false;
  return resolveEmbedOpsPhase({
    scriptInstalled: scriptIsInstalled({
      method: opts.scriptMethod,
      installedAt: opts.scriptInstalledAt,
    }),
    widgetEnabled: opts.widgetEnabled,
    catalogReady: catalogIsReady(opts.catalogStatus),
    needsReauth,
  });
}
