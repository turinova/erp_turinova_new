"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton({
  className,
  compact,
}: {
  className?: string;
  /** Ikon/rövid mód az összecsukott sidebarhoz. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
      setPending(false);
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={logout}
        disabled={pending}
        title="Kilépés"
        aria-label="Kilépés"
        className={
          className ??
          "inline-flex h-8 w-8 cursor-pointer items-center justify-center border border-line-strong bg-surface text-[11px] font-semibold text-faint hover:bg-surface-2 hover:text-text disabled:opacity-50"
        }
      >
        {pending ? "…" : "→"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={pending}
      className={
        className ??
        "mt-2 inline-block cursor-pointer text-[11px] font-medium text-muted hover:text-text disabled:opacity-50"
      }
    >
      {pending ? "Kilépés…" : "Kilépés"}
    </button>
  );
}
