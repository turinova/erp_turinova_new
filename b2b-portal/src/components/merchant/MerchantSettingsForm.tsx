"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CatalogResyncButton, CatalogStatusChip } from "@/components/merchant/CatalogStatusPanel";
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
    setUsername("");
    setPassword("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);

    try {
      if (!shop.hasCredentials && (!username.trim() || !password.trim())) {
        setError("Írd be a Shoprenter nevet és jelszót.");
        setPending(false);
        return;
      }

      /* widgetEnabled only on /widget — omit so shop PATCH leaves it alone */
      const body: Record<string, unknown> = {
        storeUrl,
        authType: "basic_legacy",
        buttonLabel: shop.buttonLabel,
        customerGroupIds: [],
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
      setError("Nincs kapcsolat.");
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
        message: "Nincs kapcsolat.",
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
  const connValue = connected ? "OK" : failed ? "Hiba" : "—";
  const failMsg =
    failed
      ? pingResult?.kind === "fail"
        ? pingResult.message
        : shop.lastPingError
      : null;

  return (
    <form className="flex w-full flex-col gap-6" onSubmit={save}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line-strong pb-5">
        <StatusChip label="Bolt API" value={connValue} tone={connTone} />
        <StatusChip
          label="Gomb"
          value={shop.widgetEnabled ? "Látszik" : "Rejtve"}
          tone={shop.widgetEnabled ? "ok" : "idle"}
        />
        <CatalogStatusChip />

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <CatalogResyncButton />
          <button
            type="button"
            onClick={ping}
            disabled={pinging || !shop.hasCredentials}
            className="tn-btn tn-btn-ghost"
          >
            {pinging ? "…" : "Kapcsolat tesztelése"}
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

      <div className="grid w-full gap-8 lg:grid-cols-2 lg:gap-10">
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

        <div className="flex flex-col gap-5">
          <div className="border-[1.5px] border-line-strong bg-surface p-4">
            <h2 className="text-[15px] font-semibold tracking-tight">Widget</h2>
            <p className="mt-1 text-[12px] text-faint">
              Ki/be, nézet és telepítés a Widget oldalon.
            </p>
            <p className="mt-3 text-[13px]">
              Most:{" "}
              <span className="font-semibold">
                {shop.widgetEnabled ? "be van kapcsolva" : "ki van kapcsolva"}
              </span>
            </p>
            <Link href="/widget" className="tn-btn tn-btn-ghost mt-3 inline-flex">
              Widget →
            </Link>
          </div>

          <div className="border-[1.5px] border-line-strong bg-surface p-4">
            <h2 className="text-[15px] font-semibold tracking-tight">
              Előfizetés
            </h2>
            <p className="mt-1 text-[12px] text-faint">
              Egy előfizetés + opcionális saját márka (felirat). Részletek az
              Előfizetésem oldalon.
            </p>
            <Link href="/csomag" className="tn-btn tn-btn-ghost mt-3 inline-flex">
              Előfizetésem →
            </Link>
          </div>
        </div>
      </div>
    </form>
  );
}
