import { WIDGET_JS_ASSET } from "@/lib/widget/asset-version";

/** Single-script loader URL for ScriptTag + manual install (shopId + apiBase in query). */
export function buildWidgetLoaderUrl(opts: {
  apiBase: string;
  publicId: string;
  version?: string;
}): string {
  const base = opts.apiBase.replace(/\/$/, "");
  const v = opts.version || WIDGET_JS_ASSET;
  const q = new URLSearchParams({
    v,
    shopId: opts.publicId,
    apiBase: base,
  });
  return `${base}/widget.js?${q.toString()}`;
}

/** One-line install snippet — preferred for ScriptTag and footer_scripts. */
export function buildLoaderSnippet(opts: {
  apiBase: string;
  publicId: string;
  version?: string;
}): string {
  const src = buildWidgetLoaderUrl(opts);
  return `<script src=${JSON.stringify(src)} defer></script>`;
}

/** Legacy two-block snippet (inline config + src) — still works. */
export function buildLegacySnippet(opts: {
  apiBase: string;
  publicId: string;
  version?: string;
}): string {
  const base = opts.apiBase.replace(/\/$/, "");
  const v = opts.version || WIDGET_JS_ASSET;
  return `<script>
window.SR_B2B_QUICKORDER = {
  apiBase: ${JSON.stringify(base)},
  shopId: ${JSON.stringify(opts.publicId)}
};
</script>
<script src=${JSON.stringify(`${base}/widget.js?v=${v}`)} defer></script>`;
}
