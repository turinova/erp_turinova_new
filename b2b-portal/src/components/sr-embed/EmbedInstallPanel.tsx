"use client";

import { useState } from "react";
import type { InstallCapability } from "@/lib/shoprenter/install/types";
import type { ScriptInstallState } from "@/lib/shoprenter/install/types";

type Props = {
  capability: InstallCapability;
  script: ScriptInstallState;
  snippets: { loader: string; legacy: string };
  storeUrl: string | null;
  shopName: string;
};

export function EmbedInstallPanel({
  capability,
  script: scriptInitial,
  snippets,
  storeUrl,
  shopName,
}: Props) {
  const [script, setScript] = useState(scriptInitial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(
    capability.mode === "manual" || !scriptInitial.installedAt,
  );
  const [copied, setCopied] = useState(false);
  const [snippet, setSnippet] = useState(snippets.loader);

  const installed = Boolean(script.installedAt || script.method);

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Másolás sikertelen");
    }
  }

  async function install() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/shoprenter/embed/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "install", enableWidget: true }),
      });
      const data = await res.json();
      if (data.script) setScript(data.script);
      if (data.snippets?.loader) setSnippet(data.snippets.loader);
      if (data.result?.ok) {
        setShowFallback(false);
        setMessage("Telepítve");
        return;
      }
      setShowFallback(true);
      setError(data.result?.error || "Telepítés sikertelen — másold be");
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
        body: JSON.stringify({
          action: "confirm_manual",
          enableWidget: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.result?.ok) {
        setError(data.error || "Mentés sikertelen");
        return;
      }
      if (data.script) setScript(data.script);
      setShowFallback(false);
      setMessage("Jelölve: telepítve");
    } catch {
      setError("Hálózati hiba");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      {installed ? (
        <div className="border-[1.5px] border-line-strong bg-surface-2 px-3 py-2 text-[12px] text-faint">
          Script státusz:{" "}
          <span className="font-semibold text-text">
            {script.method || "telepítve"}
          </span>
          {script.installedAt
            ? ` · ${new Date(script.installedAt).toLocaleString("hu-HU")}`
            : null}
        </div>
      ) : null}

      <button
        type="button"
        className="tn-btn tn-btn-primary w-full sm:w-auto"
        disabled={pending}
        onClick={() => void install()}
      >
        {pending ? "…" : installed ? "Újratelepítem" : "Telepítem a boltra"}
      </button>

      {message ? (
        <p className="text-[12px] font-semibold text-accent">{message}</p>
      ) : null}
      {error ? (
        <p className="text-[12px] font-semibold text-danger">{error}</p>
      ) : null}

      {showFallback ? (
        <>
          <ol className="list-decimal space-y-1.5 pl-4 text-[12px] text-faint">
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
            <li>Illeszd be a kódot → Mentés</li>
            <li>
              Menüpont (opcionális): URL ={" "}
              <code className="font-mono text-[11px] text-text">#sr-b2b-qo</code>
            </li>
          </ol>
          <div>
            <div className="flex items-center justify-between">
              <p className="tn-label">Script ({shopName})</p>
              <button
                type="button"
                className="tn-btn tn-btn-ghost !h-7 px-2 text-[11px]"
                onClick={() => void copy()}
              >
                {copied ? "Kész" : "Másol"}
              </button>
            </div>
            <pre className="mt-1 max-h-48 overflow-auto border-[1.5px] border-line-strong bg-surface-2 p-2 font-mono text-[10px] leading-relaxed text-faint whitespace-pre-wrap">
              {snippet}
            </pre>
          </div>
          <button
            type="button"
            className="tn-btn tn-btn-ghost"
            disabled={pending}
            onClick={() => void confirmManual()}
          >
            Kész, beillesztettem
          </button>
        </>
      ) : null}

      {storeUrl ? (
        <a
          href={storeUrl}
          target="_blank"
          rel="noreferrer"
          className="tn-btn tn-btn-ghost"
        >
          Megnézem a boltom
        </a>
      ) : null}

      <p className="text-[11px] text-faint">
        Telepítés mód: {capability.label}
      </p>
    </div>
  );
}
