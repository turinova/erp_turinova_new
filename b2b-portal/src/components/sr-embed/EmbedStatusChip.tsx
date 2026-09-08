/** Shared status chips — same language as MerchantSettingsForm. */

export function EmbedStatusChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "bad" | "warn" | "idle";
}) {
  const styles =
    tone === "ok"
      ? "border-ok text-ok"
      : tone === "bad"
        ? "border-danger text-danger"
        : tone === "warn"
          ? "border-warn text-warn"
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

export function catalogChip(status: string | null | undefined): {
  value: string;
  tone: "ok" | "bad" | "warn" | "idle";
} {
  const s = (status || "pending").toLowerCase();
  if (s === "ready" || s === "synced" || s === "ok") {
    return { value: "Kész", tone: "ok" };
  }
  if (s === "error" || s === "failed") {
    return { value: "Hiba", tone: "bad" };
  }
  if (s === "syncing" || s === "running" || s === "pending") {
    return { value: s === "pending" ? "Várakozik" : "Fut", tone: "warn" };
  }
  return { value: status || "—", tone: "idle" };
}

export function apiChip(opts: {
  hasCredentials: boolean;
  status: string;
}): { value: string; tone: "ok" | "bad" | "warn" | "idle" } {
  if (opts.status === "uninstalled") {
    return { value: "Eltávolítva", tone: "bad" };
  }
  if (opts.status === "needs_reauth" || !opts.hasCredentials) {
    return { value: "Újra kell kötni", tone: "bad" };
  }
  if (opts.status === "suspended") {
    return { value: "Felfüggesztve", tone: "warn" };
  }
  return { value: "Rendben", tone: "ok" };
}
