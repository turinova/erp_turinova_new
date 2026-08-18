import { processCatalogSyncTick } from "./runner";

declare global {
  // eslint-disable-next-line no-var
  var __b2bCatalogSyncLoop: { timer?: ReturnType<typeof setInterval> } | undefined;
}

const TICK_MS = 2_500;

export function startCatalogSyncLoop(): void {
  if (process.env.SYNC_WORKER_DISABLED === "1") return;
  // Serverless: no background interval. Force-sync still runs one tick per request.
  if (process.env.VERCEL) return;
  if (global.__b2bCatalogSyncLoop?.timer) return;

  global.__b2bCatalogSyncLoop = {};
  void processCatalogSyncTick();
  global.__b2bCatalogSyncLoop.timer = setInterval(() => {
    void processCatalogSyncTick();
  }, TICK_MS);
  if (global.__b2bCatalogSyncLoop.timer.unref) {
    global.__b2bCatalogSyncLoop.timer.unref();
  }
}

export function kickCatalogSync(): void {
  startCatalogSyncLoop();
  void processCatalogSyncTick();
}
