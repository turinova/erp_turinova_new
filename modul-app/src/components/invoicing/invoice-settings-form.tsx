'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  saveInvoiceSettingsAction,
  testInvoiceConnectionAction
} from '@/lib/invoicing/actions'
import type { TenantInvoiceSettings } from '@/lib/invoicing/types'

type Props = {
  initial: TenantInvoiceSettings
  canWrite: boolean
}

export function InvoiceSettingsForm({ initial, canWrite }: Props) {
  const router = useRouter()
  const [agentKey, setAgentKey] = useState(initial.agent_key ?? '')
  const [apiUrl, setApiUrl] = useState(initial.api_url ?? '')
  const [sendEmail, setSendEmail] = useState(initial.default_send_email)
  const [language, setLanguage] = useState(initial.default_language || 'hu')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setAgentKey(initial.agent_key ?? '')
    setApiUrl(initial.api_url ?? '')
    setSendEmail(initial.default_send_email)
    setLanguage(initial.default_language || 'hu')
  }, [initial])

  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-md border border-border bg-surface p-3.5 space-y-3">
        <div>
          <h2 className="text-h3 text-ink">Számlázz.hu Agent</h2>
          <p className="mt-0.5 text-hint text-ink-secondary">
            A kulcs a Számlázz.hu fiókban: Beállítások → Számla Agent.
            A számlák ott készülnek; itt csak kiállítjuk és listázzuk őket.
          </p>
        </div>

        <FormField label="Agent kulcs" htmlFor="inv-agent" required>
          <Input
            id="inv-agent"
            type="password"
            autoComplete="off"
            value={agentKey}
            disabled={!canWrite || pending}
            onChange={(e) => setAgentKey(e.target.value)}
            placeholder="szamlaagentkulcs"
          />
        </FormField>

        <FormField
          label="API URL"
          htmlFor="inv-url"
          optionalLabel
          hint="Üresen a hivatalos végpontot használjuk."
        >
          <Input
            id="inv-url"
            value={apiUrl}
            disabled={!canWrite || pending}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://www.szamlazz.hu/szamla/"
          />
        </FormField>

        <FormField label="Alapértelmezett nyelv" htmlFor="inv-lang">
          <select
            id="inv-lang"
            className="flex h-9 w-full rounded-md border border-border bg-surface px-2.5 text-body"
            value={language}
            disabled={!canWrite || pending}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="hu">Magyar</option>
            <option value="en">Angol</option>
            <option value="de">Német</option>
          </select>
        </FormField>

        <label className="flex items-center gap-2 text-body text-ink">
          <input
            type="checkbox"
            checked={sendEmail}
            disabled={!canWrite || pending}
            onChange={(e) => setSendEmail(e.target.checked)}
            className="size-4 rounded border-border"
          />
          Alapból küldjön e-mailt a vevőnek
        </label>

        {error ? (
          <p className="text-hint text-danger-ink" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-hint text-success-ink" role="status">
            {message}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="secondary"
            disabled={!canWrite || pending || !agentKey.trim()}
            onClick={() => {
              setError(null)
              setMessage(null)
              startTransition(async () => {
                const save = await saveInvoiceSettingsAction({
                  agentKey,
                  apiUrl,
                  defaultSendEmail: sendEmail,
                  defaultLanguage: language
                })
                if (!save.ok) {
                  setError(save.message)
                  return
                }
                const test = await testInvoiceConnectionAction()
                if (!test.ok) {
                  setError(test.message)
                  setMessage('Mentve, de a kapcsolat teszt sikertelen.')
                  return
                }
                setMessage(test.message ?? 'OK')
                router.refresh()
              })
            }}
          >
            Mentés és teszt
          </Button>
          <Button
            type="button"
            disabled={!canWrite || pending}
            onClick={() => {
              setError(null)
              setMessage(null)
              startTransition(async () => {
                const result = await saveInvoiceSettingsAction({
                  agentKey,
                  apiUrl,
                  defaultSendEmail: sendEmail,
                  defaultLanguage: language
                })
                if (!result.ok) {
                  setError(result.message)
                  return
                }
                setMessage(result.message ?? 'Mentve.')
                router.refresh()
              })
            }}
          >
            Mentés
          </Button>
        </div>
      </div>
    </div>
  )
}
