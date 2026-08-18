"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton({ className }: { className?: string }) {
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
