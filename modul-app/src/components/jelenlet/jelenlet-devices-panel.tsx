'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { JelenletDeviceRow } from '@/lib/jelenlet/types'

type DeviceActions = {
  create: (input: {
    name: string
    slug?: string
  }) => Promise<
    | { ok: true; message?: string; token?: string }
    | { ok: false; message: string }
  >
  rotate: (deviceId: string) => Promise<
    | { ok: true; message?: string; token?: string }
    | { ok: false; message: string }
  >
  update: (input: {
    deviceId: string
    name: string
  }) => Promise<{ ok: true; message?: string } | { ok: false; message: string }>
  remove: (
    deviceId: string
  ) => Promise<{ ok: true; message?: string } | { ok: false; message: string }>
}

export function JelenletDevicesPanel({
  devices: initial,
  addonEnabled,
  actions,
  title = 'Jelenlét — terminálok',
  hint
}: {
  devices: JelenletDeviceRow[]
  addonEnabled: boolean
  actions: DeviceActions
  title?: string
  hint?: ReactNode
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('Főbejárat')
  const [slug, setSlug] = useState('fobejarat')
  const [revealedToken, setRevealedToken] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  function refresh() {
    router.refresh()
  }

  function handleCreate() {
    startTransition(async () => {
      const result = await actions.create({ name, slug })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(result.message ?? 'Kész.')
      if (result.token) setRevealedToken(result.token)
      setName('Főbejárat')
      setSlug('fobejarat')
      refresh()
    })
  }

  function handleRotate(deviceId: string) {
    startTransition(async () => {
      const result = await actions.rotate(deviceId)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(result.message ?? 'Token cserélve.')
      if (result.token) setRevealedToken(result.token)
      refresh()
    })
  }

  function handleSave(deviceId: string, nextName: string) {
    startTransition(async () => {
      const result = await actions.update({ deviceId, name: nextName })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(result.message ?? 'Mentve.')
      refresh()
    })
  }

  function handleDelete() {
    if (!deleteId) return
    startTransition(async () => {
      const result = await actions.remove(deleteId)
      setDeleteId(null)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(result.message ?? 'Törölve.')
      refresh()
    })
  }

  return (
    <section className="rounded-md border border-border bg-surface p-4">
      <div className="mb-3">
        <h2 className="text-body font-semibold text-ink">{title}</h2>
        <p className="text-hint text-ink-secondary">
          {hint ?? (
            <>
              Token egyszer látszik. Endpoint:{' '}
              <code className="text-[12px]">/api/jelenlet/terminal/scan</code>
            </>
          )}
        </p>
      </div>

      {!addonEnabled ? (
        <p className="text-body text-ink-secondary">
          Először kapcsold be a <strong>Jelenlét</strong> add-ont.
        </p>
      ) : (
        <>
          {revealedToken ? (
            <div
              className="mb-4 rounded-md border border-warning/40 bg-warning-soft px-3 py-2"
              role="status"
            >
              <p className="text-[12px] font-medium text-warning-ink">
                Token (egyszer jelenik meg) — másold be a terminálba.
              </p>
              <pre className="mt-2 overflow-x-auto text-[12px] text-ink">
                {revealedToken}
              </pre>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(revealedToken)
                    toast.success('Vágólapra másolva.')
                  }}
                >
                  Másolás
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRevealedToken(null)}
                >
                  Elrejt
                </Button>
              </div>
            </div>
          ) : null}

          <ul className="mb-4 space-y-3">
            {initial.length === 0 ? (
              <li className="text-body text-ink-secondary">Még nincs eszköz.</li>
            ) : (
              initial.map((d) => (
                <DeviceRow
                  key={d.id}
                  device={d}
                  pending={pending}
                  onRotate={() => handleRotate(d.id)}
                  onSave={(n) => handleSave(d.id, n)}
                  onDelete={() => setDeleteId(d.id)}
                />
              ))
            )}
          </ul>

          <div className="grid gap-2 border-t border-border pt-3 sm:grid-cols-2">
            <div>
              <label className="text-[12px] text-ink-muted">Név</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-[12px] text-ink-muted">Slug</label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <Button
            type="button"
            className="mt-3"
            disabled={pending}
            onClick={handleCreate}
          >
            Új terminál + token
          </Button>
        </>
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null)
        }}
        title="Terminál törlése?"
        description="A token azonnal érvénytelen lesz. A napi jelenléti sorok megmaradnak."
        confirmLabel="Törlés"
        loading={pending}
        onConfirm={handleDelete}
      />
    </section>
  )
}

function DeviceRow({
  device,
  pending,
  onRotate,
  onSave,
  onDelete
}: {
  device: JelenletDeviceRow
  pending: boolean
  onRotate: () => void
  onSave: (name: string) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(device.name)

  return (
    <li className="rounded-md border border-border bg-subtle px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-medium text-ink">
            {device.name}{' '}
            <span className="font-normal text-ink-muted">({device.slug})</span>
          </p>
          <p className="text-[12px] text-ink-muted">
            Token: {device.has_token ? 'beállítva' : 'hiányzik'} · Utolsó scan:{' '}
            {device.last_seen_at
              ? new Date(device.last_seen_at).toLocaleString('hu-HU')
              : '—'}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={onRotate}
          >
            Token rotate
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={onDelete}
          >
            Törlés
          </Button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="max-w-xs"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => onSave(name)}
        >
          Mentés
        </Button>
      </div>
    </li>
  )
}
