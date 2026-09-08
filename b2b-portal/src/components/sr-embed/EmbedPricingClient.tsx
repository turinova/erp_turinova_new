"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { COMPANY } from "@/lib/company";
import {
  annualListNet,
  dealNet as calcDeal,
  type EmbedPricingConfig,
} from "@/lib/billing/embed-pricing";
import { formatHuf } from "@/lib/billing/plans";

const FEATURES = [
  "Partnerár a bolton, gyors rendeléssel",
  "Excel, fotó és mentett listák",
  "Kezdőlap, korábbi rendelések, javaslatok",
  "Gomb színe, felirata és helye",
  "Csoportnév és következő partner szint",
  "Súgó és e-mailes segítség",
] as const;

const FAQ_ITEMS = [
  {
    q: "Mi történik, ha lejár a próbaidőszakom?",
    a: "El kell döntened, hogy előfizetsz-e a ProGate-re vagy sem. Előbbi esetben minden megy tovább a rendes kerékvágásban, míg utóbbi esetben leállítjuk a ProGate-et a webshopodban.",
  },
  {
    q: "Hogyan működik a fizetés?",
    a: "A fenti gombokra kattintva bankkártyád segítségével fogod tudni beállítani a biztonságos, automatikus fizetési rendszert, amit a ShopRenter és a Barion szolgáltat. A legelső havi/éves díj most azonnal levonódik, a következő terhelés pedig havi/éves előfizetéstől függően 30 nap múlva / következő évben. Előfizetés után meg fog jelenni egy Számlázás menüpont is, ahol pontosan fogod látni a következő terhelés és számla időszakát.",
  },
  {
    q: "Mikor kapom meg a számlát?",
    a: "A sikeres bankkártyás fizetés (vagy az átutalásos megrendelés) után a rendszer automatikusan kiállítja és e-mailben elküldi a számlát.",
  },
  {
    q: "Hol találom a számlát?",
    a: "A számlázási adatoknál megadott e-mailcímedre érkezik (shoprenter@szamlazz.hu), illetve az előfizetés után a Számlázás menüpontban is követheted.",
  },
  {
    q: "Lehet átutalással is fizetni?",
    a: "Igen, de csak éves előfizetésnél. Havi előfizetésnél bankkártyás fizetés érhető el a Barionon keresztül.",
  },
  {
    q: "Bármikor le lehet mondani?",
    a: "Igen. Az előfizetéshez nem tartozik hűségidő; bármikor felmondható. Írj nekünk e-mailt, vagy végső esetben töröld a ProGate alkalmazást.",
  },
  {
    q: "Elveszik a próbaidőszakom, ha hamarabb előfizetek?",
    a: "Nem. Ha a próba alatt fizetsz elő, az előfizetés a próbaidőszak lejártával indul. A próba nem rövidül meg.",
  },
] as const;

type Props = {
  shopName: string;
  orgStatus: string | null;
  trialEndsAt: string | null;
  pricing: EmbedPricingConfig;
  billingEnabled: boolean;
};

