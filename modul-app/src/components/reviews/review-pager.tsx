import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function ReviewPager({
  page,
  total,
  pageSize,
  hrefFor
}: {
  page: number
  total: number
  pageSize: number
  hrefFor: (page: number) => string
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  const linkCls = cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'no-underline')
  return (
    <nav aria-label="Lapozás" className="flex items-center justify-end gap-2 px-0.5 text-hint text-ink-secondary">
      <span className="tabular-nums">
        {page}. / {pages} oldal · {total} sor
      </span>
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={linkCls}>
          Előző
        </Link>
      ) : null}
      {page < pages ? (
        <Link href={hrefFor(page + 1)} className={linkCls}>
          Következő
        </Link>
      ) : null}
    </nav>
  )
}
