import { ContactForm } from "@/components/site/ContactForm"
import { CopyToClipboardButton } from "@/components/site/CopyToClipboardButton"
import {
  COMPANY,
  formatPhoneDisplay,
  googleMapsDirectionsUrl,
  googleMapsEmbedUrl,
  googleMapsSearchUrl,
  isPublicPhone,
} from "@/lib/company"

export function ContactMainPanel() {
  const mapEmbed = googleMapsEmbedUrl()
  const mapDirections = googleMapsDirectionsUrl()
  const mapSearch = googleMapsSearchUrl()

  return (
    <section
      id="uzenet"
      aria-labelledby="megkereses-heading"
      className="scroll-mt-20 mx-auto max-w-6xl px-4 py-8 md:py-10"
    >
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-black/10 bg-white shadow-[var(--shadow-card)]">
        <div className="grid md:grid-cols-12 md:items-start">
          <aside className="order-2 border-t border-black/8 p-5 md:order-1 md:col-span-5 md:border-r md:border-t-0 md:p-6 lg:p-7">
            <h2 className="text-xs font-medium uppercase tracking-wide text-black/50">
              Elérhetőség
            </h2>
            <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-semibold text-black/88">{COMPANY.address.full}</p>
              <CopyToClipboardButton
                text={COMPANY.address.full}
                className="shrink-0 rounded-full border border-black/12 bg-white px-2.5 py-1 text-xs font-medium text-black/75 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
              />
            </div>
            <a
              href={`mailto:${COMPANY.emails.central}`}
              className="mt-2 block text-sm font-semibold text-[var(--color-brand)] underline underline-offset-4"
            >
              {COMPANY.emails.central}
            </a>
            {isPublicPhone(COMPANY.phones.primary) ? (
              <a
                href={`tel:${COMPANY.phones.primary}`}
                className="mt-1.5 block text-sm font-semibold text-[var(--color-brand)] underline underline-offset-4"
              >
                {formatPhoneDisplay(COMPANY.phones.primary)}
              </a>
            ) : null}

            <div className="mt-4 overflow-hidden rounded-[var(--radius-md)] border border-black/8">
              <iframe
                title="BauGenerál Kft., Google Maps"
                src={mapEmbed}
                className="block h-[220px] w-full md:h-[280px]"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={mapDirections}
                target="_blank"
                rel="noreferrer"
                className="btn-primary inline-flex px-3.5 py-2 text-xs font-semibold"
              >
                Útvonaltervezés
              </a>
              <a
                href={mapSearch}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary inline-flex px-3.5 py-2 text-xs font-semibold"
              >
                Google Térkép
              </a>
            </div>
          </aside>

          <div className="order-1 p-5 md:order-2 md:col-span-7 md:p-6 lg:p-7">
            <header>
              <h2
                id="megkereses-heading"
                className="text-xl font-semibold tracking-tight text-black/90 md:text-2xl"
              >
                Üzenet küldése
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-black/60">
                Írja meg, mire van szüksége. Mi e-mailben válaszolunk.
              </p>
            </header>
            <div className="mt-5">
              <ContactForm />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
