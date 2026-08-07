import Link from "next/link"
import { COMPANY } from "@/lib/company"
import { HEADER_CTA } from "@/lib/nav-data"
import { ROUTES, type RouteKey } from "@/lib/routes"
import { Breadcrumbs } from "@/components/site/Breadcrumbs"

type StubPageShellProps = {
  routeKey: RouteKey
}

export function StubPageShell({ routeKey }: StubPageShellProps) {
  const route = ROUTES[routeKey]
  const locale = route.locale ?? "hu"
  const isEn = locale === "en"
  const isDe = locale === "de"

  return (
    <div className="bg-stone-wash min-h-[50vh]">
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-14">
        <Breadcrumbs items={route.breadcrumbs} />

        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand)]">
          {isEn ? "Work in progress" : isDe ? "In Arbeit" : "Fejlesztés alatt"}
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-black/90 md:text-4xl">
          {route.label}
        </h1>

        <p className="mt-4 text-pretty text-base leading-relaxed text-black/70 md:text-lg">
          {route.description}
        </p>

        {route.heroImage ? (
          <figure className="mt-6 overflow-hidden rounded-[var(--radius-lg)] border border-black/10 bg-white shadow-[var(--shadow-soft)]">
            <div className="aspect-video w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={route.heroImage}
                alt={route.heroImageAlt ?? route.label}
                className="h-full w-full object-cover object-center"
              />
            </div>
          </figure>
        ) : null}

        <div className="mt-8 card-soft p-6">
          <p className="text-sm font-medium text-black/80">
            {isEn
              ? "This page is part of the new baugeneral.hu site shell. Full content (copy, photos, FAQ, schema) will be added in the next build steps."
              : isDe
                ? "Diese Seite ist Teil des neuen baugeneral.hu Website-Gerüsts. Vollständige Inhalte (Texte, Fotos, FAQ, strukturierte Daten) folgen in den nächsten Ausbauschritten."
                : "Ez az oldal az új baugeneral.hu web vázának része. A teljes tartalom (szöveg, fotók, FAQ, strukturált adatok) a következő építési lépésekben készül el."}
          </p>
          <p className="mt-3 text-sm text-black/60">
            {isEn || isDe ? COMPANY.entityDefinitionEn : COMPANY.entityDefinitionHu}
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={isEn ? "/en/contact" : isDe ? "/de/contact" : "/kapcsolat"}
            className="btn-primary inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold"
          >
            {isEn ? HEADER_CTA.labelEn : isDe ? HEADER_CTA.labelDe : HEADER_CTA.label}
          </Link>
        </div>
      </div>
    </div>
  )
}
