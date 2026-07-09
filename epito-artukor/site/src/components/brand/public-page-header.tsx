import { TurinovaLogo, TurinovaProductLockup } from "@/components/brand/turinova-logo"
import { APP_NAME } from "@/lib/nav-config"
import { cn } from "@/lib/utils"

type PublicPageHeaderProps = {
  title: string
  subtitle?: string
  className?: string
}

/** Ügyfél / alvállalkozói nyilvános oldalak fejléce */
export function PublicPageHeader({ title, subtitle, className }: PublicPageHeaderProps) {
  return (
    <header
      className={cn(
        "border-b border-[var(--border)] bg-[var(--card)] px-4 py-3.5",
        className
      )}
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <TurinovaLogo variant="full" height={22} />
          <div className="hidden h-8 w-px bg-[var(--border)] sm:block" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--foreground)]">{APP_NAME}</p>
            <p className="truncate text-xs text-[var(--muted-foreground)]">{title}</p>
          </div>
        </div>
        {subtitle ? (
          <p className="text-xs text-[var(--muted-foreground)]">{subtitle}</p>
        ) : (
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--sidebar-muted)]">
            Turinova
          </p>
        )}
      </div>
    </header>
  )
}

export { TurinovaLogo, TurinovaProductLockup }