function trialLabel(
  orgStatus: string | null,
  trialEndsAt: string | null,
  trialDays: number,
) {
  const status = (orgStatus || "").toLowerCase();
  const trialEnd = trialEndsAt ? new Date(trialEndsAt) : null;
  const valid = trialEnd != null && !Number.isNaN(trialEnd.getTime());
  const expired = valid && trialEnd! < new Date();
  const daysLeft =
    valid && !expired
      ? Math.max(
          0,
          Math.ceil((trialEnd!.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
        )
      : null;

  if (expired || status === "suspended") {
    return {
      tone: "warn" as const,
      label: expired ? "Lejárt a próbaidőszak" : "Felfüggesztve",
    };
  }
  if (status === "trial" || daysLeft != null) {
    if (daysLeft === 0) return { tone: "trial" as const, label: "Ma lejár a próbaidő" };
    if (daysLeft === 1)
      return { tone: "trial" as const, label: "Holnap lejár a próbaidő" };
    if (daysLeft != null)
      return { tone: "trial" as const, label: `Próba: még ${daysLeft} nap` };
    return { tone: "trial" as const, label: `${trialDays} napos próba` };
  }
  return { tone: "ok" as const, label: "Aktív előfizetés" };
}

export function EmbedPricingClient({
  shopName,
  orgStatus,
  trialEndsAt,
  pricing,
  billingEnabled,
}: Props) {
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = useMemo(
    () => trialLabel(orgStatus, trialEndsAt, pricing.trialDays),
    [orgStatus, trialEndsAt, pricing.trialDays],
  );

  const monthlyNet = pricing.monthlyListNet;
  const campaignPct = pricing.campaignPct;
  const annualList = annualListNet(monthlyNet);
  const monthlyDeal = calcDeal(monthlyNet, campaignPct);
  const annualDeal = calcDeal(annualList, campaignPct);

  const listPrice = annual ? annualList : monthlyNet;
  const dealPrice = annual ? annualDeal : monthlyDeal;
  const discountAmount = listPrice - dealPrice;
  const periodShort = annual ? "/ év" : "/ hó";
  const listPeriodLabel = annual ? "Eredeti éves ár" : "Eredeti havi ár";

  const mailto = `mailto:${COMPANY.emails.support}?subject=${encodeURIComponent(
    `ProGate előfizetés (${shopName}, ${annual ? "éves" : "havi"})`,
  )}&body=${encodeURIComponent(
    [
      "Szia!",
      "",
      "Szeretnék előfizetni a ProGate-re.",
      `Bolt: ${shopName}`,
      `Számlázás: ${annual ? "éves" : "havi"} (−${campaignPct}%)`,
      `Nettó: ${formatHuf(dealPrice)} + áfa ${periodShort}`,
      "",
      "Köszi!",
    ].join("\n"),
  )}`;

  async function onChoose() {
    setError(null);
    if (!billingEnabled) {
      window.location.href = mailto;
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/shoprenter/embed/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annual }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        mode?: string;
        confirmationUrl?: string | null;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Nem sikerült elindítani a fizetést");
        return;
      }
      if (data.mode === "mailto" || !data.confirmationUrl) {
        window.location.href = mailto;
        return;
      }
      window.location.href = data.confirmationUrl;
    } catch {
      setError("Hálózati hiba");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[820px] pb-12">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h1
          className="text-[28px] font-semibold leading-none tracking-tight text-text md:text-[34px]"
          style={{ letterSpacing: "-0.03em" }}
        >
          Árak és csomagok
        </h1>
        <span
          className={
            status.tone === "warn"
              ? "inline-flex border-2 border-warn px-3 py-1.5 text-[12px] font-bold text-warn"
              : status.tone === "trial"
                ? "inline-flex border-2 border-text bg-text px-3 py-1.5 text-[12px] font-bold text-white"
                : "inline-flex border-2 border-ok px-3 py-1.5 text-[12px] font-bold text-ok"
          }
        >
          {status.label}
        </span>
      </header>

      <section
        className="relative mb-6 overflow-hidden px-5 py-6 text-white md:px-8 md:py-7"
        style={{
          background:
            "linear-gradient(125deg, #042A4A 0%, #0B6BCB 42%, #1A9B8E 78%, #0F7B6C 100%)",
          boxShadow: "0 18px 40px rgba(11, 107, 203, 0.28)",
        }}
      >
        <div
          className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full opacity-50"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,.35) 0%, transparent 68%)",
          }}
          aria-hidden
        />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 max-w-xl">
            <span className="inline-flex border border-white/40 bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em]">
              Induló kedvezmény
            </span>
            <h2
              className="mt-3 text-[24px] font-semibold leading-[1.15] tracking-tight md:text-[30px]"
              style={{ letterSpacing: "-0.03em" }}
            >
              Fizess elő {campaignPct}% kedvezménnyel
            </h2>
          </div>
          <div className="shrink-0 border border-white/25 bg-black/25 px-4 py-3 md:text-right">
            <p
              className="text-[36px] font-semibold leading-none tracking-tight text-[#FFE08A] tabular-nums md:text-[40px]"
              style={{ letterSpacing: "-0.04em" }}
            >
              {formatHuf(dealPrice)}
            </p>
            <p className="mt-1 text-[13px] text-white/85">+ áfa {periodShort}</p>
          </div>
        </div>
      </section>

      <div className="mb-5 flex justify-center">
        <div
          className="inline-flex border-2 border-text bg-surface p-1"
          role="group"
          aria-label="Számlázás"
        >
          <button
            type="button"
            onClick={() => setAnnual(true)}
            className={
              annual
                ? "min-h-11 cursor-pointer bg-accent px-4 text-[14px] font-semibold text-white md:px-5"
                : "min-h-11 cursor-pointer px-4 text-[14px] font-semibold text-faint hover:text-text md:px-5"
            }
          >
            Éves előfizetés (−{campaignPct}%)
          </button>
          <button
            type="button"
            onClick={() => setAnnual(false)}
            className={
              !annual
                ? "min-h-11 cursor-pointer bg-accent px-4 text-[14px] font-semibold text-white md:px-5"
                : "min-h-11 cursor-pointer px-4 text-[14px] font-semibold text-faint hover:text-text md:px-5"
            }
          >
            Havi előfizetés (−{campaignPct}%)
          </button>
        </div>
      </div>

      <article className="mx-auto max-w-md border-2 border-text bg-surface">
        <div className="px-5 py-6 md:px-6">
          <h2 className="text-[20px] font-semibold tracking-tight text-text">
            ProGate
          </h2>

          <p className="mt-5 text-[14px] text-faint">
            {listPeriodLabel}:{" "}
            <span className="line-through tabular-nums text-muted">
              {formatHuf(listPrice)}
            </span>
          </p>
          <p className="mt-1 text-[14px] font-semibold text-ok tabular-nums">
            Kedvezmény ({campaignPct}%): −{formatHuf(discountAmount)}
          </p>

          <p
            className="mt-4 text-[44px] font-semibold leading-none tracking-tight text-[#C9A227] tabular-nums md:text-[48px]"
            style={{ letterSpacing: "-0.045em" }}
          >
            {formatHuf(dealPrice)}
          </p>
          <p className="mt-1 text-[14px] font-medium text-faint">
            + áfa {periodShort}
          </p>

          <button
            type="button"
            disabled={pending}
            onClick={() => void onChoose()}
            className="tn-btn tn-btn-primary mt-6 !h-12 w-full justify-center text-[15px] font-semibold"
          >
            {pending ? "..." : "Ezt választom"}
          </button>
          {error ? (
            <p className="mt-3 text-center text-[13px] font-semibold text-danger">
              {error}
            </p>
          ) : null}
          <p className="mt-3 text-center text-[12px] text-faint">
            {billingEnabled
              ? "ShopRenter · Barion · Bármikor lemondható"
              : "Egyelőre e-mailes előfizetés · később Barion"}
          </p>
        </div>

        <ul className="space-y-2.5 border-t border-line-strong px-5 py-5 md:px-6">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-[14px] text-text">
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center bg-ok text-[11px] font-bold text-white"
                aria-hidden
              >
                ✓
              </span>
              <span className="leading-snug">{f}</span>
            </li>
          ))}
        </ul>
      </article>

      <p className="mt-5 text-center text-[12px] text-faint">
        A csomagválasztással elfogadod az{" "}
        <a
          href="/aszf"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-text"
        >
          ÁSZF-et
        </a>{" "}
        és az{" "}
        <a
          href="/adatkezeles"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-text"
        >
          Adatvédelmi nyilatkozatot
        </a>
        .
      </p>

      <section className="mt-10 border-t border-line-strong pt-8">
        <h3
          className="text-[22px] font-semibold tracking-tight text-text"
          style={{ letterSpacing: "-0.02em" }}
        >
          Gyakran ismételt kérdések
        </h3>
        <div className="mt-4 border-t border-line-strong" role="list">
          {FAQ_ITEMS.map((item, i) => {
            const open = openFaq === i;
            return (
              <div
                key={item.q}
                className="border-b border-line-strong"
                role="listitem"
              >
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenFaq(open ? null : i)}
                  className="flex w-full cursor-pointer items-start gap-3 py-3.5 text-left"
                >
                  <span
                    className="mt-0.5 shrink-0 text-faint transition-transform duration-150"
                    style={{ transform: open ? "rotate(90deg)" : undefined }}
                    aria-hidden
                  >
                    <svg
                      viewBox="64 64 896 896"
                      width="12"
                      height="12"
                      fill="currentColor"
                    >
                      <path d="M765.7 486.8L314.9 134.7A7.97 7.97 0 00302 141v77.3c0 4.9 2.3 9.6 6.1 12.6l360 281.1-360 281.1c-3.9 3-6.1 7.7-6.1 12.6V883c0 6.7 7.7 10.4 12.9 6.3l450.8-352.1a31.96 31.96 0 000-50.4z" />
                    </svg>
                  </span>
                  <span className="text-[15px] font-semibold leading-snug text-text">
                    {item.q}
                  </span>
                </button>
                {open ? (
                  <div className="pb-4 pl-[27px] pr-1">
                    <p className="text-[14px] leading-relaxed text-muted">
                      {item.a}
                    </p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <p className="mt-8 text-center text-[12px] text-faint">
        <Link href="/sr-embed" className="underline underline-offset-2 hover:text-text">
          Kezdőlap
        </Link>
        {" · "}
        <Link
          href="/sr-embed/szamlazas"
          className="underline underline-offset-2 hover:text-text"
        >
          Számlázás
        </Link>
      </p>
    </div>
  );
}
