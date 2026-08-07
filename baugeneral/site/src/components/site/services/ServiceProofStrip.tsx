import Link from "next/link"
import type { ActiveProject } from "@/lib/projects"
import { activeProjectDetailPath } from "@/lib/projects"
import type { Reference } from "@/lib/references"
import { referenceDetailPath } from "@/lib/references"
import type { ServiceProof, ServiceSectionHeadings } from "@/lib/services"

type ServiceProofStripProps = {
  proof: ServiceProof
  headings: Pick<ServiceSectionHeadings, "proof">
}

function ProofCard({
  href,
  imageSrc,
  imageAlt,
  eyebrow,
  title,
  teaser,
  featured = false,
}: {
  href: string
  imageSrc: string
  imageAlt: string
  eyebrow: string
  title: string
  teaser: string
  featured?: boolean
}) {
  return (
    <Link
      href={href}
      className="group relative block h-full overflow-hidden rounded-[var(--radius-lg)] border border-black/10 bg-[#1c1a18] shadow-[var(--shadow-soft)]"
    >
      <div
        className={
          featured
            ? "aspect-[16/10] md:aspect-auto md:h-full md:min-h-[300px]"
            : "aspect-[16/10]"
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={imageAlt}
          className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent"
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 px-4 py-5 md:px-5">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-white/70">
          {eyebrow}
        </p>
        <h3 className="mt-1.5 font-display text-lg font-semibold leading-snug text-white md:text-xl">
          {title}
        </h3>
        <p className="mt-2 line-clamp-2 text-base leading-snug text-white/85">
          {teaser}
        </p>
        <span className="mt-2.5 inline-block text-base font-medium text-[#f5c4c8]">
          Részletek →
        </span>
      </div>
    </Link>
  )
}

function ReferenceProofCard({ reference }: { reference: Reference }) {
  return (
    <ProofCard
      href={referenceDetailPath(reference.slug)}
      imageSrc={reference.cardImage.src}
      imageAlt={reference.cardImage.alt}
      eyebrow="Befejezett munka"
      title={reference.title}
      teaser={reference.listTeaser}
      featured
    />
  )
}

function ProjectProofCard({ project }: { project: ActiveProject }) {
  return (
    <ProofCard
      href={activeProjectDetailPath(project.slug)}
      imageSrc={project.cardImage.src}
      imageAlt={project.cardImage.alt}
      eyebrow="Most épül"
      title={project.title}
      teaser={project.currentStatus}
    />
  )
}

export function ServiceProofStrip({ proof, headings }: ServiceProofStripProps) {
  return (
    <section aria-labelledby="service-proof-heading" className="mx-auto max-w-6xl px-4">
      <h2 id="service-proof-heading" className="service-h2">
        {headings.proof}
      </h2>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <ReferenceProofCard reference={proof.reference} />
        </div>
        {proof.project ? (
          <ProjectProofCard project={proof.project} />
        ) : (
          <div className="flex items-center rounded-[var(--radius-lg)] border border-black/10 bg-white px-5 py-6 shadow-[var(--shadow-soft)]">
            <p className="service-body">
              Jelenleg nincs publikált aktív projekt ebben a kategóriában. A{" "}
              <Link
                href="/futo-projektek"
                className="font-semibold text-[var(--color-brand)] hover:underline"
              >
                futó projektek
              </Link>{" "}
              oldalon láthatók az aktív munkák.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
