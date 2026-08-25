"use client";

import { useState } from "react";
import {
  PLAN_DEFAULTS,
  PLAN_IDS,
  RECOMMENDED_PLAN,
  annualPriceHuf,
  formatHuf,
  upgradeMailto,
  type PlanId,
} from "@/lib/billing/plans";

const AUDIENCE: Record<PlanId, string> = {
  start: "Ha kevés vevő rendel.",
  plus: "Ha több vevő rendel, mint 15.",
  pro: "Ha fotóról listázol, vagy nagyon sok a vevő.",
};

const BULLETS: Record<PlanId, string[]> = {
  start: [
    "Gyors rendelés a boltban",
    "Gyors keresés, Excel, listák",
    "Vevők és egyszerű riport",
  ],
  plus: [
    "Minden, ami a Startban van",
    "40 rendelő vevő / hónap",
    "Te is látod az összes fontos vevőt",
  ],
  pro: [
    "Minden, ami a Plusban van",
    "Fotó → kész lista",
    "A Turinova jel elrejthető a boltban (fizetés után)",
  ],
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
  const [annual, setAnnual] = useState(false);

  return (
    <div>
      <div
        className="mb-6 inline-flex border-2 border-text"
        role="group"
        aria-label="Számlázás"
      >
        <button
          type="button"
          onClick={() => setAnnual(false)}
          className={
            annual
              ? "cursor-pointer px-3 py-2 text-[13px] font-semibold text-faint transition-colors duration-200 hover:bg-surface-2 hover:text-text"
              : "cursor-pointer bg-accent px-3 py-2 text-[13px] font-semibold text-white"
          }
        >
          Havi
        </button>
        <button
          type="button"
          onClick={() => setAnnual(true)}
          className={
            annual
              ? "cursor-pointer bg-accent px-3 py-2 text-[13px] font-semibold text-white"
              : "cursor-pointer px-3 py-2 text-[13px] font-semibold text-faint transition-colors duration-200 hover:bg-surface-2 hover:text-text"
          }
        >
          Éves ·{" "}
          <span className={annual ? "text-white" : "text-ok"}>2 hónap ingyen</span>
        </button>
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-3">
        {PLAN_IDS.map((id) => (
          <PlanCard
            key={id}
            id={id}
            annual={annual}
            currentPlan={currentPlan}
            isTrial={isTrial}
            used={used}
            shopName={shopName}
          />
        ))}
      </div>

      <p className="mt-4 text-[13px] text-faint">
        Több mint 120 vevő? Írj:{" "}
        <a
          href="mailto:hello@turinova.hu?subject=Egyedi%20csomag"
          className="font-semibold underline underline-offset-4"
        >
          hello@turinova.hu
        </a>
      </p>

      <h2 className="tn-section-title mt-10">Összes különbség</h2>
      <div className="mt-4 overflow-x-auto border-2 border-text">
        <table className="w-full min-w-[32rem] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-line-strong bg-surface-2">
              <th className="px-3 py-2 font-semibold"> </th>
              {PLAN_IDS.map((id) => (
                <th
                  key={id}
                  className={
                    id === RECOMMENDED_PLAN
                      ? "px-3 py-2 font-semibold"
                      : "px-3 py-2 font-semibold text-faint"
                  }
                >
                  {PLAN_DEFAULTS[id].label}
                  {id === RECOMMENDED_PLAN ? (
                    <span className="ml-2 bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      Ajánlott
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <CompareRow
              label="Ár / hó"
              cells={PLAN_IDS.map((id) => formatHuf(PLAN_DEFAULTS[id].listPriceHuf))}
            />
            <CompareRow
              label="Ár / év"
              cells={PLAN_IDS.map((id) => formatHuf(annualPriceHuf(id)))}
            />
            <CompareRow
              label="Hány vevőt látsz"
              cells={PLAN_IDS.map((id) => String(PLAN_DEFAULTS[id].partnerLimit))}
            />
            <CompareRow
              label="Gyors rendelés a boltban"
              cells={["igen", "igen", "igen"]}
            />
            <CompareRow label="Fotó → lista" cells={["nem", "nem", "igen"]} />
            <CompareRow
              label="Turinova jel elrejthető"
              cells={["nem", "nem", "igen (fizetés után)"]}
              last
            />
          </tbody>
        </table>
      </div>

      <h2 className="tn-section-title mt-10">Három kérdés</h2>
      <dl className="mt-4 space-y-5">
        <div>
          <dt className="text-[14px] font-semibold">Mi lesz a próba után?</dt>
          <dd className="tn-section-sub">{afterTrialCopy(used)}</dd>
        </div>
        <div>
          <dt className="text-[14px] font-semibold">
            Leáll a rendelés, ha nem fizetek?
          </dt>
          <dd className="tn-section-sub">
            Nem. A vevők tovább rendelnek. Te kevesebbet látsz itt.
          </dd>
        </div>
        <div>
          <dt className="text-[14px] font-semibold">Hogyan fizetek?</dt>
          <dd className="tn-section-sub">
            A gomb levelet nyit. Számlát küldünk, bekapcsoljuk. Kártyát nem
            kérünk az oldalon.
          </dd>
        </div>
      </dl>
    </div>
  );
}

function PlanCard({
  id,
  annual,
  currentPlan,
  isTrial,
  used,
  shopName,
}: {
  id: PlanId;
  annual: boolean;
  currentPlan: PlanId;
  isTrial: boolean;
  used: number;
  shopName?: string | null;
}) {
  const d = PLAN_DEFAULTS[id];
  const recommended = id === RECOMMENDED_PLAN;
  const usingNow = isTrial && id === "pro";
  const currentPaid = !isTrial && currentPlan === id;
  const tooSmall = used > d.partnerLimit;
  const price = annual ? annualPriceHuf(id) : d.listPriceHuf;
  const period = annual ? "/ év" : "/ hó";
  const href = upgradeMailto({ plan: id, shopName, annual });
  const cta = cardCta({ id, used, currentPaid });
  const greenChecks = id === "plus" || id === "pro";

  return (
    <article
      className={
        recommended
          ? "flex flex-col border-2 border-text bg-surface p-5"
          : "flex flex-col border border-line-strong p-5"
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[18px] font-semibold tracking-tight">{d.label}</h2>
        {recommended ? (
          <span className="bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Ajánlott
          </span>
        ) : null}
        {usingNow ? (
          <span className="border border-line-strong px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
            Most ezt használod
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[13px] text-faint">{AUDIENCE[id]}</p>

      <p className="mt-5 text-[28px] font-semibold leading-none tracking-tight tabular-nums">
        {formatHuf(price)}
        <span className="ml-1 text-[13px] font-medium text-faint">{period}</span>
      </p>
      <p className="mt-2 text-[15px] font-semibold tabular-nums">
        {d.partnerLimit} vevő / hónap
      </p>

      {tooSmall ? (
        <p className="mt-3 border-2 border-warn px-3 py-2 text-[13px] font-medium text-warn">
          Figyelem: Most {used} vevőd van. Ezen a csomagon csak {d.partnerLimit}
          -öt látnál.
        </p>
      ) : null}

      <ul className="mt-5 flex flex-1 flex-col gap-2">
        {BULLETS[id].map((line) => (
          <li key={line} className="flex gap-2 text-[13px]">
            <CheckIcon className={greenChecks ? "text-ok" : undefined} />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      {cta ? (
        <a
          href={href}
          className={
            recommended
              ? "tn-btn tn-btn-primary mt-6 w-full"
              : "tn-btn tn-btn-ghost mt-6 w-full"
          }
        >
          {cta}
        </a>
      ) : (
        <p className="mt-6 border border-line-strong px-3 py-2 text-center text-[13px] font-semibold">
          Ez a csomagod
        </p>
      )}
      {cta ? (
        <p className="mt-2 text-center text-[12px] text-faint">
          Levél a hello@turinova.hu-ra. Mi aktiváljuk.
        </p>
      ) : null}
    </article>
  );
}

function cardCta(opts: {
  id: PlanId;
  used: number;
  currentPaid: boolean;
}): string | null {
  if (opts.currentPaid) return null;
  if (opts.id === "plus" && opts.used > PLAN_DEFAULTS.start.partnerLimit) {
    return `Tartsd a ${opts.used} vevőt`;
  }
  if (opts.id === "start") return "Maradok a Starton";
  if (opts.id === "plus") return "Plus kell";
  return "Pro kell";
}

function afterTrialCopy(used: number): string {
  const start = PLAN_DEFAULTS.start.partnerLimit;
  const plus = PLAN_DEFAULTS.plus.partnerLimit;
  if (used <= start) {
    return `A rendelés a boltban megy tovább. A Start ${start} vevője elég ehhez a hónaphoz. A fotós lista a Starton és a Pluson kikapcsol.`;
  }
  if (used <= plus) {
    return `A rendelés a boltban megy tovább. Te viszont a Starton csak ${start} vevőt látsz, és a fotós lista kikapcsol. A Plus megtartja a ${used} vevődet.`;
  }
  return `A rendelés a boltban megy tovább. A Start ${start} vevőt tart meg, a Plus ${plus}-et a ${used}-ból. A Pro ${PLAN_DEFAULTS.pro.partnerLimit}-ig. A fotós lista csak a Pron marad.`;
}

function CompareRow({
  label,
  cells,
  last,
}: {
  label: string;
  cells: string[];
  last?: boolean;
}) {
  return (
    <tr className={last ? undefined : "border-b border-line"}>
      <th className="px-3 py-2 font-medium text-faint">{label}</th>
      {cells.map((cell, i) => (
        <td
          key={`${label}-${i}`}
          className={
            PLAN_IDS[i] === RECOMMENDED_PLAN
              ? "px-3 py-2 tabular-nums"
              : "px-3 py-2 tabular-nums text-faint"
          }
        >
          {cell}
        </td>
      ))}
    </tr>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`mt-0.5 shrink-0 ${className ?? ""}`}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
