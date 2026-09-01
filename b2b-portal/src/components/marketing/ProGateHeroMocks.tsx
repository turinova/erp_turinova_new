"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WIDGET_JS_ASSET } from "@/lib/widget/asset-version";

type Phase = "shop" | "press" | "open";
type DemoState = "idle" | "loading" | "live";

const PRODUCTS = [
  { name: "Króm kilincs", price: "4 120 Ft", sku: "KL-440" },
  { name: "Zár 55 mm", price: "2 490 Ft", sku: "ZR-55" },
  { name: "Ajtópánt pár", price: "1 890 Ft", sku: "AP-110" },
  { name: "Fogantyú matt", price: "5 200 Ft", sku: "HG-220" },
  { name: "Zárbetét", price: "3 650 Ft", sku: "ZB-30" },
  { name: "Ajtóütköző", price: "980 Ft", sku: "AU-02" },
] as const;

declare global {
  interface Window {
    SR_B2B_QUICKORDER?: Record<string, unknown>;
    SR_B2B_DEMO?: {
      open: () => void;
      close: () => void;
      isDemo?: boolean;
    };
  }
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function loadDemoWidgetScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-pg-demo-widget="1"]',
    );
    if (existing && window.SR_B2B_DEMO?.open) {
      resolve();
      return;
    }
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Widget script load failed")),
        { once: true },
      );
      return;
    }

    window.SR_B2B_QUICKORDER = {
      demo: true,
      hideFab: true,
      demoPrefill: true,
      demoAutoOpen: false,
      apiBase: "",
      shopId: "demo",
      requireLogin: false,
      buttonLabel: "Gyors rendelés",
      showTurinovaMark: true,
      showCustomerGroupName: true,
      showNextLevelProgress: true,
      onDemoClose: () => {
        window.dispatchEvent(new CustomEvent("sr-b2b-demo-close"));
      },
    };

    const script = document.createElement("script");
    script.src = `/widget.js?v=${WIDGET_JS_ASSET}`;
    script.async = true;
    script.dataset.pgDemoWidget = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Widget script load failed"));
    document.body.appendChild(script);
  });
}

/** Hero: shop teaser + CTA → real widget.js demo with seed data. */
export function ProGateHeroMocks() {
  const [phase, setPhase] = useState<Phase>("shop");
  const [demo, setDemo] = useState<DemoState>("idle");
  const [error, setError] = useState<string | null>(null);
  const loopPaused = useRef(false);

  useEffect(() => {
    const onClose = () => {
      setDemo("idle");
      loopPaused.current = false;
      setPhase("shop");
    };
    window.addEventListener("sr-b2b-demo-close", onClose);
    return () => window.removeEventListener("sr-b2b-demo-close", onClose);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loop = async () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        setPhase("shop");
        return;
      }

      while (!cancelled) {
        if (loopPaused.current) {
          await wait(400);
          continue;
        }
        setPhase("shop");
        await wait(2600);
        if (cancelled || loopPaused.current) continue;
        setPhase("press");
        await wait(380);
        if (cancelled || loopPaused.current) continue;
        setPhase("open");
        await wait(3200);
      }
    };

    void loop();
    return () => {
      cancelled = true;
    };
  }, []);

  const openLiveDemo = useCallback(async () => {
    setError(null);
    loopPaused.current = true;
    setDemo("loading");
    try {
      try {
        sessionStorage.removeItem("sr-b2b-qo-draft-v1");
      } catch {
        /* ignore */
      }
      await loadDemoWidgetScript();
      await wait(80);
      if (!window.SR_B2B_DEMO?.open) {
        throw new Error("A demó nem indult el");
      }
      window.SR_B2B_DEMO.open();
      setDemo("live");
    } catch (e) {
      setDemo("idle");
      loopPaused.current = false;
      setError(e instanceof Error ? e.message : "Demó betöltési hiba");
    }
  }, []);

  return (
    <div
      className={`pg-hero-visual pg-hm-stage is-${phase}${demo === "live" ? " is-demo-live" : ""}`}
    >
      <div className="pg-hm-shop" aria-hidden={demo === "live"}>
        <div className="pg-hm-browser">
          <span />
          <span />
          <span />
          <em>vasalat.hu — partner belépve</em>
        </div>
        <div className="pg-hm-store">
          <header className="pg-hm-store-bar">
            <strong>Vasalat Bolt</strong>
            <nav>
              <span>Termékek</span>
              <span>Akció</span>
              <span>Kapcsolat</span>
            </nav>
            <span className="pg-hm-cart-ico">Kosár (2)</span>
          </header>
          <div className="pg-hm-store-hero">
            <p>Nagyker árak a viszonteladóknak</p>
            <span>Belépés után partnerár a bolton</span>
          </div>
          <div className="pg-hm-grid">
            {PRODUCTS.map((p) => (
              <article key={p.sku} className="pg-hm-card">
                <div className="pg-hm-card-img" />
                <strong>{p.name}</strong>
                <small>{p.sku}</small>
                <b>{p.price}</b>
              </article>
            ))}
          </div>
        </div>

        <div className={`pg-hm-fab${phase === "press" ? " is-press" : ""}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Gyors rendelés
        </div>
      </div>

      {/* Static teaser widget (animation only) */}
      <div className="pg-hm-widget pg-hm-widget--teaser" aria-hidden>
        <div className="pg-hm-topbar">
          <div className="pg-hm-brand">
            <span className="pg-hm-mark" />
            <strong>Gyors rendelés</strong>
            <span className="pg-hm-teaser-pill">Előnézet</span>
          </div>
          <nav className="pg-hm-nav">
            <span className="is-on">Új megrendelés</span>
            <span>Listáim</span>
          </nav>
          <span className="pg-hm-close">Kilépés</span>
        </div>
        <div className="pg-hm-teaser-body">
          <p className="pg-hm-teaser-lead">
            Partnerár · Excel / fotó · kosár a meglévő bolton
          </p>
          <div className="pg-hm-teaser-rows">
            <div>
              <strong>SS11</strong>
              <span>41 Ft</span>
            </div>
            <div>
              <strong>F014</strong>
              <span>1 739 Ft</span>
            </div>
            <div>
              <strong>HG-220</strong>
              <span>2 880 Ft</span>
            </div>
          </div>
          <div className="pg-hm-teaser-cta">Kosárba rakom · 39 132 Ft</div>
        </div>
      </div>

      {/* Primary CTA — opens real widget demo */}
      {demo !== "live" ? (
        <div className="pg-hm-cta-layer">
          <button
            type="button"
            className={`pg-hm-demo-cta${demo === "loading" ? " is-loading" : ""}`}
            onClick={() => void openLiveDemo()}
            disabled={demo === "loading"}
          >
            <span className="pg-hm-demo-cta-kicker">Élő demó · mintaadatok</span>
            <span className="pg-hm-demo-cta-title">
              {demo === "loading"
                ? "Demó betöltése…"
                : "Kattints ide — így látja a B2B partnered"}
            </span>
            <span className="pg-hm-demo-cta-sub">
              Valódi gyors rendelés · partnerár · megtakarítás · nincs regisztráció
            </span>
          </button>
          {error ? <p className="pg-hm-demo-error">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
