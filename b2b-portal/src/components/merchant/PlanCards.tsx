import {
  PLAN_DEFAULTS,
  PLAN_IDS,
  RECOMMENDED_PLAN,
  annualPriceHuf,
  formatHuf,
  onPlan,
  upgradeMailto,
  type PlanId,
} from "@/lib/billing/plans";

const EXTRAS: Record<PlanId, string> = {
  start: "15 rendelő vevő / hó",
  plus: "40 rendelő vevő / hó",
  pro: "120 vevő · fotós lista · Turinova jel elrejthető",
};

export function PlanCards({
  currentPlan,
  isTrial,
  used,
  shopName,
}: {
  currentPlan: PlanId;
  isTrial: boolean;
  used: number;
  shopName?: string | null;
}) {
  return (
    <div className="flex flex-col border-2 border-text">
      {PLAN_IDS.map((id) => {
        const d = PLAN_DEFAULTS[id];
        const recommended = id === RECOMMENDED_PLAN;
        const usingNow = isTrial && id === "pro";
        const tooSmall = used > d.partnerLimit;
        return (
          <div
            key={id}
            className={
              tooSmall
                ? "flex flex-wrap items-center gap-3 border-b border-line px-4 py-4 last:border-0 opacity-50"
                : "flex flex-wrap items-center gap-3 border-b border-line px-4 py-4 last:border-0"
            }
          >
            <div className="min-w-[7rem]">
              <p className="text-[14px] font-semibold">
                {d.label}
                {recommended ? (
                  <span className="ml-2 text-[10px] font-bold uppercase text-faint">
                    Ajánlott
                  </span>
                ) : null}
              </p>
              {usingNow ? (
                <p className="text-[11px] text-faint">
                  Most a próbáján vagy. Utána {PLAN_DEFAULTS[currentPlan].label},
                  ha nem írsz.
                </p>
              ) : tooSmall ? (
                <p className="text-[11px] text-faint">
                  Ehhez a hónaphoz {d.partnerLimit} kevés.
                </p>
              ) : null}
            </div>
            <div className="min-w-[8rem]">
              <p className="text-[14px] font-semibold tabular-nums">
                {formatHuf(d.listPriceHuf)}
                <span className="text-[12px] font-medium text-faint"> / hó</span>
              </p>
              <p className="text-[11px] text-faint">
                Évesen {formatHuf(annualPriceHuf(id))} · 2 hónap ajándék
              </p>
            </div>
            <p className="flex-1 text-[13px] text-faint">{EXTRAS[id]}</p>
            <a
              href={upgradeMailto({ plan: id, shopName })}
              className={
                recommended
                  ? "tn-btn tn-btn-primary inline-flex"
                  : "inline-flex text-[13px] font-semibold underline underline-offset-4"
              }
            >
              {isTrial && used > PLAN_DEFAULTS.start.partnerLimit && id === "plus"
                ? `Tartsd a ${used} vevőt`
                : "Ezt kérem"}
            </a>
          </div>
        );
      })}
      <p className="px-4 py-3 text-[12px] text-faint">
        Bármikor válthatsz. A gyors rendelés a boltban nem áll le. Ha a rendelés
        már a céged motorja, az ERP külön — írj a hello@turinova.hu-ra.
      </p>
    </div>
  );
}

export function formatTrialEnd(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
