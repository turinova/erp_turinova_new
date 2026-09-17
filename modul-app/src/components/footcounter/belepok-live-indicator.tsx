import { cn } from '@/lib/utils'

type LiveStatus = 'live' | 'idle' | 'offline' | 'none'

export function BelepokLiveIndicator({
  status,
  lastSeenAt
}: {
  status: LiveStatus
  lastSeenAt: string | null
}) {
  if (status === 'none') {
    return (
      <span className="inline-flex items-center gap-1.5 text-hint text-ink-muted">
        <span className="size-2 rounded-full bg-border" aria-hidden />
        Nincs eszköz
      </span>
    )
  }

  const label =
    status === 'live'
      ? 'Számláló aktív'
      : status === 'idle'
        ? 'Számláló várakozik'
        : 'Számláló offline'

  const title = lastSeenAt
    ? `Utolsó sync: ${new Date(lastSeenAt).toLocaleString('hu-HU')}`
    : undefined

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-hint font-medium',
        status === 'live' && 'text-success-ink',
        status === 'idle' && 'text-warning-ink',
        status === 'offline' && 'text-danger-ink'
      )}
      title={title}
      role="status"
      aria-label={label}
    >
      <span className="relative flex size-2.5 shrink-0">
        {status === 'live' ? (
          <>
            <span
              className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60"
              aria-hidden
            />
            <span
              className="relative inline-flex size-2.5 rounded-full bg-success"
              aria-hidden
            />
          </>
        ) : (
          <span
            className={cn(
              'inline-flex size-2.5 rounded-full',
              status === 'idle' && 'bg-warning',
              status === 'offline' && 'bg-danger'
            )}
            aria-hidden
          />
        )}
      </span>
      {label}
    </span>
  )
}
