'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Check,
  FolderTree,
  Mail,
  MessageSquare,
  Package,
  Globe,
  Settings2,
  Tags
} from 'lucide-react'
import { useTransition } from 'react'
import { toast } from 'sonner'

import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button, buttonVariants } from '@/components/ui/button'
import type { StockNotifyRow, WebshopOverviewStats } from '@/lib/webshop/queries'
import { closeStockNotifyRequest } from '@/lib/webshop/storefront-actions'

const PRODUCT_PATH = '/torzsadatok/alapanyagok/termekek'

type Props = {
  stats: WebshopOverviewStats
  stockNotify: { rows: StockNotifyRow[]; total: number }
}

function StockNotifyItem({ row }: { row: StockNotifyRow }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function close() {
    startTransition(async () => {
      const result = await closeStockNotifyRequest(row.id)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Kérés lezárva.')
      router.refresh()
    })
  }

  const subject = encodeURIComponent(`Újra rendelhető: ${row.productName}`)
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
      <div className="min-w-0 space-y-0.5">
        <p className="flex flex-wrap items-center gap-2 text-body text-ink">
          <Link
            href={`${PRODUCT_PATH}/${row.productId}`}
            className="font-medium underline-offset-2 hover:underline"
          >
            {row.productName}
          </Link>
          <StatusBadge tone={row.inStock ? 'success' : 'neutral'}>
            {row.inStock ? 'Újra raktáron' : 'Még nincs készleten'}
          </StatusBadge>
        </p>
        <p className="text-hint text-ink-secondary">
          {row.email}
          {row.variantLabel ? ` · ${row.variantLabel}` : ''} ·{' '}
          {new Date(row.createdAt).toLocaleDateString('hu-HU')}
        </p>
      </div>
      <div className="flex gap-1.5">
        <a
          href={`mailto:${row.email}?subject=${subject}`}
          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
        >
          <Mail className="size-3.5" aria-hidden />
          E-mail írása
        </a>
        <Button type="button" size="sm" variant="secondary" loading={pending} onClick={close}>
          <Check className="size-3.5" aria-hidden />
          Értesítettem
        </Button>
      </div>
    </li>
  )
}

function StockNotifyList({ rows, total }: { rows: StockNotifyRow[]; total: number }) {
  if (rows.length === 0) return null
  return (
    <section className="mt-6 max-w-3xl space-y-2" aria-labelledby="stock-notify-title">
      <div>
        <h2 id="stock-notify-title" className="text-h2 text-ink">
          Szólj, ha megérkezik ({total})
        </h2>
        <p className="text-hint text-ink-secondary">
          Vásárlók, akik elfogyott termékre kértek értesítést. Ha újra van,
          írj nekik, majd zárd le a kérést.
        </p>
      </div>
      <ul className="divide-y divide-border rounded-md border border-border bg-surface">
        {rows.map((r) => (
          <StockNotifyItem key={r.id} row={r} />
        ))}
      </ul>
    </section>
  )
}

export function WebshopOverviewClient({ stats, stockNotify }: Props) {
  const router = useRouter()

  return (
    <div>
      <PageHeader
        title="Webshop"
        description="Online bolt — kategóriák, tulajdonságok és shop-ready termékek."
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="text-hint text-ink-secondary">Boltban jelölt</p>
          <p className="mt-1 text-h2 tabular-nums text-ink">
            {stats.sellableWeb}
          </p>
        </div>
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="text-hint text-ink-secondary">Majdnem kész</p>
          <p className="mt-1 text-h2 tabular-nums text-warning-ink">
            {stats.blocked}
          </p>
        </div>
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="text-hint text-ink-secondary">Kész a boltra</p>
          <p className="mt-1 text-h2 tabular-nums text-success-ink">
            {stats.ready}
          </p>
        </div>
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="text-hint text-ink-secondary">Szuper kitöltés</p>
          <p className="mt-1 text-h2 tabular-nums text-info-ink">
            {stats.excellent}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => router.push('/webshop/katalogus')}
        >
          <Package className="size-3.5" aria-hidden />
          Bolt katalógus
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => router.push('/webshop/kategoriak')}
        >
          <FolderTree className="size-3.5" aria-hidden />
          Kategóriák ({stats.categories})
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => router.push('/webshop/tulajdonsagok')}
        >
          <Tags className="size-3.5" aria-hidden />
          Jellemzők ({stats.attributes})
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => router.push('/webshop/ertekelesek')}
        >
          <MessageSquare className="size-3.5" aria-hidden />
          Értékelések
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => router.push('/webshop/beallitasok')}
        >
          <Settings2 className="size-3.5" aria-hidden />
          Bolt beállítások
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => router.push('/webshop/csatornak')}
        >
          <Globe className="size-3.5" aria-hidden />
          Csatornák
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => router.push('/torzsadatok/alapanyagok/termekek')}
        >
          Termékek
        </Button>
      </div>

      <StockNotifyList rows={stockNotify.rows} total={stockNotify.total} />

      {stats.sellableWeb === 0 ? (
        <p
          className="mt-4 max-w-xl rounded-md border border-border bg-subtle p-3 text-body text-ink-secondary"
          role="status"
        >
          Még nincs termék a boltban. Nyiss egy terméket, kapcsold be az
          „Elérhető az online boltban” kapcsolót, és válassz kategóriát.
        </p>
      ) : null}
    </div>
  )
}
