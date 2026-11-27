'use client'

import { Copy, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  regenerateOpenAiFeedTokenAction,
  saveOpenAiFeedAction,
  type OpenAiFeedInput
} from '@/lib/feeds/openai/actions'
import type { OpenAiFeedSettings } from '@/lib/feeds/openai/load'

type Props = {
  available: boolean
  canWrite: boolean
  initial: OpenAiFeedSettings
  feedUrl: string | null
  sellerName: string
}

const dateFmt = new Intl.DateTimeFormat('hu-HU', { dateStyle: 'short', timeStyle: 'short' })

export function OpenAiFeedForm({ available, canWrite, initial, feedUrl, sellerName }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<OpenAiFeedInput>({
    enabled: initial.enabled,
    siteBaseUrl: initial.siteBaseUrl,
    sheetPath: initial.sheetPath,
    linearPath: initial.linearPath,
    country: initial.country,
    pickupText: initial.pickupText,
    returnPolicyUrl: initial.returnPolicyUrl,
    returnDays: initial.returnDays
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const disabled = !canWrite || !available || pending

  function patch(p: Partial<OpenAiFeedInput>) {
    setForm((f) => ({ ...f, ...p }))
  }

  function save() {
    setFieldErrors({})
    startTransition(async () => {
      const r = await saveOpenAiFeedAction(form)
      if (!r.ok) {
        if (r.fieldErrors) setFieldErrors(r.fieldErrors)
        toast.error(r.message)
        return
      }
      toast.success('Feed beállítások mentve.')
      router.refresh()
    })
  }

  function regenerate() {
    startTransition(async () => {
      const r = await regenerateOpenAiFeedTokenAction()
      setConfirmOpen(false)
      if (!r.ok) {
        toast.error(r.message)
        return
      }
      toast.success('Új feed link elkészült. A régi már nem működik.')
      router.refresh()
    })
  }

  async function copy() {
    if (!feedUrl) return
    try {
      await navigator.clipboard.writeText(feedUrl)
      toast.success('Link vágólapra másolva.')
    } catch {
      toast.error('Nem sikerült másolni.')
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Termékfeedek"
        description="A bútorlapok és munkalapok listája a ChatGPT bevásárlókeresőjének. Csak az indexelhető, sluggal, képpel és árral rendelkező tételek kerülnek bele."
        actions={
          canWrite && available ? (
            <Button type="button" onClick={save} loading={pending}>
              {pending ? 'Mentés…' : 'Mentés'}
            </Button>
          ) : null
        }
      />

      {!available ? (
        <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-body text-warning-ink">
          A beállításokhoz futtasd a <code className="text-hint">20261031_product_feeds.sql</code> migrációt.
        </p>
      ) : null}
      {!canWrite ? (
        <p className="rounded-md border border-border bg-subtle px-3 py-2 text-body text-ink-secondary">
          Csak megtekintési jogod van, nem módosíthatsz.
        </p>
      ) : null}
      <p className="rounded-md border border-info/30 bg-info-soft px-3 py-2 text-body text-info-ink">
        Az OpenAI jelenleg csak amerikai (US) célpiacú feedeket fogad el automatikusan. Magyar (HU) feedhez külön
        jóváhagyást kell kérni a ChatGPT Merchants felületen; addig a link működik, de nem jelenik meg a ChatGPT-ben.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <FormSection title="ChatGPT (OpenAI) feed" columns={1}>
          <Switch
            id="feed-enabled"
            checked={form.enabled}
            disabled={disabled}
            onCheckedChange={(v) => patch({ enabled: v })}
            label="Feed bekapcsolva"
            description="Kikapcsolva a link 404-et ad."
          />
          {feedUrl ? (
            <FormField label="Feed link (titkos, ne oszd meg)" htmlFor="feed-url">
              <div className="flex gap-2">
                <Input id="feed-url" value={feedUrl} readOnly className="font-mono text-hint" />
                <Button type="button" variant="secondary" onClick={copy}>
                  <Copy className="size-4" aria-hidden />
                  Link másolása
                </Button>
              </div>
            </FormField>
          ) : (
            <p className="text-body text-ink-secondary">Az első mentés után kapsz linket.</p>
          )}
          {feedUrl ? (
            <div className="flex flex-wrap items-center gap-2 text-hint text-ink-secondary">
              <span>
                {initial.lastFetchedAt
                  ? `Utolsó letöltés: ${dateFmt.format(new Date(initial.lastFetchedAt))}, ${initial.lastItemCount ?? 0} tétel`
                  : 'Még senki nem töltötte le.'}
              </span>
              {canWrite ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmOpen(true)} disabled={pending}>
                  <RefreshCw className="size-3.5" aria-hidden />
                  Új link készítése
                </Button>
              ) : null}
            </div>
          ) : null}
          <p className="text-hint text-ink-secondary">
            Eladó neve a feedben: <span className="text-ink">{sellerName || '— add meg a Cégadatoknál'}</span>
          </p>
        </FormSection>

        <FormSection title="Weboldal és átvétel" columns={2}>
          <FormField label="Weboldal címe" htmlFor="feed-base" error={fieldErrors.siteBaseUrl} className="sm:col-span-2">
            <Input
              id="feed-base"
              value={form.siteBaseUrl}
              disabled={disabled}
              onChange={(e) => patch({ siteBaseUrl: e.target.value })}
            />
          </FormField>
          <FormField label="Bútorlap útvonal" htmlFor="feed-sheet">
            <Input id="feed-sheet" value={form.sheetPath} disabled={disabled} onChange={(e) => patch({ sheetPath: e.target.value })} />
          </FormField>
          <FormField label="Munkalap útvonal" htmlFor="feed-linear">
            <Input id="feed-linear" value={form.linearPath} disabled={disabled} onChange={(e) => patch({ linearPath: e.target.value })} />
          </FormField>
          <FormField
            label="Személyes átvétel"
            htmlFor="feed-pickup"
            hint="Cím és nyitvatartás — a termékleírás végére kerül."
            error={fieldErrors.pickupText}
            className="sm:col-span-2"
          >
            <Input id="feed-pickup" value={form.pickupText} disabled={disabled} onChange={(e) => patch({ pickupText: e.target.value })} />
          </FormField>
          <FormField label="Visszaküldési határidő (nap)" htmlFor="feed-days" error={fieldErrors.returnDays}>
            <Input
              id="feed-days"
              type="number"
              inputMode="numeric"
              min={0}
              max={365}
              value={form.returnDays}
              disabled={disabled}
              onChange={(e) => patch({ returnDays: Number(e.target.value) })}
            />
          </FormField>
          <FormField label="Országkód" htmlFor="feed-country" error={fieldErrors.country}>
            <Input id="feed-country" value={form.country} maxLength={2} disabled={disabled} onChange={(e) => patch({ country: e.target.value })} />
          </FormField>
          <FormField
            label="Visszaküldési feltételek link"
            htmlFor="feed-return"
            optionalLabel
            error={fieldErrors.returnPolicyUrl}
            className="sm:col-span-2"
          >
            <Input id="feed-return" value={form.returnPolicyUrl} disabled={disabled} onChange={(e) => patch({ returnPolicyUrl: e.target.value })} />
          </FormField>
        </FormSection>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Új feed link készítése?"
        description="A régi link azonnal megszűnik. Az új linket be kell állítanod a ChatGPT Merchants felületen."
        confirmLabel="Új link készítése"
        variant="danger"
        loading={pending}
        onConfirm={regenerate}
      />
    </div>
  )
}
