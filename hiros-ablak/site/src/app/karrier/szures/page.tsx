import type { Metadata } from "next"
import {
  COMPANY,
  formatPhoneDisplay,
} from "@/lib/company"
import {
  isScreeningOpen,
  screeningDeadlineLabel,
} from "@/lib/career-screening"
import ScreeningForm from "@/components/karrier/ScreeningForm"

const phoneTel = `tel:${COMPANY.phones.primary}`
const phoneDisplay = formatPhoneDisplay(COMPANY.phones.primary)

export const metadata: Metadata = {
  title: "Karrier – következő lépés",
  description:
    "Rövid kérdéssor a Hírös-Ablak bolti eladó jelentkezés következő lépéséhez.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/karrier/szures" },
}

export default function KarrierSzuresPage() {
  const open = isScreeningOpen()
  const deadlineLabel = screeningDeadlineLabel()

  return (
    <div className="bg-stone-wash min-h-[70vh]">
      <div className="mx-auto max-w-xl px-4 py-7 sm:px-6 sm:py-10 lg:py-12">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--color-brand)]">
          Karrier
        </p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-black/90 sm:text-3xl">
          Következő lépés — rövid kérdések
        </h1>
        <p className="mt-2 text-sm text-black/65 sm:text-base">
          A személyes beszélgetés előtt pár kérdés, hogy biztosan illik-e az
          állás. Kb. 8–10 perc.
        </p>

        <div className="mt-4 rounded-xl border border-[var(--color-brand)]/20 bg-white px-3.5 py-3 text-sm text-black/80">
          <p className="font-medium text-black/90">
            {COMPANY.address.full}
          </p>
          <p className="mt-1 leading-snug">
            Hétfő–péntek 7:30-tól 17:00-ig
          </p>
          <p className="mt-0.5 leading-snug text-black/60">
            Időnként szombat 8:00-tól 12:00-ig
          </p>
        </div>

        <div
          className={`mt-3 rounded-xl border px-3.5 py-2.5 text-sm ${
            open
              ? "border-amber-200 bg-amber-50 text-amber-950"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {open ? (
            <>
              <span className="font-semibold">Határidő:</span> {deadlineLabel}
            </>
          ) : (
            <>A kérdőív határideje lejárt ({deadlineLabel}).</>
          )}
        </div>

        <section className="mt-5 rounded-2xl border border-black/10 bg-white p-4 shadow-sm sm:p-5">
          {open ? (
            <>
              <h2 className="text-base font-bold text-black/90 sm:text-lg">
                Kérdőív
              </h2>
              <p className="mt-1 text-sm text-black/60">
                Három rövid lépés. Önéletrajz nem kell — azt már megkaptuk.
              </p>
              <div className="mt-4">
                <ScreeningForm
                  phoneDisplay={phoneDisplay}
                  phoneTel={phoneTel}
                />
              </div>
            </>
          ) : (
            <div>
              <h2 className="text-base font-bold text-black/90 sm:text-lg">
                A határidő lejárt
              </h2>
              <p className="mt-2 text-sm text-black/65">
                Ha mégis szeretnél jelentkezni, írj vagy hívj minket.
              </p>
              <a
                href={phoneTel}
                className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-white"
              >
                Telefon: {phoneDisplay}
              </a>
            </div>
          )}
        </section>

        <p className="mt-4 text-center text-sm text-black/55">
          Telefon:{" "}
          <a
            href={phoneTel}
            className="font-semibold text-[var(--color-brand)] underline underline-offset-4"
          >
            {phoneDisplay}
          </a>
        </p>
      </div>
    </div>
  )
}
