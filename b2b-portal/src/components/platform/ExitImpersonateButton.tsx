"use client";

import { useState } from "react";

export function ExitImpersonateButton() {
  const [pending, setPending] = useState(false);

  async function stop() {
    setPending(true);
    try {
      const res = await fetch("/api/admin/impersonate/stop", { method: "POST" });
      const json = (await res.json()) as { redirect?: string };
      window.location.href = json.redirect ?? "/admin";
    } catch {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void stop()}
      className="tn-btn tn-btn-ghost !h-8 !px-3 text-[12px]"
    >
      {pending ? "…" : "Vissza az adminba"}
    </button>
  );
}
