"use client"

import { useCallback, useEffect, useState } from "react"
import type { Client } from "@/types/clients"
import { fetchClientsFromApi } from "@/lib/clients/clients-api-client"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CLIENT_TYPE_LABELS } from "@/lib/client-labels"

type ClientSelectProps = {
  value: string
  onChange: (clientId: string, client: Client | null) => void
  disabled?: boolean
  placeholder?: string
}

export function ClientSelect({
  value,
  onChange,
  disabled,
  placeholder = "Válassz ügyfelet…",
}: ClientSelectProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const { clients: rows } = await fetchClientsFromApi()
      setClients(rows)
    } catch {
      setClients([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Select
      value={value || "__none__"}
      onValueChange={(v) => {
        if (v === "__none__") {
          onChange("", null)
          return
        }
        const client = clients.find((c) => c.id === v) ?? null
        onChange(v, client)
      }}
      disabled={disabled || loading}
    >
      <SelectTrigger>
        <SelectValue placeholder={loading ? "Betöltés…" : placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">— Nincs kiválasztva —</SelectItem>
        {clients.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.displayName}
            <span className="ml-2 text-xs text-slate-500">
              ({CLIENT_TYPE_LABELS[c.clientType]})
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
