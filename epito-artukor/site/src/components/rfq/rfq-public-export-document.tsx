"use client"

import type {
  RfqPublicExportLine,
  RfqPublicExportModel,
  RfqPublicExportPackage,
} from "@/lib/rfq-public-export/build-export-model"
import {
  formatRfqPdfDate,
  formatRfqPdfMoney,
} from "@/lib/rfq-public-export/pdf-print"

type RfqPublicExportDocumentProps = {
  model: RfqPublicExportModel
}

function resolvePackages(model: RfqPublicExportModel): RfqPublicExportPackage[] {
  if (model.packages.length > 0) return model.packages
  return [
    {
      packageId: "primary",
      tradeLabel: model.packageTitle || "Szakág",
      packageTitle: model.packageTitle,
      expiresAt: model.expiresAt,
      hasSubmission: model.mode === "offer",
      totalAmount: model.totalAmount,
      lines: model.lines,
    },
  ]
}

function LineRows({
  lines,
  mode,
}: {
  lines: RfqPublicExportLine[]
  mode: RfqPublicExportModel["mode"]
}) {
  return (
    <>
      {lines.map((line) =>
        line.declined ? (
          <tr key={line.ssz}>
            <td>{line.ssz}</td>
            <td>{line.text}</td>
            <td className="num">{line.quantity}</td>
            <td>{line.unit}</td>
            <td colSpan={5} className="rfq-pdf-declined">
              nem vállalom
            </td>
          </tr>
        ) : (
          <tr key={line.ssz}>
            <td>{line.ssz}</td>
            <td>{line.text}</td>
            <td className="num">{line.quantity}</td>
            <td>{line.unit}</td>
            <td className="num">
              {mode === "template" ? "" : formatRfqPdfMoney(line.materialUnit)}
            </td>
            <td className="num">
              {mode === "template" ? "" : formatRfqPdfMoney(line.laborUnit)}
            </td>
            <td className="num">
              {mode === "template" ? "" : formatRfqPdfMoney(line.materialTotal)}
            </td>
            <td className="num">
              {mode === "template" ? "" : formatRfqPdfMoney(line.laborTotal)}
            </td>
            <td className="num">
              {mode === "template" ? "" : formatRfqPdfMoney(line.lineTotal)}
            </td>
          </tr>
        )
      )}
    </>
  )
}

function TradeTable({
  pkg,
  mode,
}: {
  pkg: RfqPublicExportPackage
  mode: RfqPublicExportModel["mode"]
}) {
  return (
    <section className="rfq-pdf-trade">
      <h2 className="rfq-pdf-trade-title">{pkg.tradeLabel}</h2>
      {pkg.packageTitle && pkg.packageTitle !== pkg.tradeLabel ? (
        <p className="rfq-pdf-trade-sub">{pkg.packageTitle}</p>
      ) : null}
      <p className="rfq-pdf-trade-meta">
        Határidő: {formatRfqPdfDate(pkg.expiresAt)}
        {mode === "offer" ? (
          <>
            {" · "}
            {pkg.hasSubmission ? "Beküldve" : "Még nincs ajánlat"}
          </>
        ) : null}
      </p>

      <table className="rfq-pdf-table">
        <thead>
          <tr>
            <th>Ssz.</th>
            <th>Tétel szövege</th>
            <th className="num">Menny.</th>
            <th>Egység</th>
            <th className="num">Anyag egységár</th>
            <th className="num">Díj egységre</th>
            <th className="num">Anyag összesen</th>
            <th className="num">Díj összesen</th>
            <th className="num">Sor összesen</th>
          </tr>
        </thead>
        <tbody>
          <LineRows lines={pkg.lines} mode={mode} />
        </tbody>
      </table>

      <div className="rfq-pdf-footer">
        <span>{pkg.tradeLabel} összesen</span>
        <span>
          {mode === "offer" && pkg.hasSubmission
            ? formatRfqPdfMoney(pkg.totalAmount)
            : "—"}
        </span>
      </div>
    </section>
  )
}

export function RfqPublicExportDocument({ model }: RfqPublicExportDocumentProps) {
  const packages = resolvePackages(model)
  const multi = packages.length > 1

  return (
    <div className="rfq-pdf-doc" aria-hidden>
      <header className="rfq-pdf-header">
        <div className="rfq-pdf-label">
          {model.mode === "offer" ? "Alvállalkozói ajánlat" : "Árajánlatkérés"}
          {multi ? ` · ${packages.length} szakág` : ""}
        </div>
        <h1 className="rfq-pdf-title">
          {multi ? model.partnerName || model.packageTitle : model.packageTitle}
        </h1>
        <div className="rfq-pdf-meta">
          <div>
            <strong>Partner:</strong> {model.partnerName || "—"}
          </div>
          <div>
            <strong>Projekt:</strong> {model.projectName || "—"}
          </div>
          <div>
            <strong>Cím:</strong>{" "}
            {[model.siteAddress, model.projectCode].filter(Boolean).join(" · ") || "—"}
          </div>
          {!multi ? (
            <div>
              <strong>Határidő:</strong> {formatRfqPdfDate(model.expiresAt)}
            </div>
          ) : (
            <div>
              <strong>Szakágak:</strong>{" "}
              {packages.map((p) => p.tradeLabel).join(", ")}
            </div>
          )}
          {model.contactPhone ? (
            <div>
              <strong>Telefon:</strong> {model.contactPhone}
            </div>
          ) : null}
          {model.contactEmail ? (
            <div>
              <strong>E-mail:</strong> {model.contactEmail}
            </div>
          ) : null}
          {model.submittedAt && !multi ? (
            <div>
              <strong>Beküldve:</strong> {formatRfqPdfDate(model.submittedAt)}
            </div>
          ) : null}
        </div>
      </header>

      {multi ? (
        <section className="rfq-pdf-summary">
          <h2 className="rfq-pdf-trade-title">Főösszesítő</h2>
          <table className="rfq-pdf-table rfq-pdf-summary-table">
            <thead>
              <tr>
                <th>Ssz.</th>
                <th>Szakág</th>
                <th className="num">Státusz</th>
                <th className="num">Nettó összesen</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg, index) => (
                <tr key={pkg.packageId}>
                  <td>{index + 1}</td>
                  <td>{pkg.tradeLabel}</td>
                  <td className="num">
                    {model.mode === "template"
                      ? "sablon"
                      : pkg.hasSubmission
                        ? "beküldve"
                        : "hiányzik"}
                  </td>
                  <td className="num">
                    {model.mode === "offer" && pkg.hasSubmission
                      ? formatRfqPdfMoney(pkg.totalAmount)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="rfq-pdf-footer">
            <span>
              {model.mode === "offer" ? "Összesen (minden szakág)" : "Kitöltendő sablon"}
            </span>
            <span>
              {model.mode === "offer" ? formatRfqPdfMoney(model.totalAmount) : "—"}
            </span>
          </div>
        </section>
      ) : null}

      {packages.map((pkg) => (
        <TradeTable key={pkg.packageId} pkg={pkg} mode={model.mode} />
      ))}

      {model.notes ? (
        <div className="rfq-pdf-notes">
          <strong>Megjegyzés:</strong>
          {"\n"}
          {model.notes}
        </div>
      ) : null}

      <p className="rfq-pdf-stamp">Exportálva: {formatRfqPdfDate(model.exportedAt)}</p>
    </div>
  )
}
