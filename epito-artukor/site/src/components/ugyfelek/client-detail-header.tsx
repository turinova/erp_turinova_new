import Link from "next/link"
import { ArrowLeft, Pencil } from "lucide-react"
import type { Client } from "@/types/clients"
import { CLIENT_TYPE_LABELS } from "@/lib/client-labels"
import {
  ClientStatusBadge,
  ClientTypeBadge,
} from "@/components/ugyfelek/client-badges"
import { Button } from "@/components/ui/button"

type ClientDetailHeaderProps = {
  client: Client
  onEdit: () => void
}

export function ClientDetailHeader({ client, onEdit }: ClientDetailHeaderProps) {
  const city = client.billingAddress.city?.trim() || null

  const metaParts = [
    client.legalName !== client.displayName ? client.legalName : null,
    client.clientType === "company" && client.taxNumber ? client.taxNumber : null,
    city,
  ].filter(Boolean)

  return (
    <header className="mb-4">
      <Link
        href="/ugyfelek"
        className="mb-3 inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Ügyfelek
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            aria-hidden
            className="mt-1.5 h-8 w-1 shrink-0 rounded-full bg-[var(--page-accent)]"
          />
          <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-950 sm:text-3xl">
            {client.displayName}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600 sm:text-base">
            <span className="font-code font-semibold text-blue-700">{client.code}</span>
            {metaParts.length > 0 ? (
              <>
                {metaParts.map((part) => (
                  <span key={part}>
                    <span className="mx-1.5 text-slate-300">·</span>
                    <span className="font-medium text-slate-800">{part}</span>
                  </span>
                ))}
              </>
            ) : null}
          </p>
          <p className="mt-1 text-xs text-slate-500">{CLIENT_TYPE_LABELS[client.clientType]}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-semibold"
            onClick={onEdit}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Szerkesztés
          </Button>
          <ClientTypeBadge type={client.clientType} className="text-xs font-semibold" />
          <ClientStatusBadge status={client.status} className="text-xs font-semibold" />
        </div>
      </div>

      {client.status === "inactive" ? (
        <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Inaktív ügyfél — új projekthez érdemes visszaállítani aktívra.
        </p>
      ) : null}
    </header>
  )
}
