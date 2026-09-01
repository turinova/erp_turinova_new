/** Client-safe cache-bust for /widget.js (keep in sync with settings.WIDGET_JS_ASSET). */
export const WIDGET_JS_ASSET = "73";

export function getWidgetJsUrl(): string {
  return `/widget.js?v=${WIDGET_JS_ASSET}`;
}
