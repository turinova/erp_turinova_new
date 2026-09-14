'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePlatformHref } from '@/lib/platform/use-platform-href'

export function PlatformSearchClient({
  initialQuery
}: {
  initialQuery: string
}) {
  const router = useRouter()
  const href = usePlatformHref()
  const [q, setQ] = useState(initialQuery)
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const next = q.trim()
    startTransition(() => {
      const base = href('/kereses')
      router.push(next ? `${base}?q=${encodeURIComponent(next)}` : base)
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <div className="min-w-[220px] flex-1">
        <label htmlFor="platform-q" className="mb-1 block text-hint text-ink-secondary">
          Keresés
        </label>
        <Input
          id="platform-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="pl. Acme, admin@…, slug"
          autoFocus
        />
      </div>
      <Button type="submit" variant="primary" loading={pending}>
        Keresés
      </Button>
    </form>
  )
}
