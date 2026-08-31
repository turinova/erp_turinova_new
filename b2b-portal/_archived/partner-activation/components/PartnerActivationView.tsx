"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildLaunchPartnerEmail,
  normalizeMarketingProfile,
  resolveShopDisplayName,
  resolveShopUrl,
  type MarketingProfile,
  type PartnerActivationDto,
} from "@/lib/merchant/partner-activation";

function CopyButton({
  label,
  text,
  onCopied,
}: {
  label: string;
  text: string;
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopied?.();
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="inline-flex h-8 cursor-pointer items-center border-[1.5px] border-line-strong bg-surface px-2.5 text-[11px] font-semibold text-text hover:border-text"
    >
      {copied ? "Másolva" : label}
    </button>
  );
}

export function PartnerActivationView({
  initial,
}: {
  initial: PartnerActivationDto;
}) {
  const [data, setData] = useState(initial);
  const [profile, setProfile] = useState<MarketingProfile>(initial.profile);
  const [previewMobile, setPreviewMobile] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "err">(
    "idle",
  );
  const [ackPending, setAckPending] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shopName = resolveShopDisplayName(profile, data.shopName);
  const shopUrl = resolveShopUrl(profile, data.shopUrl);

  const email = useMemo(
    () =>
      buildLaunchPartnerEmail({
        shopName,
        shopUrl,
        buttonLabel: data.buttonLabel,
        logoUrl: profile.logoUrl,
        signature: profile.signature,
      }),
    [shopName, shopUrl, data.buttonLabel, profile.logoUrl, profile.signature],
  );

  const persist = useCallback(async (next: MarketingProfile) => {
    setSaveState("saving");
    try {
      const res = await fetch("/api/merchant/partner-activation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Mentés sikertelen");
      const act = json.activation as PartnerActivationDto;
      setData(act);
      setProfile(act.profile);
      setSaveState("saved");
    } catch {
      setSaveState("err");
    }
  }, []);

  function patchProfile(patch: Partial<MarketingProfile>) {
    setProfile((p) => {
      const next = normalizeMarketingProfile({ ...p, ...patch });
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void persist(next), 600);
      return next;
    });
  }

  function patchSignature(patch: Partial<MarketingProfile["signature"]>) {
    setProfile((p) => {
      const next = normalizeMarketingProfile({
        ...p,
        signature: { ...p.signature, ...patch },
      });
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void persist(next), 600);
      return next;
    });
  }

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  async function acknowledgeSent() {
    setAckPending(true);
    try {
      const res = await fetch("/api/merchant/partner-activation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledgeLaunchEmail: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Hiba");
      const act = json.activation as PartnerActivationDto;
      setData(act);
      setProfile(act.profile);
    } finally {
      setAckPending(false);
    }
  }

  const checklist = [
    {
      label: "Widget bekapcsolva a boltban",
      done: data.widgetEnabled,
      href: "/widget",
    },
    {
      label: "Partnerár vagy mennyiségi sáv",
      done: data.hasPricing,
      href: "/arak",
    },
    {
      label: "Katalógus kész (kereső működik)",
      done: data.catalogReady,
      href: "/settings",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-text">
            Partnerek aktiválása
          </h1>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-faint">
            Értesítsd meglévő nagyker partnereidet: cikkszámra gyorsabban
            rendelhetnek. Másold ki az emailt, és küldd Shoprenter hírlevélből
            vagy saját leveleződből.
          </p>
        </div>
        <div className="rounded-none border-[1.5px] border-line-strong bg-surface px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">
            Widget rendelés · e hónap
          </p>
          <p className="mt-0.5 text-[22px] font-semibold tabular-nums text-text">
            {data.widgetOrdersMonth}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,1fr)]">
        <section className="space-y-4">
          <div className="border-[1.5px] border-line-strong bg-surface p-4">
            <h2 className="text-[13px] font-semibold text-text">
              Email adatok
            </h2>
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="text-[11px] font-semibold text-muted">
                  Bolt neve (emailben)
                </span>
                <input
                  type="text"
                  className="mt-1 w-full border-[1.5px] border-line-strong bg-bg px-2.5 py-2 text-[13px] outline-none focus:border-text"
                  value={profile.shopNameOverride}
                  placeholder={data.shopName}
                  onChange={(e) =>
                    patchProfile({ shopNameOverride: e.target.value })
                  }
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-muted">
                  Bolthoz link
                </span>
                <input
                  type="url"
                  className="mt-1 w-full border-[1.5px] border-line-strong bg-bg px-2.5 py-2 text-[13px] outline-none focus:border-text"
                  value={profile.shopUrlOverride}
                  placeholder={data.shopUrl ?? "https://…"}
                  onChange={(e) =>
                    patchProfile({ shopUrlOverride: e.target.value })
                  }
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-muted">
                  Logo URL (https)
                </span>
                <input
                  type="url"
                  className="mt-1 w-full border-[1.5px] border-line-strong bg-bg px-2.5 py-2 text-[13px] outline-none focus:border-text"
                  value={profile.logoUrl}
                  placeholder="https://boltod.hu/…/logo.png"
                  onChange={(e) => patchProfile({ logoUrl: e.target.value })}
                />
                <p className="mt-1 text-[11px] text-faint">
                  A boltod nyilvános logo címe. Ha üres, nincs kép az emailben.
                </p>
              </label>
            </div>
          </div>

          <div className="border-[1.5px] border-line-strong bg-surface p-4">
            <h2 className="text-[13px] font-semibold text-text">Aláírás</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-[11px] font-semibold text-muted">Név</span>
                <input
                  type="text"
                  className="mt-1 w-full border-[1.5px] border-line-strong bg-bg px-2.5 py-2 text-[13px] outline-none focus:border-text"
                  value={profile.signature.name}
                  onChange={(e) => patchSignature({ name: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-muted">
                  Beosztás
                </span>
                <input
                  type="text"
                  className="mt-1 w-full border-[1.5px] border-line-strong bg-bg px-2.5 py-2 text-[13px] outline-none focus:border-text"
                  value={profile.signature.title}
                  placeholder="B2B értékesítés"
                  onChange={(e) => patchSignature({ title: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-muted">
                  Telefon
                </span>
                <input
                  type="text"
                  className="mt-1 w-full border-[1.5px] border-line-strong bg-bg px-2.5 py-2 text-[13px] outline-none focus:border-text"
                  value={profile.signature.phone}
                  onChange={(e) => patchSignature({ phone: e.target.value })}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[11px] font-semibold text-muted">
                  Email
                </span>
                <input
                  type="email"
                  className="mt-1 w-full border-[1.5px] border-line-strong bg-bg px-2.5 py-2 text-[13px] outline-none focus:border-text"
                  value={profile.signature.email}
                  onChange={(e) => patchSignature({ email: e.target.value })}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[11px] font-semibold text-muted">
                  Extra sor (opcionális)
                </span>
                <input
                  type="text"
                  className="mt-1 w-full border-[1.5px] border-line-strong bg-bg px-2.5 py-2 text-[13px] outline-none focus:border-text"
                  value={profile.signature.extra}
                  placeholder="H–P 8–16"
                  onChange={(e) => patchSignature({ extra: e.target.value })}
                />
              </label>
            </div>
            <p className="mt-2 text-[11px] text-faint">
              {saveState === "saving"
                ? "Mentés…"
                : saveState === "saved"
                  ? "Mentve."
                  : saveState === "err"
                    ? "Mentés sikertelen — próbáld újra."
                    : "Automatikus mentés."}
            </p>
          </div>

          <div className="border-[1.5px] border-line-strong bg-surface p-4">
            <h2 className="text-[13px] font-semibold text-text">Másolás</h2>
            <p className="mt-1 text-[12px] text-faint">
              Tárgy:{" "}
              <span className="font-medium text-text">{email.subject}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton label="Tárgy" text={email.subject} />
              <CopyButton label="Szöveg" text={email.plainText} />
              <CopyButton label="HTML" text={email.html} />
            </div>
          </div>

          <div className="border-[1.5px] border-line-strong bg-surface-2 p-4">
            <h2 className="text-[13px] font-semibold text-text">
              Hogyan küldd el
            </h2>
            <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[12px] leading-relaxed text-faint">
              <li>
                Shoprenter admin → Marketing → E-mail / hírlevél (vagy saját
                Gmail).
              </li>
              <li>Illeszd be a HTML-t vagy a szöveget. Tárgy: másold ki fent.</li>
              <li>Címzettek: B2B partnerek (vevőcsoport / export).</li>
            </ol>
            <button
              type="button"
              disabled={ackPending || Boolean(profile.launchEmailAcknowledgedAt)}
              onClick={() => void acknowledgeSent()}
              className="mt-4 inline-flex h-9 cursor-pointer items-center bg-accent px-3 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              {profile.launchEmailAcknowledgedAt
                ? "Elküldve megjelölve"
                : ackPending
                  ? "…"
                  : "Megjelöltem: elküldtem a partnereknek"}
            </button>
            {profile.launchEmailAcknowledgedAt ? (
              <p className="mt-2 text-[11px] text-ok">
                Az Áttekintés checklistában is késznek látszik.
              </p>
            ) : null}
          </div>
        </section>

        <section className="min-w-0">
          <div className="sticky top-14 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[13px] font-semibold text-text">Előnézet</h2>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setPreviewMobile(false)}
                  className={
                    !previewMobile
                      ? "h-7 cursor-pointer border-[1.5px] border-text bg-surface px-2 text-[11px] font-semibold"
                      : "h-7 cursor-pointer border-[1.5px] border-line-strong px-2 text-[11px] text-faint"
                  }
                >
                  Asztal
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMobile(true)}
                  className={
                    previewMobile
                      ? "h-7 cursor-pointer border-[1.5px] border-text bg-surface px-2 text-[11px] font-semibold"
                      : "h-7 cursor-pointer border-[1.5px] border-line-strong px-2 text-[11px] text-faint"
                  }
                >
                  Mobil
                </button>
              </div>
            </div>
            <div
              className="overflow-hidden border-[1.5px] border-line-strong bg-[#F5F5F7]"
              style={{
                maxWidth: previewMobile ? 375 : undefined,
                margin: previewMobile ? "0 auto" : undefined,
              }}
            >
              <iframe
                title="Email előnézet"
                className="block w-full bg-white"
                style={{ height: previewMobile ? 580 : 640, border: 0 }}
                srcDoc={email.html}
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </section>
      </div>

      <section className="mt-6 border-[1.5px] border-line-strong bg-surface p-4">
        <h2 className="text-[13px] font-semibold text-text">
          Ellenőrzőlista (küldés előtt)
        </h2>
        <ul className="mt-3 space-y-2">
          {checklist.map((c) => (
            <li key={c.label} className="flex items-center gap-2 text-[12px]">
              <span
                className={
                  c.done
                    ? "flex h-5 w-5 shrink-0 items-center justify-center border border-line-strong bg-accent text-[10px] text-white"
                    : "flex h-5 w-5 shrink-0 items-center justify-center border border-line-strong bg-surface text-faint"
                }
                aria-hidden
              >
                {c.done ? "✓" : ""}
              </span>
              <Link href={c.href} className="font-medium underline">
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
