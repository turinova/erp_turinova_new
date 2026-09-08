"use client";

import { useEffect, useRef } from "react";
import { WIDGET_JS_ASSET } from "@/lib/widget/asset-version";
import {
  PREVIEW_MESSAGE_SOURCE,
  type PreviewHostMessage,
  type PreviewSandboxMessage,
} from "@/lib/widget/preview-protocol";

type DemoApi = {
  open: () => void;
  close: () => void;
  configure?: (partial: Record<string, unknown>) => void;
  ready?: () => boolean;
  isOpen?: () => boolean;
};

function getDemoApi(): DemoApi | undefined {
  return (window as Window & { SR_B2B_DEMO?: DemoApi }).SR_B2B_DEMO;
}

const PRODUCTS = [
  { name: "Króm kilincs", price: "4 120 Ft", sku: "KL-440" },
  { name: "Zár 55 mm", price: "2 490 Ft", sku: "ZR-55" },
  { name: "Ajtópánt pár", price: "1 890 Ft", sku: "AP-110" },
  { name: "Fogantyú matt", price: "5 200 Ft", sku: "HG-220" },
  { name: "Zárbetét", price: "3 650 Ft", sku: "ZB-30" },
  { name: "Ajtóütköző", price: "980 Ft", sku: "AU-02" },
] as const;

function postToParent(msg: PreviewSandboxMessage) {
  try {
    window.parent.postMessage(msg, window.location.origin);
  } catch {
    /* ignore */
  }
}

function loadDemoScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-pg-preview-widget="1"]',
    );
    if (existing && getDemoApi()) {
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

    (
      window as Window & { SR_B2B_QUICKORDER?: Record<string, unknown> }
    ).SR_B2B_QUICKORDER = {
      demo: true,
      hideFab: true,
      demoPrefill: true,
      demoAutoOpen: false,
      apiBase: "",
      shopId: "demo",
      requireLogin: false,
      buttonLabel: "Gyors rendelés",
      showTurinovaMark: true,
      showCustomerGroupName: false,
      showNextLevelProgress: false,
    };

    const script = document.createElement("script");
    script.src = `/widget.js?v=${WIDGET_JS_ASSET}`;
    script.async = true;
    script.dataset.pgPreviewWidget = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Widget script load failed"));
    document.body.appendChild(script);
  });
}

/** Fake storefront + real widget.js (demo) for iframe preview. */
export function WidgetPreviewSandbox() {
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await loadDemoScript();
        if (cancelled) return;

        const onClose = () => {
          postToParent({
            source: PREVIEW_MESSAGE_SOURCE,
            type: "panelClosed",
          });
        };
        window.addEventListener("sr-b2b-demo-close", onClose);

        const onMessage = (ev: MessageEvent) => {
          if (ev.origin !== window.location.origin) return;
          const data = ev.data as PreviewHostMessage | null;
          if (!data || data.source !== PREVIEW_MESSAGE_SOURCE) return;
          const demo = getDemoApi();

          if (data.type === "configure" && data.config) {
            demo?.configure?.(data.config as Record<string, unknown>);
            return;
          }
          if (data.type === "setPanel") {
            if (data.open) demo?.open();
            else demo?.close();
          }
        };
        window.addEventListener("message", onMessage);

        cleanupRef.current = () => {
          window.removeEventListener("sr-b2b-demo-close", onClose);
          window.removeEventListener("message", onMessage);
        };

        postToParent({ source: PREVIEW_MESSAGE_SOURCE, type: "ready" });
      } catch {
        postToParent({
          source: PREVIEW_MESSAGE_SOURCE,
          type: "error",
          message: "A widget előnézet nem töltődött be.",
        });
      }
    })();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        margin: 0,
        background: "#F7F7F5",
        color: "#111",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        overflow: "auto",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          height: 48,
          padding: "0 16px",
          borderBottom: "1px solid rgba(0,0,0,.1)",
          background: "#fff",
        }}
      >
        <strong style={{ fontSize: 14 }}>Minta bolt</strong>
        <nav style={{ display: "flex", gap: 16, fontSize: 12, color: "#5C5C5C" }}>
          <span>Termékek</span>
          <span>Akció</span>
          <span>Kapcsolat</span>
        </nav>
        <span style={{ fontSize: 12, color: "#5C5C5C" }}>Kosár (2)</span>
      </header>

      <div style={{ padding: "20px 16px 96px" }}>
        <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700 }}>
          Nagyker árak a viszonteladóknak
        </p>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#8A8A8A" }}>
          Belépés után partnerár a bolton — előnézet mintaadatokkal
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 12,
          }}
        >
          {PRODUCTS.map((p) => (
            <article
              key={p.sku}
              style={{
                border: "1px solid rgba(0,0,0,.1)",
                background: "#fff",
                padding: 12,
              }}
            >
              <div
                style={{
                  height: 72,
                  marginBottom: 8,
                  background: "rgba(0,0,0,.06)",
                }}
              />
              <strong style={{ display: "block", fontSize: 13 }}>{p.name}</strong>
              <small style={{ color: "#8A8A8A", fontSize: 11 }}>{p.sku}</small>
              <b style={{ display: "block", marginTop: 6, fontSize: 13 }}>
                {p.price}
              </b>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
