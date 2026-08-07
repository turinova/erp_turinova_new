import Link from "next/link"
import { ABOUT_PROFILE } from "@/lib/about-data"

export function AboutProfile() {
  return (
    <article className="mx-auto max-w-3xl px-4 pb-12 pt-2 md:pb-16 md:pt-4">
      <div className="header-brand-strip mb-6" aria-hidden />
      <h1 id="rolunk-heading" className="about-h1 text-pretty">
        {ABOUT_PROFILE.title}
      </h1>

      <div className="mt-6 space-y-4">
        {ABOUT_PROFILE.paragraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 24)} className="about-body text-pretty">
            {paragraph}
          </p>
        ))}
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {ABOUT_PROFILE.stats.map((stat) => (
          <div key={stat.label}>
            <dt className="about-stat-value text-[2rem] md:text-[2.5rem]">{stat.value}</dt>
            <dd className="about-stat-label mt-1">{stat.label}</dd>
          </div>
        ))}
      </dl>

      <nav aria-label="További információk" className="mt-10 border-t border-black/8 pt-8">
        <ul className="grid gap-3 sm:grid-cols-3">
          {ABOUT_PROFILE.links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="group block rounded-[var(--radius-md)] border border-black/10 bg-white px-4 py-3.5 shadow-[var(--shadow-soft)] transition-colors hover:border-[var(--color-brand)]/25"
              >
                <span className="text-sm font-semibold text-black/88 group-hover:text-[var(--color-brand)]">
                  {link.label} →
                </span>
                <span className="mt-1 block text-sm leading-snug text-black/55">
                  {link.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </article>
  )
}
