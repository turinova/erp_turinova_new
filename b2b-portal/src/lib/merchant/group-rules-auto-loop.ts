import { processGroupRulesAutoTick } from "@/lib/merchant/group-rules-auto";

declare global {
  // eslint-disable-next-line no-var
  var __b2bGroupRulesAutoLoop:
    | { timer?: ReturnType<typeof setInterval> }
    | undefined;
}

/** Local/dev: check often enough that due shops run within the day. */
const TICK_MS = 5 * 60_000;

export function startGroupRulesAutoLoop(): void {
  if (process.env.SYNC_WORKER_DISABLED === "1") return;
  if (process.env.VERCEL) return;
  if (global.__b2bGroupRulesAutoLoop?.timer) return;

  global.__b2bGroupRulesAutoLoop = {};
  void processGroupRulesAutoTick();
  global.__b2bGroupRulesAutoLoop.timer = setInterval(() => {
    void processGroupRulesAutoTick();
  }, TICK_MS);
  if (global.__b2bGroupRulesAutoLoop.timer.unref) {
    global.__b2bGroupRulesAutoLoop.timer.unref();
  }
}
