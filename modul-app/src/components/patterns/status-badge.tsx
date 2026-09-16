import { cn } from '@/lib/utils'

type StatusBadgeProps = {
  tone?: 'active' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  children: React.ReactNode
  className?: string
}

const toneClass: Record<NonNullable<StatusBadgeProps['tone']>, string> = {
  active: 'bg-active-soft text-active-ink',
  success: 'bg-success-soft text-success-ink',
  warning: 'bg-warning-soft text-warning-ink',
  danger: 'bg-danger-soft text-danger-ink',
  info: 'bg-info-soft text-info-ink',
  neutral: 'bg-subtle text-ink-secondary'
}

export function StatusBadge({
  tone = 'neutral',
  children,
  className
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-label font-semibold',
        toneClass[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
