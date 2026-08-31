"use client";

import { useState } from "react";
import {
  BASE_PRICE_HUF,
  MARK_ADDON_HUF,
  WHITE_LABEL_PRICE_HUF,
  annualPriceHuf,
  formatHuf,
  formatPlanPrice,
  hasWhiteLabel,
  upgradeMailto,
  type PlanId,
} from "@/lib/billing/plans";

export function PlanCards({
  currentPlan,
  isTrial,
  shopName,
}: {
  currentPlan: PlanId;
  isTrial: boolean;
  used?: number;
  shopName?: string | null;
}) {
  const [annual, setAnnual] = useState(false);
  const alreadyWhiteLabel = !isTrial && hasWhiteLabel(currentPlan);
  const onBasePaid = !isTrial && currentPlan === "start";
  const [wantMarkOff, setWantMarkOff] = useState(alreadyWhiteLabel);

  const selectedPlan: PlanId = wantMarkOff ? "plus" : "start";
  const monthly = wantMarkOff ? WHITE_LABEL_PRICE_HUF : BASE_PRICE_HUF;
  const price = annual ? monthly * 10 : monthly;
  const period = annual ? "/ év" : "/ hó";
  const href = upgradeMailto({ plan: selectedPlan, shopName, annual });
  const isCurrent =
    !isTrial &&
    ((wantMarkOff && alreadyWhiteLabel) || (!wantMarkOff && onBasePaid));

  return (
    <div className="max-w-xl">
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
              ? "cursor-pointer px-3 py-2 text-[13px] font-semibold text-faint hover:bg-surface-2 hover:text-text"
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
              : "cursor-pointer px-3 py-2 text-[13px] font-semibold text-faint hover:bg-surface-2 hover:text-text"
          }
        >
          Éves ·{" "}
          <span className={annual ? "text-white" : "text-ok"}>
            2 hónap kedvezmény
          </span>
        </button>
      </div>

      <article className="border-2 border-text bg-surface p-5">
        <h2 className="text-[18px] font-semibold tracking-tight">
          Gyors rendelés
        </h2>

        <p className="mt-5 text-[28px] font-semibold leading-none tracking-tight tabular-nums">
          {formatHuf(price)}
          <span className="ml-1 text-[13px] font-medium text-faint">
            {period} · bruttó
          </span>
        </p>
        {!wantMarkOff ? (
          <p className="mt-2 text-[13px] text-faint">
            Turinova felirattal · {formatPlanPrice(BASE_PRICE_HUF)} / hó
            {annual
              ? ` · évesen ${formatPlanPrice(annualPriceHuf("start"))}`
              : ""}
          </p>
        ) : (
          <p className="mt-2 text-[13px] text-faint">
            Saját márka · {formatPlanPrice(WHITE_LABEL_PRICE_HUF)} / hó (
            {formatPlanPrice(BASE_PRICE_HUF)} + {formatPlanPrice(MARK_ADDON_HUF)})
            {annual
              ? ` · évesen ${formatPlanPrice(annualPriceHuf("plus"))}`
              : ""}
          </p>
        )}

        <label className="mt-5 flex cursor-pointer items-start gap-3 border-[1.5px] border-line-strong bg-surface-2 p-3">
          <input
            type="checkbox"
            className="mt-0.5 accent-[var(--accent)]"
            checked={wantMarkOff}
            disabled={alreadyWhiteLabel && !isTrial}
            onChange={(e) => setWantMarkOff(e.target.checked)}
          />
          <span className="text-[13px] leading-relaxed">
            <span className="font-semibold">
              Saját márka — Turinova felirat nélkül (
              {formatPlanPrice(WHITE_LABEL_PRICE_HUF)} / hó)
            </span>
            <span className="mt-0.5 block text-[12px] text-faint">
              A widget panelén nem jelenik meg a Turinova logó (automatikusan,
              amint bekapcsoljuk a csomagot). Próba alatt a felirat mindig
              látszik.
            </span>
          </span>
        </label>

        {isCurrent ? (
          <p className="mt-6 border border-line-strong px-3 py-2 text-center text-[13px] font-semibold">
            Ez a jelenlegi előfizetésed
          </p>
        ) : (
          <>
            <a href={href} className="tn-btn tn-btn-primary mt-6 w-full">
              Ezt választom
            </a>
            <p className="mt-2 text-center text-[12px] text-faint">
              A gomb egy e-mailt nyit. Számlát küldünk, és mi kapcsoljuk be.
              kártyaadat nem kell.
            </p>
          </>
        )}
      </article>
    </div>
  );
}
