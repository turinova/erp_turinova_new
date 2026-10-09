"use client";

import { useEffect, useRef, useState } from "react";
import {
  apiChip,
  catalogChip,
  EmbedStatusChip,
} from "@/components/sr-embed/EmbedStatusChip";
import { embedFetch } from "@/lib/shoprenter/embed-fetch";

export type EmbedBoltShop = {
  shopName: string;
  storeUrl: string | null;
  status: string;
  widgetEnabled: boolean;
  catalogStatus: string | null;
  catalogSyncedAt: string | null;
  hasCredentials: boolean;
};

type Props = { initial: EmbedBoltShop; embedToken?: string | null };

export function EmbedBoltClient({ initial, embedToken }: Props) {
  const [shop, setShop] = useState(initial);
  const [pending, setPending] = useState(false);
  const [resyncPending, setResyncPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ensuredVersion = useRef(false);

  useEffect(() => {
    if (ensuredVersion.current) return;
    if (!shop.hasCredentials || shop.status === "needs_reauth") return;
    ensuredVersion.current = true;
    void embedFetch(
      "/api/shoprenter/embed/install",
      {
        method: "POST",
        body: JSON.stringify({ action: "ensure_version" }),
      },
      embedToken,
    ).catch(() => {
      /* non-blocking */
    });
  }, [shop.hasCredentials, shop.status, embedToken]);

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
      const res = await embedFetch(
        "/api/shoprenter/embed/widget",
        {
          method: "PATCH",
          body: JSON.stringify({ widgetEnabled: next }),
        },
        embedToken,
      );
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

  async function resyncCatalog() {
    setResyncPending(true);
    setMessage(null);
    setError(null);
    try {
      const res = await embedFetch(
        "/api/shoprenter/embed/catalog/resync",
        { method: "POST", body: "{}" },
        embedToken,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Szinkron indítás sikertelen");
        return;
      }
      setShop((s) => ({
        ...s,
        catalogStatus: "pending",
        catalogSyncedAt: null,
      }));
      setMessage("Termékek újratöltése elindult — 1–2 perc.");
      setTimeout(() => setMessage(null), 4000);
    } catch {
      setError("Hálózati hiba");
    } finally {
      setResyncPending(false);
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
            Nyisd meg újra a ProGate appot a Shoprenter adminból — az
            összekötés automatikusan helyreáll.
          </p>
          <button
            type="button"
            className="tn-btn tn-btn-primary mt-3"
            onClick={() => window.location.reload()}
          >
            Frissítés
          </button>
        </div>
      ) : null}

      {!catalogReady && !needsReauth ? (
        <div className="mb-6 border-[1.5px] border-warn bg-surface px-4 py-3">
          <p className="text-[13px] font-semibold text-text">
            A termékek még másolódnak
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-faint">
            A widget keresője a bolton addig nem lesz teljes. Várj egy
            percet, majd frissítsd az oldalt.
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
        <p className="mt-2 text-[12px] leading-relaxed text-faint">
          Ha a kereső régi / rövid neveket mutat, töltsd újra a termékeket a
          Shoprenterből.
        </p>
        <button
          type="button"
          className="tn-btn tn-btn-primary mt-3"
          disabled={resyncPending || needsReauth || pending}
          onClick={() => void resyncCatalog()}
        >
          {resyncPending ? "Indítás…" : "Termékek újratöltése"}
        </button>
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
