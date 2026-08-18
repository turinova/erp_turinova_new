"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ForceSyncButton({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/sync`, { method: "POST" });
      const data = (await res.json()) as {
        ok?: boolean;
        created?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Sikertelen");
        return;
      }
      setMessage(data.created ? "Sync elindítva" : "Már fut egy sync");
      router.refresh();
    } catch {
      setError("Hálózati hiba");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => void run()}
        disabled={pending}
        className="tn-btn tn-btn-ghost !h-9"
      >
        {pending ? "…" : "Termékek másolása"}
      </button>
      {error ? (
        <p className="mt-2 text-[13px] text-danger">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-2 text-[13px] text-ok">{message}</p>
      ) : null}
    </div>
  );
}
