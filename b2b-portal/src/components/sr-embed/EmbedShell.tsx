"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { TurinovaWordmark } from "@/components/brand/TurinovaWordmark";

/**
 * Embed chrome — top segment nav only (no left rail).
 * Shoprenter admin already has a sidebar; a second rail squeezes the widget preview.
 */

const NAV = [
  { href: "/sr-embed", label: "Kezdőlap", exact: true },
  { href: "/sr-embed/widget", label: "Widget" },
  { href: "/sr-embed/elofizetes", label: "Előfizetés" },
  { href: "/sr-embed/szamlazas", label: "Számlázás" },
  { href: "/sr-embed/sugo", label: "Súgó" },
] as const;

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

type Props = {
  shopName: string;
  storeUrl?: string | null;
  children: ReactNode;
  /** Sticky Mentés / actions in topbar (Widget). */
  saveSlot?: ReactNode;
  /** Full-bleed main (Widget editor). */
  fullBleed?: boolean;
  /** Override document title for a11y (tabs show location visually). */
  title?: string;
};

export function EmbedShell({
  shopName,
  children,
  saveSlot,
  fullBleed = false,
  title: titleProp,
}: Props) {
  const pathname = usePathname();
  const activeLabel =
    titleProp ??
    NAV.find((n) => isActive(pathname, n.href, "exact" in n && n.exact))
      ?.label ??
    "ProGate";

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-text">
      <header className="glass-bar sticky top-0 z-20 shrink-0 border-b border-line-strong">
        <div className="flex h-12 items-center gap-2 px-3 md:px-4">
          <Link
            href="/sr-embed"
            className="flex shrink-0 items-center"
            aria-label="ProGate kezdőlap"
          >
            <span className="hidden sm:inline">
              <TurinovaWordmark
                height={20}
                className="max-w-[7.5rem] object-contain object-left"
              />
            </span>
            <span className="sm:hidden">
              <TurinovaWordmark variant="icon" height={22} />
            </span>
          </Link>

          <nav
            className="flex min-w-0 flex-1 items-stretch gap-0 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="ProGate menü"
          >
            {NAV.map((item) => {
              const active = isActive(
                pathname,
                item.href,
                "exact" in item && item.exact,
              );
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "shrink-0 border-b-2 border-text px-2.5 text-[13px] font-semibold text-text md:px-3"
                      : "shrink-0 border-b-2 border-transparent px-2.5 text-[13px] font-medium text-faint transition-colors hover:text-text md:px-3"
                  }
                >
                  <span className="flex h-12 items-center">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <h1 className="sr-only">
            {activeLabel}
            {shopName ? ` (${shopName})` : ""}
          </h1>

          {saveSlot ? <div className="shrink-0">{saveSlot}</div> : null}
        </div>
      </header>

      <main
        className={
          fullBleed
            ? "flex min-h-0 w-full flex-1 flex-col lg:h-[calc(100dvh-3rem)] lg:max-h-[calc(100dvh-3rem)]"
            : "w-full flex-1 px-4 py-6 md:px-8 md:py-8"
        }
      >
        {children}
      </main>
    </div>
  );
}
