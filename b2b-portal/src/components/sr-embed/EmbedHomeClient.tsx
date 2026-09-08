"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { InstallCapability } from "@/lib/shoprenter/install/types";
import type { ScriptInstallState } from "@/lib/shoprenter/install/types";

export type EmbedHomeShop = {
  shopName: string;
  storeUrl: string | null;
  status: string;
  widgetEnabled: boolean;
  catalogStatus: string | null;
  catalogSyncedAt: string | null;
  hasCredentials: boolean;
  publicId: string;
  orgStatus: string | null;
  trialEndsAt: string | null;
};

type Props = {
  initial: EmbedHomeShop;
  capability: InstallCapability;
  script: ScriptInstallState;
  snippets: { loader: string; legacy: string };
};

type Phase = "A" | "B" | "C" | "D" | "E";

function resolvePhase(opts: {
  scriptInstalled: boolean;
  widgetEnabled: boolean;
  catalogReady: boolean;
  needsReauth: boolean;
}): Phase {
  if (opts.needsReauth) return "E";
  if (!opts.scriptInstalled) return "A";
  if (!opts.widgetEnabled) return "B";
  if (!opts.catalogReady) return "C";
  return "D";
}

const PHASE_COPY: Record<
  Phase,
  {
    title: string;
    sub: string;
    cta: string;
    ctaKind: "install" | "enable" | "widget" | "portal";
  }
> = {
  A: {
    title: "Telepítsd a gyors rendelést a boltra",
    sub: "Egy gomb. A viszonteladók percek alatt rendelnek.",
    cta: "Telepítem a boltra",
    ctaKind: "install",
  },
  B: {
    title: "A script bent van. Kapcsold be a gombot",
    sub: "Bekapcsolás után megjelenik a bolton.",
    cta: "Bekapcsolom a gombot",
    ctaKind: "enable",
  },
  C: {
    title: "Élő a gomb. A katalógus még töltődik",
    sub: "Addig is állíthatod a kinézetet.",
    cta: "Módosítom a widgetet",
    ctaKind: "widget",
  },
  D: {
    title: "A gyors rendelés megy",
    sub: "A partnereid egy gombbal, partneráron rendelnek.",
    cta: "Módosítom a widgetet",
    ctaKind: "widget",
  },
  E: {
    title: "A bolt összekötése nincs rendben",
    sub: "Ezt a teljes ProGate portálon tudod javítani.",
    cta: "Javítom az összekötést",
    ctaKind: "portal",
  },
};

function trialLabel(trialEndsAt: string | null): string | null {
  if (!trialEndsAt) return null;
  const end = new Date(trialEndsAt).getTime();
  if (!Number.isFinite(end)) return null;
  const days = Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000));
  if (days < 0) return "A próbaidőszak lejárt";
  if (days === 0) return "A próbaidőszak ma lejár";
  if (days === 1) return "1 nap van hátra a próbaidőszakból";
  return `${days} nap van hátra a próbaidőszakból`;
}

