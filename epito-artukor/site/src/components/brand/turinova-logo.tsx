import Image from "next/image"
import { cn } from "@/lib/utils"

const LOGO_FULL = "/images/turinova-logo.png"
const LOGO_ICON = "/images/turinova-small-icon.png"

export type TurinovaLogoProps = {
  variant?: "full" | "icon"
  className?: string
  height?: number
}

/** Fekete Turinova logó — világos háttérre optimalizálva */
export function TurinovaLogo({
  variant = "full",
  className,
  height,
}: TurinovaLogoProps) {
  const isIcon = variant === "icon"
  const h = height ?? (isIcon ? 28 : 24)

  return (
    <div className={cn("inline-flex items-center", className)}>
      <Image
        src={isIcon ? LOGO_ICON : LOGO_FULL}
        alt="Turinova"
        width={isIcon ? h : Math.round(h * 4.2)}
        height={h}
        className="h-auto w-auto object-contain"
        style={{ height: h, width: "auto", maxWidth: isIcon ? h : 132 }}
        priority
      />
    </div>
  )
}

export function TurinovaProductLockup({
  productName,
  subtitle,
  className,
}: {
  productName: string
  subtitle?: string
  className?: string
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <TurinovaLogo variant="full" height={28} />
      <div>
        <p className="text-base font-semibold tracking-tight text-[var(--foreground)]">
          {productName}
        </p>
        {subtitle ? (
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted-foreground)]">{subtitle}</p>
        ) : null}
      </div>
    </div>
  )
}
