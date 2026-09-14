import { cn } from '@/lib/utils'

type FormSectionColumns = 2 | 3 | 4 | 5

const columnsClass: Record<FormSectionColumns, string> = {
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
  columns = 2
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  columns?: FormSectionColumns
}) {
  return (
    <section
      className={cn(
        'rounded-md border border-border bg-surface p-3.5',
        className
      )}
    >
      <div className="mb-2.5 space-y-0.5">
        <h2 className="text-h3 text-ink">{title}</h2>
        {description ? (
          <p className="text-hint text-ink-secondary">{description}</p>
        ) : null}
      </div>
      <div className={cn('grid gap-x-3 gap-y-2.5', columnsClass[columns])}>
        {children}
      </div>
    </section>
  )
}