export function EmbedHomeClient({
  initial,
  capability,
  script: scriptInitial,
  snippets,
}: Props) {
  const [shop, setShop] = useState(initial);
  const [script, setScript] = useState(scriptInitial);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeSnippet, setActiveSnippet] = useState(snippets.loader);
  const [pauseOpen, setPauseOpen] = useState(false);

  const scriptInstalled = Boolean(script.installedAt || script.method);
  const catalogReady =
    (shop.catalogStatus || "").toLowerCase() === "ready" ||
    (shop.catalogStatus || "").toLowerCase() === "synced";
  const needsReauth =
    shop.status === "needs_reauth" || !shop.hasCredentials;

  const phase = resolvePhase({
    scriptInstalled,
    widgetEnabled: shop.widgetEnabled,
    catalogReady,
    needsReauth,
  });
  const copy = PHASE_COPY[phase];
  const ready = phase === "D";
  const trial = trialLabel(shop.trialEndsAt);

  const checks = useMemo(
    () => [
      {
        id: "api",
        label: "Bolt összekötve",
        done: shop.hasCredentials && shop.status !== "needs_reauth",
      },
      {
        id: "script",
        label: "Script a bolton",
        done: scriptInstalled,
      },
      {
        id: "widget",
        label: "Gomb bekapcsolva",
        done: shop.widgetEnabled,
      },
      {
        id: "catalog",
        label: "Katalógus kész",
        done: catalogReady,
      },
    ],
    [
      shop.hasCredentials,
      shop.status,
      scriptInstalled,
      shop.widgetEnabled,
      catalogReady,
    ],
  );

  const doneCount = checks.filter((c) => c.done).length;
  const nextCheck = checks.find((c) => !c.done) ?? null;

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(activeSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Másolás sikertelen");
    }
  }

  async function runInstall() {
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/shoprenter/embed/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "install", enableWidget: true }),
      });
      const data = await res.json();
      if (data.script) setScript(data.script);
      if (data.snippets?.loader) {
        setActiveSnippet(data.snippets.loader);
      }
      if (data.result?.ok) {
        setShop((s) => ({ ...s, widgetEnabled: true }));
        setShowFallback(false);
        setMessage("Telepítve. A gomb bekapcsolva.");
        setTimeout(() => setMessage(null), 2500);
        return;
      }
      setShowFallback(true);
      setError(data.result?.error || data.error || "Telepítés sikertelen");
    } catch {
      setShowFallback(true);
      setError("Hálózati hiba");
    } finally {
      setPending(false);
    }
  }

  async function confirmManual() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/shoprenter/embed/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm_manual", enableWidget: true }),
      });
      const data = await res.json();
      if (data.script) setScript(data.script);
      if (data.result?.ok) {
        setShop((s) => ({ ...s, widgetEnabled: true }));
        setShowFallback(false);
        setMessage("Mentve. A script rögzítve.");
        setTimeout(() => setMessage(null), 2500);
        return;
      }
      setError(data.result?.error || data.error || "Nem sikerült");
    } catch {
      setError("Hálózati hiba");
    } finally {
      setPending(false);
    }
  }

  async function enableWidget() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/shoprenter/embed/widget", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgetEnabled: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Bekapcsolás sikertelen");
        return;
      }
      setShop((s) => ({ ...s, widgetEnabled: true }));
      setMessage("Gomb bekapcsolva");
      setTimeout(() => setMessage(null), 2000);
    } catch {
      setError("Hálózati hiba");
    } finally {
      setPending(false);
    }
  }

  async function toggleWidget(next: boolean) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/shoprenter/embed/widget", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgetEnabled: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Mentés sikertelen");
        return;
      }
      setShop((s) => ({ ...s, widgetEnabled: next }));
      setMessage(next ? "Gomb bekapcsolva" : "Gomb kikapcsolva");
      setTimeout(() => setMessage(null), 2000);
    } catch {
      setError("Hálózati hiba");
    } finally {
      setPending(false);
    }
  }

  function onPrimary() {
    if (copy.ctaKind === "install") {
      void runInstall();
      return;
    }
    if (copy.ctaKind === "enable") {
      void enableWidget();
    }
  }

  const primaryBtn =
    "tn-btn tn-btn-primary !h-14 w-full justify-center px-6 text-[16px] font-semibold sm:w-auto sm:min-w-[12rem]";
  const secondaryBtn =
    "tn-btn tn-btn-ghost !h-14 w-full justify-center px-6 text-[16px] font-semibold sm:w-auto sm:min-w-[12rem]";

  /* ——— Ready home (Phase D) ——— */
  if (ready) {
    return (
      <div className="mx-auto w-full max-w-[720px] px-1 pb-10">
        {message ? (
          <p className="mb-3 text-[13px] font-semibold text-accent">{message}</p>
        ) : null}
        {error ? (
          <p className="mb-3 text-[13px] font-semibold text-danger">{error}</p>
        ) : null}

        <section
          className="relative overflow-hidden border-[1.5px] border-line-strong bg-surface"
          style={{
            background:
              "linear-gradient(135deg, #FFFFFF 0%, #E8F3FC 48%, #F7F7F5 100%)",
          }}
        >
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-40"
            style={{
              background:
                "radial-gradient(circle, rgba(11,107,203,.22) 0%, transparent 70%)",
            }}
            aria-hidden
          />
          <div className="relative px-5 py-8 md:px-8 md:py-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
              Élő: {shop.shopName}
            </p>
            <h1
              className="mt-2 max-w-[22rem] text-[28px] font-semibold leading-[1.12] tracking-tight text-text md:max-w-[28rem] md:text-[34px]"
              style={{ letterSpacing: "-0.03em" }}
            >
              {copy.title}
            </h1>
            <p className="mt-2 max-w-[34rem] text-[15px] leading-snug text-muted">
              {copy.sub}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {shop.storeUrl ? (
                <a
                  href={shop.storeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={primaryBtn}
                >
                  Megnézem a boltom
                </a>
              ) : null}
              <Link href="/sr-embed/widget" className={secondaryBtn}>
                Módosítom a widgetet
              </Link>
            </div>
            {trial ? (
              <p className="mt-5 text-[13px] text-faint">
                {trial}.{" "}
                <Link
                  href="/sr-embed/elofizetes"
                  className="font-semibold text-text underline underline-offset-2"
                >
                  Előfizetés
                </Link>
              </p>
            ) : null}
          </div>
        </section>

        <div className="mt-10 border-t border-line pt-4">
          <button
            type="button"
            className="text-[12px] font-medium text-faint underline-offset-2 hover:text-text hover:underline"
            onClick={() => setPauseOpen((v) => !v)}
          >
            {pauseOpen ? "Elrejtem" : "Widget kikapcsolása"}
          </button>
          {pauseOpen ? (
            <label className="mt-3 flex max-w-md cursor-pointer items-start gap-3 border-[1.5px] border-line-strong bg-surface px-3 py-3">
              <input
                type="checkbox"
                className="mt-0.5 accent-[var(--accent)]"
                checked={shop.widgetEnabled}
                disabled={pending}
                onChange={(e) => void toggleWidget(e.target.checked)}
              />
              <span>
                <span className="block text-[13px] font-semibold text-text">
                  Gomb bekapcsolva
                </span>
                <span className="mt-0.5 block text-[12px] text-faint">
                  Kikapcsolva a gomb nem jelenik meg a vevőknél.
                </span>
              </span>
            </label>
          ) : null}
        </div>
      </div>
    );
  }

  /* ——— Setup / error home ——— */
  return (
    <div className="mx-auto w-full max-w-[640px] pb-10">
      <p className="mb-4 text-[13px] font-semibold text-faint">
        {doneCount}/{checks.length} kész
        {nextCheck ? (
          <>
            .{" "}
            <span className="text-text">Következő: {nextCheck.label}</span>
          </>
        ) : null}
      </p>

      {message ? (
        <p className="mb-3 text-[13px] font-semibold text-accent">{message}</p>
      ) : null}

      <section
        className="border-[1.5px] border-line-strong bg-surface px-5 py-7 md:px-7 md:py-9"
        style={
          phase === "E"
            ? undefined
            : {
                background:
                  "linear-gradient(160deg, #FFFFFF 0%, #F7F7F5 55%, #E8F3FC 100%)",
              }
        }
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
          {phase === "E" ? "Beavatkozás kell" : "Következő lépés"}
        </p>
        <h1
          className="mt-2 text-[26px] font-semibold leading-[1.12] tracking-tight text-text md:text-[30px]"
          style={{ letterSpacing: "-0.03em" }}
        >
          {copy.title}
        </h1>
        <p className="mt-2 max-w-[36rem] text-[15px] leading-snug text-muted">
          {copy.sub}
        </p>

        <div className="mt-7 flex flex-col gap-3">
          {copy.ctaKind === "widget" ? (
            <Link href="/sr-embed/widget" className={primaryBtn}>
              {copy.cta}
            </Link>
          ) : copy.ctaKind === "portal" ? (
            <a
              href="/settings"
              target="_blank"
              rel="noreferrer"
              className={primaryBtn}
            >
              {copy.cta}
            </a>
          ) : (
            <button
              type="button"
              className={primaryBtn}
              disabled={pending}
              onClick={() => onPrimary()}
            >
              {pending ? "..." : copy.cta}
            </button>
          )}
          {shop.storeUrl ? (
            <a
              href={shop.storeUrl}
              target="_blank"
              rel="noreferrer"
              className="text-center text-[14px] font-semibold text-faint underline-offset-2 hover:text-text hover:underline sm:text-left"
            >
              Megnézem a boltom
            </a>
          ) : null}
        </div>

        {error ? (
          <p className="mt-4 text-[13px] font-semibold text-danger">{error}</p>
        ) : null}
      </section>

      {(showFallback || (phase === "A" && capability.mode === "manual")) &&
      phase === "A" ? (
        <section className="mt-4 border-[1.5px] border-line-strong bg-surface p-4 md:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
            Script beillesztése
          </p>
          <h3 className="mt-1 text-[16px] font-semibold tracking-tight">
            {capability.oneClick
              ? "Az API nem ment. Másold be kézzel."
              : "Egy script a láblécbe"}
          </h3>
          <ol className="mt-3 list-decimal space-y-1 pl-4 text-[13px] text-faint">
            <li>
              Shoprenter → Megjelenés →{" "}
              <span className="font-semibold text-text">Téma fájlkeresztő</span>
            </li>
            <li>
              Nyisd:{" "}
              <code className="bg-surface-2 px-1 font-mono text-[11px] text-text">
                footer_scripts.tpl
              </code>
            </li>
            <li>Illeszd be → Mentés → erősítsd meg alább</li>
          </ol>
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-faint">Loader script</p>
            <button
              type="button"
              className="tn-btn tn-btn-ghost !h-8 px-2 text-[12px]"
              onClick={() => void copySnippet()}
            >
              {copied ? "Kész" : "Másol"}
            </button>
          </div>
          <pre className="mt-1 max-h-36 overflow-auto border-[1.5px] border-line-strong bg-surface-2 p-2 font-mono text-[10px] leading-relaxed text-faint whitespace-pre-wrap">
            {activeSnippet}
          </pre>
          <button
            type="button"
            className="tn-btn tn-btn-primary mt-3 !h-12 w-full justify-center text-[15px] font-semibold"
            disabled={pending}
            onClick={() => void confirmManual()}
          >
            Kész, beillesztettem
          </button>
        </section>
      ) : null}
    </div>
  );
}
