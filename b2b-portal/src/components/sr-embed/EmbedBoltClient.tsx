"use client";

import { useState } from "react";
import {
  apiChip,
  catalogChip,
  EmbedStatusChip,
} from "@/components/sr-embed/EmbedStatusChip";

export type EmbedBoltShop = {
  shopName: string;
  storeUrl: string | null;
  status: string;
  widgetEnabled: boolean;
  catalogStatus: string | null;
  catalogSyncedAt: string | null;
  hasCredentials: boolean;
};

type Props = { initial: EmbedBoltShop };

export function EmbedBoltClient({ initial }: Props) {
  const [shop, setShop] = useState(initial);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const api = apiChip({
    hasCredentials: shop.hasCredentials,
    status: shop.status,
  });
  const catalog = catalogChip(shop.catalogStatus);
  const catalogReady =
    (shop.catalogStatus || "").toLowerCase() === "ready" ||
    (shop.catalogStatus || "").toLowerCase() === "synced";
  const needsReauth =
    shop.status === "needs_reauth" || !shop.hasCredentials;

  async function toggleWidget(next: boolean) {
    setPending(true);
    setMessage(null);
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
      setMessage("Mentve");
      setTimeout(() => setMessage(null), 2000);
    } catch {
      setError("Hálózati hiba");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[920px]">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <EmbedStatusChip label="API" value={api.value} tone={api.tone} />
        <EmbedStatusChip
          label="Katalógus"
          value={catalog.value}
          tone={catalog.tone}
        />
        <EmbedStatusChip
          label="Widget"
          value={shop.widgetEnabled ? "Be" : "Ki"}
          tone={shop.widgetEnabled ? "ok" : "idle"}
        />
        {message ? (
          <span className="text-[12px] font-semibold text-accent">{message}</span>
        ) : null}
        {error ? (
          <span className="text-[12px] font-semibold text-danger">{error}</span>
        ) : null}
      </div>

      {needsReauth ? (
        <div className="mb-6 border-2 border-danger bg-surface px-4 py-3">
          <p className="text-[13px] font-semibold text-text">
            A bolt API nincs rendben
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-faint">
            Hitelesítés hiányzik vagy lejárt. Javítsd a teljes ProGate
            portálon (Beállítások).
          </p>
          <a
            href="/settings"
            target="_blank"
            rel="noreferrer"
            className="tn-btn tn-btn-primary mt-3"
          >
            Portál megnyitása
          </a>
        </div>
      ) : null}

      {!catalogReady && !needsReauth ? (
        <div className="mb-6 border-[1.5px] border-warn bg-surface px-4 py-3">
          <p className="text-[13px] font-semibold text-text">
            A termékek még másolódnak
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-faint">
            A widget keresője a bolton addig nem lesz teljes. Várj, vagy nézd
            a syncet a portálon.
          </p>
        </div>
      ) : null}

      <section className="tn-section">
        <p className="tn-label">Kapcsolat</p>
        <h2 className="tn-section-title">{shop.shopName}</h2>
        <p className="tn-section-sub">
          {shop.storeUrl ? (
            <a
              href={shop.storeUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-text underline underline-offset-2"
            >
              {shop.storeUrl.replace(/^https?:\/\//, "")}
            </a>
          ) : (
            "Nincs bolt URL a rendszerben."
          )}
        </p>
      </section>

      <section className="tn-section">
        <p className="tn-label">Widget</p>
        <h2 className="tn-section-title">Gyors rendelés a bolton</h2>
        <p className="tn-section-sub">
          Kikapcsolva a FAB és a panel nem jelenik meg a vevőknél.
        </p>
        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 accent-[var(--accent)]"
            checked={shop.widgetEnabled}
            disabled={pending}
            onChange={(e) => void toggleWidget(e.target.checked)}
          />
          <span>
            <span className="text-[13px] font-semibold text-text">
              Widget bekapcsolva
            </span>
            <span className="mt-0.5 block text-[12px] text-faint">
              Azonnal érvényes a bolton (cache után).
            </span>
          </span>
        </label>
      </section>

      <section className="tn-section">
        <p className="tn-label">Katalógus</p>
        <h2 className="tn-section-title">{catalog.value}</h2>
        <p className="tn-section-sub">
          {shop.catalogSyncedAt
            ? `Utolsó sync: ${new Date(shop.catalogSyncedAt).toLocaleString("hu-HU")}`
            : "Még nem volt sikeres sync."}
        </p>
      </section>

      <p className="mt-8 text-[12px] text-faint">
        API kulcsok és részletes sync:{" "}
        <a
          href="/settings"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-text underline underline-offset-2"
        >
          teljes ProGate portál
        </a>
        .
      </p>
    </div>
  );
}
