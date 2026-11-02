/**
 * Boot wrapper for pdf.worker.min.mjs (Safari / older Chromium).
 *
 * pdf.js 5.6+ calls Map.getOrInsert / getOrInsertComputed. Those APIs are
 * missing in many Safari builds — polyfill MUST run before the worker module
 * evaluates. Static `import` would hoist and load the worker first; use
 * dynamic `await import` so the polyfill wins.
 */
const proto = Map.prototype
if (typeof proto.getOrInsert !== 'function') {
  proto.getOrInsert = function (key, value) {
    if (this.has(key)) return this.get(key)
    this.set(key, value)
    return value
  }
}
if (typeof proto.getOrInsertComputed !== 'function') {
  proto.getOrInsertComputed = function (key, callback) {
    if (this.has(key)) return this.get(key)
    const value = callback(key)
    this.set(key, value)
    return value
  }
}

await import('./pdf.worker.min.mjs')
