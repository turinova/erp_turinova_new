/**
 * Intentionally empty.
 * Catalog sync loop starts on first DB use (see getPool) — importing `pg`
 * from instrumentation makes webpack try to bundle Node `fs`/`tls`.
 */
export async function register() {}
