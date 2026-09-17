import {
  CalendarIcon,
  Link2Icon,
  SearchIcon,
  WaypointsIcon
} from 'lucide-react'
import Image from 'next/image'
import type { ReactNode } from 'react'

import { LINKIFY_ASSET } from '@/lib/marketing/linkify/paths'
import { cn } from '@/lib/utils'

export const CARDS = [
  {
    Icon: Link2Icon,
    name: 'Shorten links',
    description: 'Create short links that are easy to remember and share.',
    cta: 'Learn more',
    className: 'col-span-3 lg:col-span-1',
    background: (
      <Image
        src={LINKIFY_ASSET('shorten-links.svg')}
        alt=""
        width={480}
        height={320}
        className="absolute top-8 left-6 origin-top opacity-90 transition-all duration-300 ease-out [mask-image:linear-gradient(to_top,transparent_0%,#000_100%)] group-hover:scale-105"
      />
    )
  },
  {
    Icon: SearchIcon,
    name: 'Search your links',
    description: 'Quickly find the links you need with AI-powered search.',
    cta: 'Learn more',
    className: 'col-span-3 lg:col-span-2',
    background: (
      <Image
        src={LINKIFY_ASSET('analytics.svg')}
        alt=""
        width={720}
        height={400}
        className="absolute right-6 top-8 w-[70%] origin-top opacity-90 transition-all duration-300 ease-out [mask-image:linear-gradient(to_top,transparent_40%,#000_100%)] group-hover:-translate-x-4"
      />
    )
  },
  {
    Icon: WaypointsIcon,
    name: 'Connect your apps',
    description: 'Integrate with your favorite apps and services.',
    cta: 'Learn more',
    className: 'col-span-3 lg:col-span-2 max-w-full overflow-hidden',
    background: (
      <Image
        src={LINKIFY_ASSET('feature-01.svg')}
        alt=""
        width={600}
        height={300}
        className="absolute right-2 top-4 h-[260px] w-[520px] border-none object-cover object-left transition-all duration-300 ease-out [mask-image:linear-gradient(to_top,transparent_10%,#000_100%)] group-hover:scale-105"
      />
    )
  },
  {
    Icon: CalendarIcon,
    name: 'Calendar',
    description: 'Keep track of your links with our calendar view.',
    cta: 'Learn more',
    className: 'col-span-3 lg:col-span-1',
    background: (
      <Image
        src={LINKIFY_ASSET('feature-02.svg')}
        alt=""
        width={400}
        height={320}
        className="absolute top-10 left-8 opacity-90 transition-all duration-300 ease-out [mask-image:linear-gradient(to_top,transparent_0%,#000_100%)] group-hover:scale-105"
      />
    )
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
        'grid w-full auto-rows-[22rem] grid-cols-3 gap-4',
        className
      )}
    >
      {children}
    </div>
  )
}

export function BentoCard({
  name,
  className,
  background,
  Icon,
  description,
  cta
}: {
  name: string
  className: string
  background: ReactNode
  Icon: React.ComponentType<{ className?: string }>
  description: string
  cta: string
}) {
  return (
    <div
      className={cn(
        'group relative col-span-3 flex flex-col justify-between overflow-hidden rounded-xl border border-zinc-200',
        'bg-zinc-50 [box-shadow:0_-20px_80px_-20px_#0000000a_inset]',
        className
      )}
    >
      <div>{background}</div>
      <div className="pointer-events-none z-10 flex flex-col gap-1 p-6 transition-all duration-300 group-hover:-translate-y-10">
        <Icon className="h-12 w-12 origin-left text-zinc-400 transition-all duration-300 ease-in-out group-hover:scale-75" />
        <h3 className="text-xl font-semibold text-zinc-800">{name}</h3>
        <p className="max-w-lg text-zinc-500">{description}</p>
      </div>
      <div className="absolute bottom-0 flex w-full translate-y-10 flex-row items-center p-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
        <button
          type="button"
          className="inline-flex cursor-default items-center rounded-md px-3 py-1.5 text-[13px] font-medium text-zinc-700"
        >
          {cta}
          <span className="ml-2">→</span>
        </button>
      </div>
      <div className="pointer-events-none absolute inset-0 transition-all duration-300 group-hover:bg-black/[.02]" />
    </div>
  )
}
