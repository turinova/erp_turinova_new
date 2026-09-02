import { processCustomerMirrorSyncTick } from "./customer-mirror-sync";

const INTERVAL_MS = 5 * 60 * 1000;

let started = false;
let timer: ReturnType<typeof setInterval> | null = null;

export function startCustomerMirrorSyncLoop(): void {
  if (started) return;
  if (process.env.CUSTOMER_MIRROR_LOOP === "0") return;
  started = true;

  const tick = () => {
    void processCustomerMirrorSyncTick().catch((err) =>
      console.error("[customer-mirror] tick", err),
    );
  };

  // Delayed first tick so boot / catalog has headroom on SR rate limit.
  setTimeout(tick, 45_000);
  timer = setInterval(tick, INTERVAL_MS);
}

export function stopCustomerMirrorSyncLoop(): void {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}
