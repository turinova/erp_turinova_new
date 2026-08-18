"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ResendInviteButton({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function resend() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/invite/resend`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        inviteUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.inviteUrl) {
        setError(data.error ?? "Sikertelen");
        setPending(false);
        return;
      }
      setLink(data.inviteUrl);
      router.refresh();
    } catch {
      setError("Hálózati hiba");
    } finally {
      setPending(false);
    }
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={resend}
        disabled={pending}
        className="tn-btn tn-btn-ghost !h-9"
      >
        {pending ? "…" : "Meghívó újra"}
      </button>
      {error ? (
        <p className="mt-2 text-[13px] text-danger">{error}</p>
      ) : null}
      {link ? (
        <div className="mt-2">
          <p className="break-all font-mono text-[12px] text-faint">{link}</p>
          <button
            type="button"
            onClick={copy}
            className="mt-1 cursor-pointer text-[12px] font-semibold underline underline-offset-2"
          >
            {copied ? "Másolva" : "Link másolása"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
