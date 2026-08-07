import { CONTACT_TEAM } from "@/lib/team-data"

export function ContactTeamCards() {
  return (
    <section
      aria-labelledby="csapat-heading"
      className="border-t border-[var(--color-border)]/80 bg-[var(--color-surface)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        <h2
          id="csapat-heading"
          className="text-xl font-semibold tracking-tight text-black/90 md:text-2xl"
        >
          Csapatunk
        </h2>

        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CONTACT_TEAM.map((member) => (
            <li
              key={member.id}
              className="overflow-hidden rounded-[var(--radius-lg)] border border-black/10 bg-white shadow-[var(--shadow-soft)]"
            >
              <div className="aspect-[3/4] overflow-hidden bg-stone-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={member.imageSrc}
                  alt={member.imageAlt}
                  className="h-full w-full object-cover object-top"
                  loading="lazy"
                />
              </div>
              <div className="p-3.5">
                <h3 className="text-sm font-semibold text-black/88">{member.name}</h3>
                <p className="mt-0.5 text-xs font-medium text-[var(--color-brand)]">
                  {member.roleShort}
                </p>
                {member.email ? (
                  <a
                    href={`mailto:${member.email}`}
                    className="mt-2.5 block break-all text-xs font-medium text-[var(--color-brand)] underline underline-offset-2"
                  >
                    {member.email}
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
