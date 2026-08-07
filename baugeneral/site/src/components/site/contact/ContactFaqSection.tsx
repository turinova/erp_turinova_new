import Link from "next/link"
import { COMPANY } from "@/lib/company"
import { CONTACT_FAQ } from "@/lib/team-data"

const TELEPHELY_IMAGE = "/img/kapcsolat/telephely.png"

function faqAnswerWithLinks(item: (typeof CONTACT_FAQ)[number]) {
  if (item.id === "munkakor") {
    return (
      <>
        Ipari épület, társasház, családi ház, középület, felújítás. Az első
        beszélgetésen tisztázzuk a részleteket. Részletek a{" "}
        <Link
          href="/szolgaltatasok/ipari-epuletek"
          className="font-medium text-[var(--color-brand)] underline-offset-2 hover:underline"
        >
          szolgáltatások
        </Link>{" "}
        oldalakon.
      </>
    )
  }
  if (item.id === "terulet") {
    return (
      <>
        Bács-Kiskun és Pest megyében, valamint a Balaton környékén. Székhely:
        Kecskemét. Pest megyei fókusz:{" "}
        <Link
          href="/generalkivitelezes-pest-megye"
          className="font-medium text-[var(--color-brand)] underline-offset-2 hover:underline"
        >
          generálkivitelezés Pest megyében
        </Link>
        .
      </>
    )
  }
  return item.a
}

export function ContactFaqSection() {
  return (
    <section
      aria-labelledby="faq-heading"
      className="border-t border-[var(--color-border)]/80 bg-[var(--color-surface-soft)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        <div className="grid gap-6 md:grid-cols-5 md:items-start md:gap-8">
          <div className="md:col-span-2">
            <h2 id="faq-heading" className="text-xl font-semibold text-black/90 md:text-2xl">
              Gyakori kérdések
            </h2>
            <p className="mt-2 text-sm text-black/60">
              Az első megkeresés előtt ezek szoktak felmerülni.
            </p>
            <div className="mt-4 divide-y divide-black/8 border-y border-black/8">
              {CONTACT_FAQ.map((item) => (
                <details key={item.id} className="group py-3">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-black/88 marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center justify-between gap-3">
                      {item.q}
                      <span
                        aria-hidden
                        className="shrink-0 text-black/40 transition group-open:rotate-45"
                      >
                        +
                      </span>
                    </span>
                  </summary>
                  <p className="mt-2 pr-2 text-sm leading-relaxed text-black/60">
                    {faqAnswerWithLinks(item)}
                  </p>
                </details>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-black/10 bg-white shadow-[var(--shadow-soft)] md:col-span-3">
            <div className="aspect-video w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={TELEPHELY_IMAGE}
                alt={`BauGenerál Kft. telephely, ${COMPANY.address.full}`}
                className="h-full w-full object-cover object-center"
              />
            </div>
            <p className="border-t border-black/8 px-4 py-3 text-xs text-black/55">
              {COMPANY.address.full}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
