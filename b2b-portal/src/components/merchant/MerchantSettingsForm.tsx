"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MerchantShopDto } from "@/lib/merchant/shop";

type Props = { initial: MerchantShopDto };

type PingResult =
  | { kind: "ok"; at: string }
  | { kind: "fail"; message: string; at: string }
  | null;

function StatusChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "bad" | "idle";
}) {
  const styles =
    tone === "ok"
      ? "border-ok text-ok"
      : tone === "bad"
        ? "border-danger text-danger"
        : "border-line-strong text-text";

  return (
    <div
      className={`inline-flex h-10 items-center gap-2 rounded-none border-2 px-3 ${styles}`}
      role="status"
    >
      <span className="text-[12px] font-medium text-faint">{label}</span>
      <span className="text-[13px] font-bold tracking-tight">{value}</span>
    </div>
  );
}

export function MerchantSettingsForm({ initial }: Props) {
  const router = useRouter();
  const [shop, setShop] = useState(initial);
  const [storeUrl, setStoreUrl] = useState(initial.storeUrl ?? "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [widgetEnabled, setWidgetEnabled] = useState(initial.widgetEnabled);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<PingResult>(() =>
    initial.lastPingOk === true && initial.lastPingAt
      ? { kind: "ok", at: initial.lastPingAt }
      : initial.lastPingOk === false
        ? {
            kind: "fail",
            message: initial.lastPingError ?? "A bolt nem válaszol",
            at: initial.lastPingAt ?? new Date().toISOString(),
          }
        : null,
  );

  function applyShop(next: MerchantShopDto) {
    setShop(next);
    setStoreUrl(next.storeUrl ?? "");
    setWidgetEnabled(next.widgetEnabled);
    setUsername("");
    setPassword("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    const customerGroupIds: number[] = [];

    try {
      if (!shop.hasCredentials && (!username.trim() || !password.trim())) {
        setError("Írd be a Shoprenter nevet és jelszót.");
        setPending(false);
        return;
      }

      const body: Record<string, unknown> = {
        storeUrl,
        authType: "basic_legacy",
        buttonLabel: shop.buttonLabel,
        customerGroupIds,
        widgetEnabled,
      };
      if (username.trim()) body.username = username.trim();
      if (password.trim()) body.password = password.trim();

      const res = await fetch("/api/merchant/shop", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        shop?: MerchantShopDto;
      };
      if (!res.ok || !data.ok || !data.shop) {
        setError(data.error ?? "Mentés sikertelen");
        setPending(false);
        return;
      }
      applyShop(data.shop);
      setMessage("Mentve");
      router.refresh();
    } catch {
      setError("Nincs net.");
    } finally {
      setPending(false);
    }
  }

  async function ping() {
    setError(null);
    setMessage(null);
    setPinging(true);
    setPingResult(null);
    try {
      const res = await fetch("/api/merchant/shop/ping", { method: "POST" });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        shop?: MerchantShopDto;
      };
      if (data.shop) applyShop(data.shop);
      const at = data.shop?.lastPingAt ?? new Date().toISOString();
      if (!data.ok) {
        setPingResult({
          kind: "fail",
          message: data.error ?? "A bolt nem válaszol",
          at,
        });
      } else {
        setPingResult({ kind: "ok", at });
      }
      router.refresh();
    } catch {
      setPingResult({
        kind: "fail",
        message: "Nincs net.",
        at: new Date().toISOString(),
      });
    } finally {
      setPinging(false);
    }
  }

  const connected =
    pingResult?.kind === "ok" ||
    (shop.lastPingOk === true && pingResult === null);
  const failed =
    pingResult?.kind === "fail" || shop.lastPingOk === false;

  const connTone: "ok" | "bad" | "idle" = connected
    ? "ok"
    : failed
      ? "bad"
      : "idle";
  const connValue = connected ? "Rendben" : failed ? "Nem megy" : "—";
  const failMsg =
    failed
      ? pingResult?.kind === "fail"
        ? pingResult.message
        : shop.lastPingError
      : null;

  return (
    <form className="flex w-full flex-col gap-6" onSubmit={save}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line-strong pb-5">
        <StatusChip label="Kapcsolat" value={connValue} tone={connTone} />
        <StatusChip
          label="Gomb"
          value={widgetEnabled ? "Be" : "Ki"}
          tone={widgetEnabled ? "ok" : "idle"}
        />

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={ping}
            disabled={pinging || !shop.hasCredentials}
            className="tn-btn tn-btn-ghost"
          >
            {pinging ? "…" : "Működik?"}
          </button>
          <button
            type="submit"
            disabled={pending}
            className="tn-btn tn-btn-primary"
          >
            {pending ? "…" : "Mentés"}
          </button>
        </div>
      </div>

      {(error || message || failMsg) && (
        <p
          className={`text-[13px] font-medium ${
            error || failMsg ? "text-danger" : "text-ok"
          }`}
          role={error || failMsg ? "alert" : "status"}
        >
          {error ?? message ?? failMsg}
        </p>
      )}

      {/* 2 columns */}
      <div className="grid w-full gap-8 lg:grid-cols-2 lg:gap-10">
        {/* Left — essentials */}
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight">
              Kulcs a bolthoz
            </h2>
            <p className="mt-1 text-[13px] text-faint">
              Shoprenterben: Beállítások → API. Másold ide a nevet és a jelszót.
            </p>
          </div>

          <label className="tn-field">
            <span className="tn-label">Shoprenter név</span>
            <input
              className="tn-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={shop.hasCredentials ? "csak ha cserélnéd" : ""}
              autoComplete="off"
            />
          </label>

          <label className="tn-field">
            <span className="tn-label">Shoprenter jelszó</span>
            <input
              className="tn-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={shop.hasCredentials ? "••••••••" : ""}
              autoComplete="new-password"
            />
          </label>

          <label className="tn-field">
            <span className="tn-label">Boltod címe</span>
            <input
              className="tn-input"
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
              placeholder="https://pelda.hu"
            />
          </label>
        </div>

        {/* Right — gomb + origins */}
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight">Gomb</h2>
            <p className="mt-1 text-[13px] text-faint">
              A bolt sarkában lévő gomb. Be = látszik, Ki = el van rejtve.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setWidgetEnabled(true)}
              className={
                widgetEnabled
                  ? "inline-flex h-10 cursor-pointer items-center rounded-none border-2 border-text bg-text px-4 text-[13px] font-bold text-white"
                  : "inline-flex h-10 cursor-pointer items-center rounded-none border-2 border-line-strong bg-surface px-4 text-[13px] font-semibold text-faint"
              }
            >
              Be
            </button>
            <button
              type="button"
              onClick={() => setWidgetEnabled(false)}
              className={
                !widgetEnabled
                  ? "inline-flex h-10 cursor-pointer items-center rounded-none border-2 border-text bg-text px-4 text-[13px] font-bold text-white"
                  : "inline-flex h-10 cursor-pointer items-center rounded-none border-2 border-line-strong bg-surface px-4 text-[13px] font-semibold text-faint"
              }
            >
              Ki
            </button>
            <Link
              href="/widget"
              className="tn-btn tn-btn-ghost ml-auto"
            >
              Nézet →
            </Link>
          </div>
        </div>
      </div>
    </form>
  );
}
