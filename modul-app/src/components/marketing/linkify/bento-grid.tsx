import {
  Banknote,
  ClipboardList,
  Factory,
  MessageSquare,
  Package,
  Printer,
  ShoppingCart,
  Store,
  Truck,
  UsersRound
} from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type ModuleCard = {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  name: string
  description: string
  href: string
  cta: string
}

/** Optinova fő modulok — egyforma kártyák, vevői pipa-sorrend. */
export const CARDS: ModuleCard[] = [
  {
    Icon: Package,
    name: 'Készletkezelés',
    description:
      'Raktárankénti nyilvántartás bevételezéssel, kiadással és átadással. Minden mozgás visszakereshető.',
    href: '/hogyan-mukodik#keszlet',
    cta: 'Részletek'
  },
  {
    Icon: Truck,
    name: 'Beszerzés',
    description:
      'A beszállítói rendeléstől a beérkezésig egy folyamat, a megérkezett tétel rögtön növeli a készletet.',
    href: '/hogyan-mukodik#beszerzes',
    cta: 'Részletek'
  },
  {
    Icon: Store,
    name: 'Online POS',
    description:
      'Pénztárfelület műszaknyitással és zárással. Az eladás azonnal lejön a raktári készletből.',
    href: '/hogyan-mukodik#pos',
    cta: 'Részletek'
  },
  {
    Icon: ClipboardList,
    name: 'Jelenléti ív',
    description:
      'Munkanapok és távollétek vezetése dolgozónként, beléptető eszköz nélkül is.',
    href: '/hogyan-mukodik#jelenlet',
    cta: 'Részletek'
  },
  {
    Icon: UsersRound,
    name: 'Belépőszámláló',
    description:
      'Napi és óránkénti látogatószám a boltban. Látszik, mikor van valódi forgalom.',
    href: '/hogyan-mukodik#belepo',
    cta: 'Részletek'
  },
  {
    Icon: Factory,
    name: 'Lapszabászati gyártó',
    description:
      'Táblás és szálas anyag optimalizálása élzárással és szabásjegyzékkel. A méretek a megrendelésből jönnek.',
    href: '/hogyan-mukodik#lapszabaszat',
    cta: 'Részletek'
  },
  {
    Icon: Banknote,
    name: 'Számlázás',
    description:
      'Számla közvetlenül az eladásból, ismételt adatrögzítés nélkül.',
    href: '/hogyan-mukodik#szamlazas',
    cta: 'Részletek'
  },
  {
    Icon: ShoppingCart,
    name: 'Webshop kapcsolat',
    description:
      'A webáruház és a bolt ugyanazt a készletet használja, a webes rendelés is itt jelenik meg.',
    href: '/hogyan-mukodik#webshop',
    cta: 'Részletek'
  },
  {
    Icon: MessageSquare,
    name: 'SMS értesítések',
    description:
      'Automatikus üzenet az ügyfélnek, amint elkészült az ajánlata. Nem kell utána telefonálni.',
    href: '/hogyan-mukodik#sms',
    cta: 'Részletek'
  },
  {
    Icon: Printer,
    name: 'Bolti címkenyomtatás',
    description:
      'Polc- és termékcímke nyomtatása közvetlenül a törzsadatokból.',
    href: '/hogyan-mukodik#cimke',
    cta: 'Részletek'
  }
]

export function BentoGrid({
  children,
  className
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5',
        className
      )}
    >
      {children}
    </div>
  )
}

export function BentoCard({
  name,
  Icon,
  description,
  href,
  cta
}: ModuleCard) {
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex h-full min-h-[11rem] flex-col justify-between rounded-xl border border-zinc-200 bg-zinc-50 p-5 no-underline transition-colors',
        'hover:border-zinc-300 hover:bg-white'
      )}
    >
      <div className="z-10 flex flex-col gap-2">
        <Icon
          strokeWidth={1.5}
          className="h-8 w-8 text-zinc-400 transition-colors group-hover:text-zinc-700"
        />
        <h3 className="text-base font-semibold text-zinc-900">{name}</h3>
        <p className="text-sm leading-snug text-zinc-500">{description}</p>
      </div>
      <span className="mt-4 inline-flex items-center text-[13px] font-medium text-zinc-700">
        {cta}
        <span className="ml-1.5 transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </Link>
  )
}
