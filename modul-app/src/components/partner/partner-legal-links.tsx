import { getPartnerLegalUrls } from '@/lib/partner/legal-urls'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
  /**
   * `inline` — auth/regisztráció: ÁSZF · Adatkezelés · Impresszum
   * `sidebar` — oldalsáv alja: stacked tertiary linkek + „Jogi” label
   */
  variant?: 'inline' | 'sidebar'
}

const LINKS = [
  { key: 'aszf' as const, label: 'ÁSZF' },
  { key: 'privacy' as const, label: 'Adatkezelés' },
  { key: 'impressum' as const, label: 'Impresszum' }
]

export function PartnerLegalLinks({
  className,
  variant = 'inline'
}: Props) {
  const urls = getPartnerLegalUrls()

  if (variant === 'sidebar') {
    return (
      <div className={cn('px-2', className)}>
        <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
          Jogi
        </p>
        <nav className="flex flex-col" aria-label="Jogi dokumentumok">
          {LINKS.map((item) => (
            <a
              key={item.key}
              href={urls[item.key]}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md px-2 py-1 text-[12px] text-ink-muted no-underline transition-colors duration-fast hover:bg-stone-100 hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    )
  }

  const linkClass =
    'underline-offset-2 hover:text-ink hover:underline'

  return (
    <p className={cn('text-center text-hint text-ink-muted', className)}>
      {LINKS.map((item, i) => (
        <span key={item.key}>
          {i > 0 ? <span aria-hidden> · </span> : null}
          <a
            href={urls[item.key]}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            {item.label}
          </a>
        </span>
      ))}
    </p>
  )
}
