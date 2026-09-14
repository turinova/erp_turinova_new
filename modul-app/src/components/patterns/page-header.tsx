import type { LucideIcon } from 'lucide-react'

import { getNavAccentClasses, type NavAccent } from '@/lib/nav-accent'
import { cn } from '@/lib/utils'

type PageHeaderProps = {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
  /** Menüikon — ugyanaz, mint az oldalsávban */
  icon?: LucideIcon
  /** Menü accent — soft badge + alsó vonal */
  accent?: NavAccent
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  icon: Icon,
  accent = 'slate'
}: PageHeaderProps) {
  const tones = getNavAccentClasses(accent)
  const hasIcon = Boolean(Icon)

  return (
    <div
      className={cn(
        'mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between',
        className
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-2.5">
          {hasIcon && Icon ? (
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-md',
                tones.soft,
                tones.icon
              )}
              aria-hidden
            >
              <Icon className="size-4" />
            </span>
          ) : null}
          <h1 className="text-h1 text-ink">{title}</h1>
        </div>
        {description ? (
          <p
            className={cn(
              'max-w-2xl text-body text-ink-secondary',
              hasIcon && 'pl-[42px]'
            )}
          >
            {description}
          </p>
        ) : null}
        {hasIcon ? (
          <div
            className={cn(
              'mt-2 h-0.5 w-12 rounded-full',
              hasIcon && 'ml-[42px]',
              tones.bar
            )}
            aria-hidden
          />
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {actions}
        </div>
      ) : null}
    </div>
  )
}
