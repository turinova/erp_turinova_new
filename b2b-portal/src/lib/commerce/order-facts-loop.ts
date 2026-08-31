import { processOrderFactsSyncTick } from "./order-facts-sync";

declare global {
  // eslint-disable-next-line no-var
  var __b2bOrderFactsSyncLoop:
    | { timer?: ReturnType<typeof setInterval> }
    | undefined;
}

const TICK_MS = 60_000;

export function startOrderFactsSyncLoop(): void {
  if (process.env.SYNC_WORKER_DISABLED === "1") return;
  // Serverless: no background interval. Cron / kick still run one tick.
  if (process.env.VERCEL) return;
  if (global.__b2bOrderFactsSyncLoop?.timer) return;

  global.__b2bOrderFactsSyncLoop = {};
  void processOrderFactsSyncTick();
  global.__b2bOrderFactsSyncLoop.timer = setInterval(() => {
    void processOrderFactsSyncTick();
  }, TICK_MS);
  if (global.__b2bOrderFactsSyncLoop.timer.unref) {
    global.__b2bOrderFactsSyncLoop.timer.unref();
  }
}

export function kickOrderFactsSync(): void {
  startOrderFactsSyncLoop();
  void processOrderFactsSyncTick();
}
