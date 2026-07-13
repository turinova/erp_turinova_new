"use client"

import type { QuotePdfModel } from "@/lib/project-export/build-quote-pdf-model"
import { formatHuf, formatNumber } from "@/lib/pricing"
import type { TigParty } from "@/lib/tig-preview-build"
import { cn } from "@/lib/utils"

type QuoteExportDocumentProps = {
  model: QuotePdfModel
  className?: string
}

function formatHuDate(iso: string): string {
  return new Date(iso).toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function PartyCard({ title, party }: { title: string; party: TigParty }) {
  return (
    <div className="quote-pdf-party">
      <h2>{title}</h2>
      <p className="name">{party.name}</p>
      <p>{party.address}</p>
      <p>Adószám: {party.taxNumber}</p>
      {party.registrationNumber ? <p>Cégj.: {party.registrationNumber}</p> : null}
    </div>
  )
}

export function QuoteExportDocument({ model, className }: QuoteExportDocumentProps) {
  return (
    <article className={cn("quote-export-document", className)}>
      <section className="quote-pdf-summary-page">
        <header className="quote-pdf-header">
          <div className="quote-pdf-logo">
            {model.logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={model.logoDataUrl} alt="" />
            ) : null}
          </div>
          <div className="quote-pdf-title-block">
            <p className="quote-pdf-doc-label">Költségvetés</p>
            <h1 className="quote-pdf-doc-title">Árajánlat</h1>
            <p className="quote-pdf-meta">
              Kelte: <strong>{formatHuDate(model.issuedAt)}</strong>
              <br />
              Érvényes: <strong>{model.validityDays} napig</strong> (ig:{" "}
              {formatHuDate(model.validUntil)})
            </p>
          </div>
        </header>

        <div className="quote-pdf-parties">
          <PartyCard title="Megrendelő" party={model.client} />
          <PartyCard title="Vállalkozó" party={model.contractor} />
        </div>

        <dl className="quote-pdf-info-grid">
          <dt>Projekt</dt>
          <dd>
            {model.projectName} ({model.projectCode})
          </dd>
          <dt>Telephely</dt>
          <dd>{model.performanceLocation}</dd>
        </dl>

        <h2 className="quote-pdf-section-title">Főösszesítő</h2>
        <table className="quote-pdf-summary-table">
          <thead>
            <tr>
              <th>Ssz.</th>
              <th>Szakág</th>
              <th className="num">Nettó összesen</th>
              <th className="num">ÁFA</th>
              <th className="num">Bruttó összesen</th>
            </tr>
          </thead>
          <tbody>
            {model.summaryRows.map((row) => (
              <tr key={row.ssz}>
                <td className="num">{row.ssz}.</td>
                <td>{row.tradeLabel}</td>
                <td className="num">{formatHuf(row.netTotal)}</td>
                <td className="num">
                  {row.vatAmount > 0 ? formatHuf(row.vatAmount) : row.vatLabel}
                </td>
                <td className="num">{formatHuf(row.grossTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Összesen</td>
              <td className="num">{formatHuf(model.sellNetTotal)}</td>
              <td className="num">
                {model.showVatAmount ? formatHuf(model.vatAmount) : "—"}
              </td>
              <td className="num">{formatHuf(model.grossTotal)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="quote-pdf-totals-wrap">
          <div className="quote-pdf-totals-box">
            <h3>Összesítés</h3>
            <dl>
              <div className="row">
                <dt>Nettó összesen:</dt>
                <dd>{formatHuf(model.sellNetTotal)}</dd>
              </div>
              {model.showVatAmount ? (
                <div className="row">
                  <dt>ÁFA összesen:</dt>
                  <dd>{formatHuf(model.vatAmount)}</dd>
                </div>
              ) : null}
              <div className="row grand">
                <dt>Bruttó összesen:</dt>
                <dd>{formatHuf(model.grossTotal)}</dd>
              </div>
            </dl>
          </div>
        </div>

        {model.vatNote ? (
          <p className="quote-pdf-footer-note" style={{ marginTop: 12 }}>
            {model.vatNote}
          </p>
        ) : null}
      </section>

      <section className="quote-pdf-body">
        <h2 className="quote-pdf-section-title">Költségvetés tételesen</h2>
        {model.trades.map((trade, tradeIndex) => (
          <div key={`${trade.tradeLabel}-${tradeIndex}`}>
            <div className="quote-pdf-trade-band">{trade.tradeLabel}</div>
            <table className="quote-pdf-lines-table">
              <thead>
                <tr>
                  <th>Ssz.</th>
                  <th>Azonosító</th>
                  <th>Megnevezés</th>
                  <th className="num">Menny.</th>
                  <th>ME</th>
                  <th className="num">Egységár nettó</th>
                  <th className="num">Nettó összeg</th>
                </tr>
              </thead>
              <tbody>
                {trade.lines.map((line, lineIndex) => (
                  <tr key={`${line.ssz}-${lineIndex}`}>
                    <td className="num">{line.ssz}</td>
                    <td className="code">{line.identifier}</td>
                    <td className="text">{line.text}</td>
                    <td className="num">{formatNumber(line.quantity)}</td>
                    <td>{line.unitLabel}</td>
                    <td className="num">{formatHuf(line.sellNetUnitPrice)}</td>
                    <td className="num">{formatHuf(line.sellNetTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="quote-pdf-trade-footer">
              Szakág nettó összesen: {formatHuf(trade.sellNetTotal)}
            </div>
          </div>
        ))}
      </section>

      <section className="quote-pdf-closing-page quote-pdf-closing">
        {model.paymentTerms ? (
          <>
            <h2>Fizetési feltételek</h2>
            <p>{model.paymentTerms}</p>
          </>
        ) : null}

        {model.offerNotes ? (
          <>
            <h2>Megjegyzések</h2>
            <p>{model.offerNotes}</p>
          </>
        ) : null}

        <h2>Elfogadás</h2>
        <p>
          A megrendelő az árajánlatot az érvényességi határidőn belül írásban fogadja el. Az
          árajánlat elfogadásával a felek között szerződés jön létre a fenti tételek és
          feltételek szerint.
        </p>

        <div className="quote-pdf-signatures">
          <div>
            <p className="text-sm text-slate-600">Kelt: .................................</p>
            <div className="line">
              <strong>Megrendelő</strong>
              <br />
              {model.client.representative && model.client.representative !== "—"
                ? model.client.representative
                : "aláírás"}
            </div>
          </div>
          <div>
            <p className="text-sm text-slate-600">&nbsp;</p>
            <div className="line">
              <strong>Vállalkozó</strong>
              <br />
              {model.contractor.representative && model.contractor.representative !== "—"
                ? model.contractor.representative
                : "aláírás"}
            </div>
          </div>
        </div>

        <footer className="quote-pdf-footer-note">
          {model.contractorContactLine ? <p>{model.contractorContactLine}</p> : null}
          {model.contractorBankLine ? <p>{model.contractorBankLine}</p> : null}
          <p>
            Az árajánlat nettó és bruttó összegei forintban értendők. Érvényes:{" "}
            {formatHuDate(model.validUntil)}-ig.
          </p>
        </footer>
      </section>
    </article>
  )
}
