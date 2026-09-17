'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  createFootcounterDevice,
  deleteFootcounterDevice,
  rotateFootcounterDeviceToken,
  updateFootcounterDevice
} from '@/lib/footcounter/platform-actions'
import type { FootcounterDeviceRow } from '@/lib/footcounter/types'

export function FootcounterDevicesPanel({
  tenantId,
  devices: initial,
  addonEnabled
}: {
  tenantId: string
  devices: FootcounterDeviceRow[]
  addonEnabled: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('Bejárat')
  const [slug, setSlug] = useState('bejarat')
  const [streamUrl, setStreamUrl] = useState('')
  const [revealedToken, setRevealedToken] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  function refresh() {
    router.refresh()
  }

  function handleCreate() {
    startTransition(async () => {
      const result = await createFootcounterDevice({
        tenantId,
        name,
        slug,
        streamUrl: streamUrl || null
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(result.message ?? 'Kész.')
      if (result.token) setRevealedToken(result.token)
      setName('Bejárat')
      setSlug('bejarat')
      setStreamUrl('')
      refresh()
    })
  }

  function handleRotate(deviceId: string) {
    startTransition(async () => {
      const result = await rotateFootcounterDeviceToken({ tenantId, deviceId })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(result.message ?? 'Token cserélve.')
      if (result.token) setRevealedToken(result.token)
      refresh()
    })
  }

  function handleSave(device: FootcounterDeviceRow, nextName: string, nextStream: string) {
    startTransition(async () => {
      const result = await updateFootcounterDevice({
        tenantId,
        deviceId: device.id,
        name: nextName,
        streamUrl: nextStream || null
      })
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
      const result = await deleteFootcounterDevice({
        tenantId,
        deviceId: deleteId
      })
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
        <h2 className="text-body font-semibold text-ink">Belépők — Pi eszközök</h2>
        <p className="text-hint text-ink-secondary">
          Sync token a platformon generálódik (nincs Vercel env tenantonként).
          Közös endpoint: <code className="text-[12px]">/api/footcounter/sync</code>
        </p>
      </div>

      {!addonEnabled ? (
        <p className="text-body text-ink-secondary">
          Először kapcsold be a <strong>Belépők</strong> add-ont fent.
        </p>
      ) : (
        <>
          {revealedToken ? (
            <div
              className="mb-4 rounded-md border border-warning/40 bg-warning-soft px-3 py-2"
              role="status"
            >
              <p className="text-[12px] font-medium text-warning-ink">
                Sync token (egyszer látszik) — másold a Pi{' '}
                <code>config.env</code> → <code>FOOTCOUNTER_SYNC_SECRET</code>
              </p>
              <pre className="mt-2 overflow-x-auto text-[12px] text-ink">
                {revealedToken}
              </pre>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={() => {
                  void navigator.clipboard.writeText(revealedToken)
                  toast.success('Vágólapra másolva.')
                }}
              >
                Másolás
              </Button>
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
                  onSave={handleSave}
                  onDelete={() => setDeleteId(d.id)}
                />
              ))
            )}
          </ul>

          <div className="grid gap-2 border-t border-border pt-3 sm:grid-cols-3">
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
            <div>
              <label className="text-[12px] text-ink-muted">
                Stream URL (opcionális)
              </label>
              <Input
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                placeholder="http://…/stream.mjpg"
                className="mt-1"
              />
            </div>
          </div>
          <Button
            type="button"
            variant="primary"
            size="md"
            className="mt-3"
            disabled={pending}
            onClick={handleCreate}
          >
            Új eszköz + token
          </Button>
        </>
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null)
        }}
        title="Eszköz törlése?"
        description="Az áthaladási adatok is törlődnek (cascade)."
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
  device: FootcounterDeviceRow
  pending: boolean
  onRotate: () => void
  onSave: (
    device: FootcounterDeviceRow,
    name: string,
    streamUrl: string
  ) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(device.name)
  const [streamUrl, setStreamUrl] = useState(device.stream_url ?? '')

  return (
    <li className="rounded-md border border-border bg-subtle px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-medium text-ink">
            {device.name}{' '}
            <span className="font-normal text-ink-muted">({device.slug})</span>
          </p>
          <p className="text-[12px] text-ink-muted">
            Token: {device.has_token ? 'beállítva' : 'hiányzik'} · Utolsó sync:{' '}
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
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          value={streamUrl}
          onChange={(e) => setStreamUrl(e.target.value)}
          placeholder="stream URL"
        />
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-2"
        disabled={pending}
        onClick={() => onSave(device, name, streamUrl)}
      >
        Mentés
      </Button>
    </li>
  )
}
