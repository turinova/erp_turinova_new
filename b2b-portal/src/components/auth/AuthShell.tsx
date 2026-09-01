import Link from "next/link";
import type { ReactNode } from "react";
import { TurinovaWordmark } from "@/components/brand/TurinovaWordmark";
import { marketingHomeHref } from "@/lib/hosts";

export type AuthShellVariant = "login" | "signup" | "verify";

type Props = {
  variant?: AuthShellVariant;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/** Auth layout: form left, large ProGate mark centered on the right. */
export function AuthShell({ title, subtitle, children, footer }: Props) {
  return (
    <main className="relative min-h-dvh bg-bg">
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute inset-0 bg-surface-2/40" />
        <div
          className="absolute -right-24 top-0 h-[70%] w-[55%] bg-accent-soft/80"
          style={{
            clipPath: "polygon(18% 0, 100% 0, 100% 100%, 0% 100%)",
          }}
        />
      </div>

      <div className="relative mx-auto grid min-h-dvh w-full max-w-6xl lg:grid-cols-2">
        <div className="flex flex-col justify-center px-4 py-10 sm:px-8 lg:px-12">
          <div className="mx-auto w-full max-w-[420px]">
            {/* Mobile only — desktop logo lives in the right panel */}
            <Link
              href={marketingHomeHref()}
              className="inline-flex lg:hidden transition-opacity duration-150 hover:opacity-80"
            >
              <TurinovaWordmark height={28} showParent />
            </Link>

            <h1 className="mt-8 text-[26px] font-semibold tracking-tight text-text sm:text-[28px] lg:mt-0">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-2 text-[14px] leading-snug text-faint">
                {subtitle}
              </p>
            ) : null}

            <div className="mt-8 border border-line-strong bg-surface p-5 sm:p-6">
              {children}
            </div>

            {footer ? (
              <div className="mt-6 text-center text-[13px] text-faint">
                {footer}
              </div>
            ) : null}
          </div>
        </div>

        <aside className="relative hidden min-h-dvh border-l border-line-strong lg:flex lg:items-center lg:justify-center lg:px-12">
          <Link
            href={marketingHomeHref()}
            className="inline-flex transition-opacity duration-150 hover:opacity-80"
          >
            <TurinovaWordmark height={72} showParent />
          </Link>
        </aside>
      </div>
    </main>
  );
}
