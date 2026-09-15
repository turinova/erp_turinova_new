import type { Metadata } from 'next'
import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Nincs hozzáférés'
}

export default function NincsHozzaferesPage() {
  return (
    <div className="mx-auto max-w-md space-y-3 py-10">
      <h1 className="text-h1 text-ink">Nincs hozzáférés ehhez az oldalhoz</h1>
      <p className="text-body text-ink-secondary">
        A fiókodnak nincs joga megnyitni ezt a menüpontot. Ha szükséged van
        rá, kérj hozzáférést a cég adminisztrátorától.
      </p>
      <Link href="/home" className={cn(buttonVariants({ variant: 'primary' }))}>
        Vissza a kezdőlapra
      </Link>
    </div>
  )
}
