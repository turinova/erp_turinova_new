import Link from "next/link";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { getSessionFromCookies } from "@/lib/auth/session";

type NavItem = {
  href: string;
  label: string;
  active?: boolean;
};

function IconGrid({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export async function PlatformShell({
  title,
  children,
  nav = "tenants",
}: {
  title: string;
  children: React.ReactNode;
  nav?: "tenants" | "settings";
}) {
  const session = await getSessionFromCookies();
  const email = session?.email;
  const items: NavItem[] = [
    { href: "/admin", label: "Tenantok", active: nav === "tenants" },
    {
      href: "/admin/settings",
      label: "Beállítások",
      active: nav === "settings",
    },
  ];

  return (
    <div className="flex min-h-dvh bg-bg">
      <aside className="glass-side sticky top-0 hidden h-dvh w-[200px] shrink-0 flex-col md:flex">
        <div className="flex h-12 items-center gap-2 border-b border-line-strong px-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-none bg-accent text-[11px] font-bold text-white">
            T
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-semibold tracking-tight">
              Turinova
            </p>
            <p className="truncate text-[11px] font-medium text-faint">
              Platform
            </p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 py-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                item.active
                  ? "flex h-9 cursor-pointer items-center gap-2 border-l-2 border-text bg-surface-2 px-3 text-[13px] font-semibold text-text"
                  : "flex h-9 cursor-pointer items-center gap-2 border-l-2 border-transparent px-3 text-[13px] font-medium text-faint transition-colors hover:bg-surface-2 hover:text-text"
              }
            >
              <IconGrid />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line-strong p-3">
          <p className="truncate text-[12px] font-semibold text-text">
            {email ?? "Te"}
          </p>
          <p className="truncate text-[11px] text-faint">admin</p>
          <LogoutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-bar sticky top-0 z-20 flex h-12 shrink-0 items-center gap-3 px-4 md:px-6">
          <Link
            href="/admin"
            className="flex items-center gap-1.5 md:hidden"
            aria-label="Platform"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-none bg-accent text-[11px] font-bold text-white">
              T
            </span>
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight">
            {title}
          </h1>
          <button
            type="button"
            className="tn-btn tn-btn-ghost !h-8 !px-2.5 text-[12px] text-faint"
            title="Keresés (hamarosan ⌘K)"
          >
            <IconSearch />
            <span className="ml-1.5 hidden sm:inline">Keresés</span>
          </button>
        </header>

        <div className="glass-bar flex gap-1 px-3 py-2 md:hidden">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                item.active
                  ? "rounded-none bg-accent px-3 py-1.5 text-[12px] font-semibold text-white"
                  : "rounded-none px-3 py-1.5 text-[12px] font-medium text-faint"
              }
            >
              {item.label}
            </Link>
          ))}
        </div>

        <main className="w-full flex-1 px-4 py-6 md:px-8 md:py-8 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
