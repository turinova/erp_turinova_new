"use client"

import type { TigPreviewModel } from "@/lib/tig-preview-build"
import { formatTigDate, tigTradeSummary } from "@/lib/tig-preview-build"
import { formatHuf, formatNumber } from "@/lib/pricing"
import { cn } from "@/lib/utils"

type TigPreviewDocumentProps = {
  model: TigPreviewModel
  className?: string
  /** Nyomtatási előnézethez */
  printMode?: boolean
}

export function TigPreviewDocument({ model, className, printMode }: TigPreviewDocumentProps) {
  const periodLabel = model.periodFrom
    ? `${formatTigDate(model.periodFrom)} – ${formatTigDate(model.periodTo)}`
    : formatTigDate(model.periodTo)

  return (
    <article
      className={cn(
        "tig-preview-document bg-white text-slate-900",
        printMode ? "p-0" : "rounded-lg border border-slate-200 p-6 shadow-sm sm:p-8",
        className
      )}
    >
      <header className="border-b border-slate-300 pb-4">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          {model.logoDataUrl ? (
            <div className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={model.logoDataUrl}
                alt=""
                className="max-h-14 max-w-[10rem] object-contain"
              />
            </div>
          ) : (
            <div className="hidden sm:block sm:w-[10rem]" />
          )}
          <div className="text-center sm:flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Teljesítésigazolás
            </p>
            <h1 className="mt-1 text-xl font-bold uppercase tracking-wide text-slate-900 sm:text-2xl">
              TIG
            </h1>
            <p className="mt-2 text-sm text-slate-700">
              Sorszám: <span className="font-semibold">{model.documentNumber}</span>
              <span className="mx-2 text-slate-300">|</span>
              Kelte: <span className="font-semibold">{formatTigDate(model.issuedAt)}</span>
            </p>
          </div>
          <div className="hidden w-[10rem] shrink-0 sm:block" />
        </div>
      </header>

      <section className="mt-5 grid gap-4 sm:grid-cols-2">
        <PartyBlock title="Megrendelő" party={model.client} />
        <PartyBlock title="Vállalkozó" party={model.contractor} />
      </section>

      <section className="mt-5 space-y-2 text-sm leading-relaxed text-slate-800">
        <InfoRow label="Projekt" value={`${model.projectName} (${model.projectCode})`} />
        <InfoRow label="Teljesítés helye" value={model.performanceLocation} />
        <InfoRow label="Szerződés / árajánlat" value={model.contractReference} />
        <InfoRow label="Szakág" value={tigTradeSummary(model.lines)} />
        <InfoRow label="Teljesítés időszaka" value={periodLabel} />
        {model.notes ? <InfoRow label="Megjegyzés" value={model.notes} /> : null}
      </section>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead>
            <tr className="border-y border-slate-400 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <th className="px-2 py-2 font-semibold">Ssz.</th>
              <th className="px-2 py-2 font-semibold">Azonosító</th>
              <th className="min-w-[12rem] px-2 py-2 font-semibold">Megnevezés</th>
              <th className="px-2 py-2 text-right font-semibold">Menny.</th>
              <th className="px-2 py-2 font-semibold">ME</th>
              <th className="px-2 py-2 text-right font-semibold">Egységár (nettó)</th>
              <th className="px-2 py-2 text-right font-semibold">Nettó összeg</th>
            </tr>
          </thead>
          <tbody>
            {model.lines.map((line, index) => (
              <tr key={line.lineId} className="border-b border-slate-200 align-top">
                <td className="px-2 py-2 tabular-nums text-slate-600">{index + 1}.</td>
                <td className="px-2 py-2 font-code text-xs text-blue-800">{line.identifier}</td>
                <td className="px-2 py-2 leading-snug">{line.text}</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatNumber(line.quantity)}</td>
                <td className="px-2 py-2">{line.unitLabel}</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatHuf(line.sellNetUnitPrice)}</td>
                <td className="px-2 py-2 text-right font-medium tabular-nums">
                  {formatHuf(line.sellNetTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end">
        <dl className="w-full max-w-sm space-y-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-600">Nettó összesen:</dt>
            <dd className="font-semibold tabular-nums">{formatHuf(model.sellNetTotal)}</dd>
          </div>
          {model.showVatAmount ? (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600">{model.vatLabel}:</dt>
              <dd className="font-semibold tabular-nums">{formatHuf(model.vatAmount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-t border-slate-300 pt-2 text-base">
            <dt className="font-semibold text-slate-900">Bruttó összesen:</dt>
            <dd className="font-bold tabular-nums text-slate-900">{formatHuf(model.grossTotal)}</dd>
          </div>
          {model.vatNote ? (
            <p className="pt-1 text-xs leading-relaxed text-slate-600">{model.vatNote}</p>
          ) : null}
        </dl>
      </div>

      <section className="mt-8 space-y-6 text-sm leading-relaxed text-slate-800">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-600">
            Vállalkozó nyilatkozata
          </h2>
          <p className="mt-2">
            Alulírott vállalkozó kijelentem, hogy a fenti teljesítésigazolásban megjelölt
            építési munkákat, árukat és szolgáltatásokat a szerződésben foglaltaknak, valamint
            az érvényes műszaki előírásoknak és jogszabályoknak megfelelő minőségben, a megjelölt
            időszakban teljesítettem.
          </p>
          <SignatureBlock role="Vállalkozó" name={model.contractor.representative} />
        </div>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-600">
            Megrendelő elfogadása
          </h2>
          <p className="mt-2">
            A megrendelő a fenti teljesítést a Polgári Törvénykönyvről szóló 2013. évi V. törvény
            (Ptk.) 6:159. § szerinti teljesítésigazolásként fogadja el, kivéve, ha a teljesítést
            kifogásolja. Kifogás esetén a teljesítésigazolást a kézhezvételtől számított 8 napon
            belül írásban kell közölni.
          </p>
          <SignatureBlock role="Megrendelő" name={model.client.representative} />
        </div>
      </section>

      <footer className="mt-8 border-t border-slate-200 pt-4 text-[11px] leading-relaxed text-slate-500">
        {model.contractorContactLine ? (
          <p className="mb-1 text-slate-600">{model.contractorContactLine}</p>
        ) : null}
        {model.contractorBankLine ? (
          <p className="mb-2 font-medium text-slate-700">{model.contractorBankLine}</p>
        ) : null}
        A dokumentum a Ptk. 6:155–6:163. §-ai, valamint az építési szerződésre vonatkozó
        rendelkezések szerinti teljesítésigazolásként készült. Ez az előnézet nem minősül
        hitelesített dokumentumnak; a joghatás az aláírt példánytól keletkezik.
        <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/turinova-logo.png"
            alt="Turinova"
            className="h-4 w-auto object-contain opacity-80"
          />
          <span className="text-[10px] uppercase tracking-wide text-slate-400">
            Turinova · Építő Ártükör
          </span>
        </div>
      </footer>
    </article>
  )
}

function PartyBlock({
  title,
  party,
}: {
  title: string
  party: TigPreviewModel["client"]
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3">
      <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h2>
      <p className="mt-1 font-semibold text-slate-900">{party.name}</p>
      <p className="mt-1 text-sm text-slate-700">{party.address}</p>
      <p className="mt-1 text-xs text-slate-600">Adószám: {party.taxNumber}</p>
      {party.registrationNumber ? (
        <p className="text-xs text-slate-600">Cégjegyzékszám: {party.registrationNumber}</p>
      ) : null}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[9rem_1fr]">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span>{value}</span>
    </div>
  )
}

function SignatureBlock({ role, name }: { role: string; name?: string }) {
  return (
    <div className="mt-4 grid gap-6 sm:grid-cols-2">
      <div>
        <p className="text-xs text-slate-500">Kelt: .................................</p>
        <div className="mt-8 border-t border-slate-400 pt-1">
          <p className="text-xs text-slate-600">{role}</p>
          {name && name !== "—" ? (
            <p className="text-sm font-medium text-slate-800">{name}</p>
          ) : (
            <p className="text-sm text-slate-400">aláírás</p>
          )}
        </div>
      </div>
      <div className="hidden sm:block" />
    </div>
  )
}
