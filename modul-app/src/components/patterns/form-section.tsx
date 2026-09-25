import { cn } from '@/lib/utils'

type FormSectionColumns = 1 | 2 | 3 | 4 | 5

const columnsClass: Record<FormSectionColumns, string> = {
  1: 'grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
  5: 'sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5'
}

export function FormSection({
  title,
  description,
  children,
  className,
  columns = 2,
  headerAside,
  headerAction,
  bodyHidden = false,
  onTitleClick,
  embedded = false
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  columns?: FormSectionColumns
  /** Extra tartalom a fejléc jobb oldalán (pl. badge). */
  headerAside?: React.ReactNode
  /** Fejléc bal oldali akció (pl. collapse gomb a cím előtt). */
  headerAction?: React.ReactNode
  /** Ha true, a mezőrács rejtve (összecsukva). */
  bodyHidden?: boolean
  /** Ha megadva, a cím kattintható. */
  onTitleClick?: () => void
  /** Szülő (pl. lenyíló csoport) adja a keretet és a címet — itt csak leírás + mezőrács. */
  embedded?: boolean
}) {
  if (embedded) {
    return (
      <div className={cn('space-y-2.5', className)}>
        {description || headerAside ? (
          <div className="flex items-start justify-between gap-2">
            {description ? (
              <p className="text-hint text-ink-secondary">{description}</p>
            ) : (
              <span />
            )}
            {headerAside}
          </div>
        ) : null}
        <div className={cn('grid gap-x-3 gap-y-2.5', columnsClass[columns])}>
          {children}
        </div>
      </div>
    )
  }
  return (
    <section
      className={cn(
        'rounded-md border border-border bg-surface p-3.5',
        className
      )}
    >
      <div
        className={cn(
          'flex items-start justify-between gap-2',
          bodyHidden ? null : 'mb-2.5'
        )}
      >
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-1.5">
            {headerAction}
            {onTitleClick ? (
              <button
                type="button"
                className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={onTitleClick}
              >
                <h2 className="text-h3 text-ink">{title}</h2>
              </button>
            ) : (
              <h2 className="text-h3 text-ink">{title}</h2>
            )}
          </div>
          {description && !bodyHidden ? (
            <p
              className={cn(
                'text-hint text-ink-secondary',
                headerAction ? 'pl-5' : null
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
        {headerAside ? (
          <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
            {headerAside}
          </div>
        ) : null}
      </div>
      {bodyHidden ? null : (
        <div className={cn('grid gap-x-3 gap-y-2.5', columnsClass[columns])}>
          {children}
        </div>
      )}
    </section>
  )
}
