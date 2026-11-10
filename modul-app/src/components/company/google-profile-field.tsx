'use client'

import { AlertTriangle, CheckCircle2, Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  googleReviewInputError,
  googleReviewShortPath,
  parseGoogleReviewInput
} from '@/lib/company/google-profile'
import type { TenantGoogleProfile } from '@/lib/company/queries'

type GoogleProfileFieldProps = {
  value: string
  onChange: (value: string) => void
  saved: TenantGoogleProfile
  shortLinkOrigin: string
  disabled: boolean
  error?: string
}

export function GoogleProfileField({
  value,
  onChange,
  saved,
  shortLinkOrigin,
  disabled,
  error
}: GoogleProfileFieldProps) {
  const parsed = parseGoogleReviewInput(value)
  const liveError = googleReviewInputError(parsed)
  const shownError = error ?? (value.trim() ? (liveError ?? undefined) : undefined)
  const dirty = (saved.reviewUrl ?? '') !== (parsed.reviewUrl ?? value.trim())
  const shortUrl = saved.code
    ? `${shortLinkOrigin}${googleReviewShortPath(saved.code)}`
    : null

  async function copyShortUrl() {
    if (!shortUrl) return
    try {
      await navigator.clipboard.writeText(shortUrl)
      toast.success('Rövid link vágólapra másolva.')
    } catch {
      toast.error('Nem sikerült másolni. Jelöld ki és másold kézzel.')
    }
  }

  return (
    <div className="space-y-3">
      <FormField
        label="Értékelő link"
        htmlFor="company-google-review"
        optionalLabel
        error={shownError}
      >
        <Input
          id="company-google-review"
          value={value}
          disabled={disabled}
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://g.page/r/…/review"
          onChange={(e) => onChange(e.target.value)}
        />
      </FormField>

      {!shownError && parsed.kind === 'review_form' ? (
        <p className="flex items-center gap-1.5 text-hint text-success-ink" aria-live="polite">
          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
          Értékelő űrlap — a vevőnek egyből a csillagozás nyílik meg.
        </p>
      ) : null}
      {!shownError && parsed.kind === 'short_unverified' ? (
        <p className="flex items-start gap-1.5 text-hint text-warning-ink" aria-live="polite">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Rövid Google link — mentés után a Megnyitás gombbal ellenőrizd, hogy az értékelő
          űrlap nyílik-e meg, nem csak a cégprofil.
        </p>
      ) : null}

      <details className="group rounded-md border border-border bg-subtle px-3 py-2 text-body">
        <summary className="cursor-pointer select-none text-ink-secondary hover:text-ink">
          Hol találom az értékelő linket?
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-secondary">
          <li>
            Jelentkezz be a cégprofilt kezelő Google-fiókkal, és keress rá a cég nevére a
            Google-ben.
          </li>
          <li>
            A cégprofil paneljén kattints: <span className="text-ink">Értékelések</span> →{' '}
            <span className="text-ink">Több értékelés kérése</span>.
          </li>
          <li>
            <span className="text-ink">Másolás</span>, majd illeszd be ide. A link így néz ki:{' '}
            <code className="text-hint">https://g.page/r/…/review</code>
          </li>
        </ol>
        <p className="mt-2 text-hint text-ink-secondary">
          Ha nem te kezeled a profilt, a Place ID (<code>ChIJ…</code>) is beírható — abból
          elkészítjük a linket.
        </p>
      </details>

      {saved.reviewUrl && shortUrl ? (
        <div className="rounded-md border border-border px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 space-y-0.5">
              <p className="text-label text-ink">Rövid link SMS-hez és QR-kódhoz</p>
              <p className="truncate font-mono text-body text-ink-secondary">{shortUrl}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button type="button" variant="secondary" size="sm" onClick={copyShortUrl}>
                <Copy className="size-3.5" aria-hidden />
                Link másolása
              </Button>
              <a
                href={saved.reviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
              >
                <ExternalLink className="size-3.5" aria-hidden />
                Megnyitás
              </a>
            </div>
          </div>
          <p className="mt-1.5 text-hint text-ink-secondary">
            Nem változik, ha később új értékelő linket adsz meg. Megnyitás az utolsó 30
            napban: {saved.clicks30d.toLocaleString('hu-HU')}
            {dirty ? ' · A módosítás mentés után él.' : null}
          </p>
        </div>
      ) : value.trim() && !shownError ? (
        <p className="text-hint text-ink-secondary">
          Mentés után itt jelenik meg a rövid link, amit SMS-ben és QR-kódon használhatsz.
        </p>
      ) : null}
    </div>
  )
}
