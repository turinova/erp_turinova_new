import Link from "next/link"
import { RevealOnLoad } from "./RevealOnLoad"

export type LegalSection = {
  id: string
  title: string
  paragraphs?: readonly string[]
  list?: readonly string[]
}

export function LegalDocument({
  title,
  description,
  lastUpdated,
  sections,
  children,
}: {
  title: string
  description: string
  lastUpdated: string
  sections: readonly LegalSection[]
  children?: React.ReactNode
}) {
  return (
    <div className="relative bg-stone-wash">
      <div className="relative bg-grain">
        <RevealOnLoad>
          <article className="mx-auto max-w-3xl px-4 py-12 md:py-16 lg:py-20">
            <header>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand)]">
                Jogi tájékoztató
              </p>
              <h1 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                {title}
              </h1>
              <div
                aria-hidden
                className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)]"
              />
              <p className="mt-4 text-base text-black/70 leading-relaxed">
                {description}
              </p>
              <p className="mt-2 text-sm text-black/50">
                Utolsó frissítés: {lastUpdated}
              </p>
            </header>

            {children}

            <div className="mt-10 space-y-10">
              {sections.map((section) => (
                <section key={section.id} id={section.id}>
                  <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                    {section.title}
                  </h2>
                  {section.paragraphs?.map((p, i) => (
                    <p
                      key={`${section.id}-p-${i}`}
                      className="mt-3 text-sm md:text-base text-black/75 leading-relaxed"
                    >
                      {p}
                    </p>
                  ))}
                  {section.list && section.list.length > 0 && (
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm md:text-base text-black/75 leading-relaxed">
                      {section.list.map((item, i) => (
                        <li key={`${section.id}-li-${i}`}>{item}</li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>

            <p className="mt-12 text-sm text-black/55">
              <Link
                href="/kapcsolat"
                className="font-semibold text-[var(--color-brand)] underline underline-offset-4"
              >
                Kapcsolat
              </Link>
              {" · "}
              <Link
                href="/"
                className="font-semibold text-[var(--color-brand)] underline underline-offset-4"
              >
                Főoldal
              </Link>
            </p>
          </article>
        </RevealOnLoad>
      </div>
    </div>
  )
}
