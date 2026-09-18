import { cn } from '@/lib/utils'

export type StatusBadgeTone =
  | 'active'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'

/** soft = listák; solid = glance (fizetve/hiba); outline = meta (raktár, SKU) */
export type StatusBadgeVariant = 'soft' | 'solid' | 'outline'

type StatusBadgeProps = {
  tone?: StatusBadgeTone
  variant?: StatusBadgeVariant
  children: React.ReactNode
  className?: string
}

const softClass: Record<StatusBadgeTone, string> = {
  active: 'bg-active-soft text-active-ink',
  success: 'bg-success-soft text-success-ink',
  warning: 'bg-warning-soft text-warning-ink',
  danger: 'bg-danger-soft text-danger-ink',
  info: 'bg-info-soft text-info-ink',
  neutral: 'bg-subtle text-ink-secondary'
}

const solidClass: Record<StatusBadgeTone, string> = {
  active: 'bg-active text-white',
  success: 'bg-success text-white',
  warning: 'bg-warning text-white',
  danger: 'bg-danger text-white',
  info: 'bg-info text-white',
  neutral: 'bg-ink-secondary text-white'
}

const outlineClass: Record<StatusBadgeTone, string> = {
  active:
    'border border-active/35 bg-surface text-active-ink',
  success:
    'border border-success/40 bg-surface text-success-ink',
  warning:
    'border border-warning/45 bg-surface text-warning-ink',
  danger:
    'border border-danger/40 bg-surface text-danger-ink',
  info: 'border border-info/40 bg-surface text-info-ink',
  neutral: 'border border-border-strong bg-surface text-ink'
}

const variantClass: Record<
  StatusBadgeVariant,
  Record<StatusBadgeTone, string>
> = {
  soft: softClass,
  solid: solidClass,
  outline: outlineClass
}

export function StatusBadge({
  tone = 'neutral',
  variant = 'soft',
  children,
  className
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[12.5px] font-semibold leading-tight tracking-tight',
        variantClass[variant][tone],
        className
      )}
    >
      {children}
    </span>
  )
}
