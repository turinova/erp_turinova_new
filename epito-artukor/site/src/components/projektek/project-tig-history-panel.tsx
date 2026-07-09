"use client"

import { useMemo, useState } from "react"
import { Eye, FileCheck2 } from "lucide-react"
import type { PerformanceCertificate } from "@/types/projects"
import { listPerformanceCertificatesForProject } from "@/lib/data/projects-store"
import { formatTigDate } from "@/lib/tig-preview-build"
import { formatHuf } from "@/lib/pricing"
import { TigPreviewDialog } from "@/components/projektek/tig-preview-dialog"
import { Button } from "@/components/ui/button"

type ProjectTigHistoryPanelProps = {
  projectId: string
  tick: number
}

export function ProjectTigHistoryPanel({ projectId, tick }: ProjectTigHistoryPanelProps) {
  const [viewCert, setViewCert] = useState<PerformanceCertificate | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const certificates = useMemo(() => {
    void tick
    return listPerformanceCertificatesForProject(projectId)
  }, [projectId, tick])

  const openPreview = (cert: PerformanceCertificate) => {
    setViewCert(cert)
    setPreviewOpen(true)
  }

  if (certificates.length === 0) {
    return (
      <section className="overflow-hidden rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
        <div className="px-5 py-6 text-center">
          <FileCheck2 className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-800">Még nincs rögzített TIG</p>
          <p className="mt-1 text-xs text-slate-600">
            A szakági kivitelezés nézetben készíthetsz teljesítésigazolást a kész tételekből.
          </p>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-100 px-5 py-3.5">
          <h3 className="text-base font-semibold text-slate-900">
            Teljesítésigazolások ({certificates.length})
          </h3>
          <p className="mt-0.5 text-sm text-slate-600">Rögzített TIG-ek — előnézet és nyomtatás</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                <th className="px-4 py-2.5 font-semibold">Sorszám</th>
                <th className="px-4 py-2.5 font-semibold">Kelte</th>
                <th className="px-4 py-2.5 font-semibold">Időszak</th>
                <th className="px-4 py-2.5 text-right font-semibold">Tételek</th>
                <th className="px-4 py-2.5 text-right font-semibold">Bruttó</th>
                <th className="px-4 py-2.5 text-right font-semibold" />
              </tr>
            </thead>
            <tbody>
              {certificates.map((cert) => (
                <tr key={cert.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-medium text-slate-900">{cert.documentNumber}</td>
                  <td className="px-4 py-2.5 text-slate-700">{formatTigDate(cert.issuedAt)}</td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {cert.periodFrom
                      ? `${formatTigDate(cert.periodFrom)} – ${formatTigDate(cert.periodTo)}`
                      : formatTigDate(cert.periodTo)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-800">
                    {cert.lines.length}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums text-slate-900">
                    {formatHuf(cert.grossTotal)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1 px-2 text-xs"
                      onClick={() => openPreview(cert)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Előnézet
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <TigPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        certificate={viewCert}
      />
    </>
  )
}
