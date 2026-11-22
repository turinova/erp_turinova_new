'use client'

import { Copy, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import { Switch } from '@/components/ui/switch'
import { KIOSK_EDGE_TYPES, type KioskEdgeTypeId } from '@/lib/kiosk/edge-types'
import { kioskPairingUrl } from '@/lib/kiosk/pairing'
import {
  createKioskDeviceAction,
  revokeKioskDeviceAction,
  rotateKioskDeviceTokenAction,
  saveKioskSettingsAction
} from '@/lib/kiosk/settings-actions'
import {
  KIOSK_CATALOG_MODE_OPTIONS,
  type KioskCatalogMode,
  type KioskDeviceRow,
  type KioskEdgeOption,
  type KioskSettings,
  type KioskSheetOption
} from '@/lib/kiosk/settings-types'
import { cn } from '@/lib/utils'

type Props = {
  initial: KioskSettings
  devices: KioskDeviceRow[]
  edges: KioskEdgeOption[]
  sheets: KioskSheetOption[]
  tenantSlug: string
  canWrite: boolean
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange
}: {
  id: string
  label: string
  hint?: string
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="py-1">
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        label={label}
        description={hint}
      />
    </div>
  )
}

function formatSeen(iso: string | null) {
  if (!iso) return 'még nem'
  try {
    return new Intl.DateTimeFormat('hu-HU', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function KioskSettingsClient({
  initial,
  devices: initialDevices,
  edges,
  sheets,
  tenantSlug,
  canWrite
}: Props) {
  const [settings, setSettings] = useState<KioskSettings>(initial)
  const [devices, setDevices] = useState(initialDevices)
  const [pending, startTransition] = useTransition()
  const [devicePending, startDeviceTransition] = useTransition()
  const [newDeviceName, setNewDeviceName] = useState('')
  const [pairing, setPairing] = useState<{
    deviceId: string
    deviceName: string
    url: string
  } | null>(null)
  const [removeTarget, setRemoveTarget] = useState<{
    id: string
    name: string
  } | null>(null)
  const [sheetQuery, setSheetQuery] = useState('')

  const kioskPath = `/k/${tenantSlug}`
  const edgeOptions = useMemo(
    () => edges.map((e) => ({ value: e.id, label: e.label })),
    [edges]
  )

  const showFavorites =
    settings.catalogMode === 'favorites' ||
    settings.catalogMode === 'stock_and_favorites'

  const filteredSheets = useMemo(() => {
    const q = sheetQuery.trim().toLowerCase()
    const list = sheets.filter((s) => {
      if (!q) return true
      return (
        s.name.toLowerCase().includes(q) ||
        s.manufacturerName.toLowerCase().includes(q) ||
        String(s.thicknessMm).includes(q)
      )
    })
    return list.slice(0, 40)
  }, [sheets, sheetQuery])

  const selectedSheets = useMemo(() => {
    const set = new Set(settings.favoriteSheetIds)
    return sheets.filter((s) => set.has(s.id))
  }, [sheets, settings.favoriteSheetIds])

  function patch(p: Partial<KioskSettings>) {
    setSettings((s) => ({ ...s, ...p }))
  }

  function setEdgeMap(typeId: KioskEdgeTypeId, edgeId: string) {
    setSettings((s) => {
      const next = { ...s.edgeTypeMap }
      if (!edgeId) delete next[typeId]
      else next[typeId] = edgeId
      return { ...s, edgeTypeMap: next }
    })
  }

  function toggleFavorite(sheetId: string) {
    setSettings((s) => {
      const has = s.favoriteSheetIds.includes(sheetId)
      return {
        ...s,
        favoriteSheetIds: has
          ? s.favoriteSheetIds.filter((id) => id !== sheetId)
          : [...s.favoriteSheetIds, sheetId]
      }
    })
  }

  function save() {
    startTransition(async () => {
      const result = await saveKioskSettingsAction(settings)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Elmentve.')
    })
  }

  function copyLink() {
    void navigator.clipboard.writeText(
      `${window.location.origin}${kioskPath}`
    )
    toast.success('A kiosk címe a vágólapon.')
  }

  function copyPairingLink(url: string) {
    void navigator.clipboard.writeText(url)
    toast.success('A párosító link a vágólapon.')
  }

  function showPairing(deviceId: string, deviceName: string, token: string) {
    setPairing({
      deviceId,
      deviceName,
      url: kioskPairingUrl(window.location.origin, kioskPath, token)
    })
  }

  function createDevice() {
    const name = newDeviceName.trim()
    startDeviceTransition(async () => {
      const result = await createKioskDeviceAction({ name })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(result.message ?? 'Gép hozzáadva.')
      setNewDeviceName('')
      if (result.token && result.deviceId) {
        showPairing(result.deviceId, name, result.token)
        setDevices((prev) => [
          ...prev,
          {
            id: result.deviceId!,
            name: name || 'Kiosk gép',
            lastSeenAt: null,
            revokedAt: null,
            createdAt: new Date().toISOString(),
            hasToken: true
          }
        ])
      }
    })
  }

  function rotateDevice(deviceId: string, deviceName: string) {
    startDeviceTransition(async () => {
      const result = await rotateKioskDeviceTokenAction({ deviceId })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(result.message ?? 'Új párosító link kész.')
      if (result.token) {
        showPairing(deviceId, deviceName, result.token)
      }
    })
  }

  function removeDevice() {
    if (!removeTarget) return
    const deviceId = removeTarget.id
    startDeviceTransition(async () => {
      const result = await revokeKioskDeviceAction({ deviceId })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(result.message ?? 'Gép eltávolítva.')
      setDevices((prev) => prev.filter((d) => d.id !== deviceId))
      setPairing((p) => (p?.deviceId === deviceId ? null : p))
      setRemoveTarget(null)
    })
  }

  const disabled = !canWrite || pending
  const mappedEdgeCount = Object.keys(settings.edgeTypeMap).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 text-ink">Kiosk beállítások</h1>
          <p className="mt-1 max-w-xl text-body text-ink-secondary">
            A boltban a vevők itt állítják össze a lapszabász rendelésüket. A
            vágás és az élzárás díját az{' '}
            <a href="/beallitasok/opti" className="underline underline-offset-2">
              Opti beállításokban
            </a>{' '}
            adod meg.
          </p>
        </div>
        {canWrite ? (
          <Button
            type="button"
            variant="primary"
            loading={pending}
            onClick={save}
          >
            Mentés
          </Button>
        ) : null}
      </div>

      <FormSection title="Általános" columns={1}>
        <ToggleRow
          id="kiosk-enabled"
          label="Kiosk bekapcsolva"
          hint="Ha kikapcsolod, a kiosk képernyőn nem lehet rendelést leadni."
          checked={settings.enabled}
          disabled={disabled}
          onChange={(v) => patch({ enabled: v })}
        />
        <FormField label="A kiosk címe" htmlFor="kiosk-public-link">
          <div className="flex flex-wrap items-center gap-2">
            <code
              id="kiosk-public-link"
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-hint text-ink"
            >
              {kioskPath}
            </code>
            <Button
              type="button"
              variant="secondary"
              className="h-8 gap-1.5 px-2.5 text-[13px]"
              onClick={copyLink}
            >
              <Copy className="size-3.5" aria-hidden />
              Link másolása
            </Button>
          </div>
        </FormField>
        <p className="text-[13px] text-ink-secondary">
          {settings.enabled ? 'Bekapcsolva.' : 'Kikapcsolva.'}{' '}
          {KIOSK_EDGE_TYPES.length} élzáró típusból {mappedEdgeCount} van
          beállítva.{' '}
          {devices.length === 0
            ? 'Nincs felvett kiosk gép.'
            : `${devices.length} kiosk gép.`}
        </p>
      </FormSection>

      <FormSection
        title="Milyen lapokat lát a vevő?"
        description="A vevő ezek közül választhat az első lépésben."
        columns={1}
      >
        <fieldset className="space-y-2" disabled={disabled}>
          <legend className="sr-only">Milyen lapokat lát a vevő</legend>
          {KIOSK_CATALOG_MODE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                'flex cursor-pointer gap-3 rounded-md border border-border bg-surface px-3 py-2.5',
                settings.catalogMode === opt.value && 'border-ink'
              )}
            >
              <input
                type="radio"
                name="catalog-mode"
                className="mt-1"
                checked={settings.catalogMode === opt.value}
                onChange={() =>
                  patch({ catalogMode: opt.value as KioskCatalogMode })
                }
              />
              <span>
                <span className="block text-[13.5px] font-medium text-ink">
                  {opt.label}
                </span>
                <span className="block text-[12.5px] text-ink-muted">
                  {opt.hint}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        {showFavorites ? (
          <div className="space-y-2 border-t border-border pt-3">
            <FormField
              label="Kiválasztott lapok"
              htmlFor="kiosk-sheet-search"
              hint="Jelölj ki legalább egyet. Kattints egy lapra a listában, és bekerül."
            >
              <Input
                id="kiosk-sheet-search"
                value={sheetQuery}
                onChange={(e) => setSheetQuery(e.target.value)}
                placeholder="Keress névre, gyártóra vagy vastagságra"
                disabled={disabled}
              />
            </FormField>
            {selectedSheets.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {selectedSheets.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleFavorite(s.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[12.5px] text-ink hover:bg-subtle"
                      aria-label={`${s.name} ${s.thicknessMm} mm kivétele`}
                    >
                      {s.name} {s.thicknessMm} mm
                      <X className="size-3.5 text-ink-muted" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-ink-muted">Még nem jelöltél ki lapot.</p>
            )}
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {filteredSheets.length === 0 ? (
                <li className="px-1 py-2 text-[13px] text-ink-muted">
                  Nincs találat.
                </li>
              ) : (
                filteredSheets.map((s) => {
                  const on = settings.favoriteSheetIds.includes(s.id)
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleFavorite(s.id)}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-[13px]',
                          on ? 'bg-subtle font-medium text-ink' : 'text-ink-secondary hover:bg-subtle'
                        )}
                      >
                        <span className="min-w-0 truncate">
                          {s.name} · {s.thicknessMm} mm
                          <span className="text-ink-muted">
                            {' '}
                            · {s.manufacturerName}
                          </span>
                        </span>
                        <span className="shrink-0 text-[12px] text-ink-muted">
                          {s.onStock ? 'Raktáron' : 'Rendelésre'}
                          {on ? ', kiválasztva' : ''}
                        </span>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        ) : null}
      </FormSection>

      <FormSection
        title="Élzáró típusok"
        description="Add meg, melyik élzáró tartozik az egyes típusokhoz. Amelyiknél nem választasz, az nem jelenik meg a vevőnek."
        columns={1}
      >
        <div className="space-y-3">
          {KIOSK_EDGE_TYPES.map((type) => (
            <FormField
              key={type.id}
              label={type.name}
              htmlFor={`kiosk-edge-${type.id}`}
              hint={
                type.requiresDuplung
                  ? 'Csak akkor kínáljuk, ha a vevő duplungolást kér.'
                  : undefined
              }
            >
              <div className="flex items-center gap-2">
                <span
                  className="size-3 shrink-0 rounded-sm"
                  style={{ background: type.color }}
                  aria-hidden
                />
                <MenuSelect
                  id={`kiosk-edge-${type.id}`}
                  value={settings.edgeTypeMap[type.id] ?? ''}
                  onChange={(v) => setEdgeMap(type.id, v)}
                  options={edgeOptions}
                  placeholder="Válassz élzárót"
                  emptyLabel="Nincs hozzárendelve"
                  searchable
                  allowEmpty
                  disabled={disabled || edgeOptions.length === 0}
                  className="min-w-0 flex-1"
                />
              </div>
            </FormField>
          ))}
          {edgeOptions.length === 0 ? (
            <p className="text-[13px] text-ink-muted">
              Még nincs élzáró felvéve. Az Élzárók oldalon tudod hozzáadni.
            </p>
          ) : null}
        </div>
      </FormSection>

      <FormSection title="Rendelés és képernyő" columns={2}>
        <FormField
          label="Legfeljebb hány féle darab"
          htmlFor="kiosk-max-rows"
          hint="Ennyi különböző méretű darab fér egy rendelésbe."
        >
          <Input
            id="kiosk-max-rows"
            type="number"
            min={1}
            max={40}
            value={settings.maxPanelRows}
            disabled={disabled}
            onChange={(e) =>
              patch({ maxPanelRows: Number(e.target.value) || 1 })
            }
          />
        </FormField>
        <FormField
          label="Legfeljebb hány darab egy méretből"
          htmlFor="kiosk-max-qty"
          hint="Ennél többet a pultnál lehet rendelni."
        >
          <Input
            id="kiosk-max-qty"
            type="number"
            min={1}
            max={100}
            value={settings.maxQtyPerLine}
            disabled={disabled}
            onChange={(e) =>
              patch({ maxQtyPerLine: Number(e.target.value) || 1 })
            }
          />
        </FormField>
        <FormField
          label="Figyelmeztetés tétlenség után (másodperc)"
          htmlFor="kiosk-idle-warn"
          hint="Ha a vevő ennyi ideig nem kattint, megkérdezzük, ott van-e még."
        >
          <Input
            id="kiosk-idle-warn"
            type="number"
            min={30}
            max={600}
            value={settings.idleWarnSec}
            disabled={disabled}
            onChange={(e) =>
              patch({ idleWarnSec: Number(e.target.value) || 75 })
            }
          />
        </FormField>
        <FormField
          label="Újrakezdés tétlenség után (másodperc)"
          htmlFor="kiosk-idle-reset"
          hint="Ennyi idő után a kiosk törli a félbehagyott rendelést, és a kezdőképernyőre ugrik."
        >
          <Input
            id="kiosk-idle-reset"
            type="number"
            min={45}
            max={900}
            value={settings.idleResetSec}
            disabled={disabled}
            onChange={(e) =>
              patch({ idleResetSec: Number(e.target.value) || 90 })
            }
          />
        </FormField>
      </FormSection>

      <FormSection
        title="Kiosk gépek"
        description="Csak az itt felvett gépeken lehet rendelést leadni. Amíg nincs itt egy gép sem, a kiosk bármelyik gépen működik."
        columns={1}
      >
        {canWrite ? (
          <div className="flex flex-wrap items-end gap-2">
            <FormField
              label="A gép neve"
              htmlFor="kiosk-device-name"
              className="min-w-[200px] flex-1"
            >
              <Input
                id="kiosk-device-name"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                placeholder="pl. Kiosk a bejáratnál"
                disabled={devicePending}
              />
            </FormField>
            <Button
              type="button"
              variant="secondary"
              className="h-9 gap-1.5"
              loading={devicePending}
              disabled={!newDeviceName.trim()}
              onClick={createDevice}
            >
              <Plus className="size-3.5" aria-hidden />
              Gép hozzáadása
            </Button>
          </div>
        ) : null}

        {pairing ? (
          <div
            className="rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2.5"
            role="status"
          >
            <p className="text-[13px] font-medium text-ink">
              Párosító link a(z) „{pairing.deviceName}” géphez
            </p>
            <p className="mt-0.5 text-[13px] text-ink-secondary">
              Nyisd meg ezt a linket egyszer a kiosk gép böngészőjében. Utána
              azon a gépen lehet rendelni. A link később nem jelenik meg újra.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded border border-border bg-surface px-2 py-1 text-[12px]">
                {pairing.url}
              </code>
              <Button
                type="button"
                variant="secondary"
                className="h-8 gap-1.5 px-2.5 text-[13px]"
                onClick={() => copyPairingLink(pairing.url)}
              >
                <Copy className="size-3.5" aria-hidden />
                Link másolása
              </Button>
            </div>
          </div>
        ) : null}

        {devices.length === 0 ? (
          <p className="text-[13px] text-ink-muted">
            Még nincs felvett gép. A kiosk addig bármelyik gépen megnyitható.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {devices.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
              >
                <div>
                  <p className="text-[13.5px] font-medium text-ink">{d.name}</p>
                  <p className="text-[12.5px] text-ink-muted">
                    Utoljára használták: {formatSeen(d.lastSeenAt)}
                  </p>
                </div>
                {canWrite ? (
                  <div className="flex gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 gap-1 px-2 text-[13px]"
                      disabled={devicePending}
                      onClick={() => rotateDevice(d.id, d.name)}
                    >
                      <RefreshCw className="size-3.5" aria-hidden />
                      Új párosító link
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 gap-1 px-2 text-[13px] text-danger-ink"
                      disabled={devicePending}
                      onClick={() => setRemoveTarget({ id: d.id, name: d.name })}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Eltávolítás
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </FormSection>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => {
          if (!open && !devicePending) setRemoveTarget(null)
        }}
        title="Gép eltávolítása"
        description={
          removeTarget
            ? `Eltávolítod a(z) „${removeTarget.name}” gépet? Ezen a gépen ezután nem lehet rendelést leadni.`
            : ''
        }
        confirmLabel="Eltávolítás"
        loading={devicePending}
        onConfirm={removeDevice}
      />
    </div>
  )
}
