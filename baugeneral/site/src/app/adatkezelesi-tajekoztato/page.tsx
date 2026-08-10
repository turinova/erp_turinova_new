import Link from "next/link"
import {
  COMPANY,
  formatPhoneDisplay,
  formatTaxIdDisplay,
  isPublicPhone,
} from "@/lib/company"
import { ROUTES } from "@/lib/routes"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: ROUTES.adatkezeles.title,
  description: ROUTES.adatkezeles.description,
  canonical: ROUTES.adatkezeles.path,
})

const UPDATED = "2026. augusztus"
const RETENTION = "12 hónap"

export default function AdatkezelesiTajekoztatoPage() {
  const phone = isPublicPhone(COMPANY.phones.primary)
    ? formatPhoneDisplay(COMPANY.phones.primary)
    : null

  return (
    <article className="bg-stone-wash">
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-14">
        <p className="text-xs font-medium uppercase tracking-wide text-black/45">
          Jogi tájékoztató
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-black/90 md:text-4xl">
          Adatkezelési tájékoztató
        </h1>
        <p className="mt-3 text-sm text-black/55">
          Utolsó frissítés: {UPDATED}.
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-black/75">
          <section>
            <h2 className="text-lg font-semibold text-black/90">1. Adatkezelő</h2>
            <p className="mt-2">
              Az adatkezelő a {COMPANY.legalName} ({COMPANY.shortName}).
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>Székhely: {COMPANY.address.full}</li>
              <li>Adószám: {formatTaxIdDisplay(COMPANY.taxId)}</li>
              <li>Cégjegyzékszám: {COMPANY.companyRegistrationNumber}</li>
              <li>
                E-mail:{" "}
                <a
                  href={`mailto:${COMPANY.emails.central}`}
                  className="font-medium text-[var(--color-brand)] underline underline-offset-2"
                >
                  {COMPANY.emails.central}
                </a>
              </li>
              {phone ? (
                <li>
                  Telefon:{" "}
                  <a
                    href={`tel:${COMPANY.phones.primary}`}
                    className="font-medium text-[var(--color-brand)] underline underline-offset-2"
                  >
                    {phone}
                  </a>
                </li>
              ) : null}
              <li>
                Honlap:{" "}
                <a
                  href={COMPANY.website}
                  className="font-medium text-[var(--color-brand)] underline underline-offset-2"
                >
                  {COMPANY.website.replace(/^https?:\/\//, "")}
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">
              2. A tájékoztató hatálya
            </h2>
            <p className="mt-2">
              Ez a tájékoztató a {COMPANY.website.replace(/^https?:\/\//, "")}{" "}
              honlapon történő adatkezelésekre vonatkozik, különösen:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>kapcsolatfelvételi és szakági érdeklődő űrlapok,</li>
              <li>a honlapon megadott e-mail címre küldött megkeresések,</li>
              <li>telefonos megkeresések,</li>
              <li>a honlap üzemeltetéséhez szükséges technikai adatok.</li>
            </ul>
            <p className="mt-2">
              A cookie-król külön{" "}
              <Link
                href="/cookie-tajekoztato"
                className="font-medium text-[var(--color-brand)] underline underline-offset-2"
              >
                cookie tájékoztató
              </Link>{" "}
              rendelkezik. Ha Önnel később vállalkozási szerződést kötünk, a
              szerződéses adatkezelésre a szerződés és a vonatkozó jogszabályok
              az irányadók.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">
              3. Kapcsolatűrlap és szakági űrlap
            </h2>
            <dl className="mt-3 space-y-3">
              <div>
                <dt className="font-semibold text-black/85">Cél</dt>
                <dd className="mt-0.5">
                  Az Ön megkeresésének fogadása és megválaszolása, valamint (ha
                  kéri) a generálkivitelezési, szakági vagy asztalos szolgáltatás
                  iránti érdeklődés egyeztetése.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-black/85">Jogalap</dt>
                <dd className="mt-0.5">
                  Az Ön hozzájárulása (GDPR 6. cikk (1) bekezdés a) pont), illetve
                  a megkeresés megválaszolásához fűződő jogos érdek /
                  szerződéskötést megelőző lépések (GDPR 6. cikk (1) bekezdés b)
                  és f) pont), a megkeresés jellegétől függően. A hozzájárulást az
                  űrlapon a jelölőnégyzet bejelölésével adja meg. A hozzájárulás
                  bármikor visszavonható. A visszavonás nem érinti a visszavonás
                  előtti adatkezelés jogszerűségét.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-black/85">Kezelt adatok</dt>
                <dd className="mt-0.5">
                  Név, e-mail cím, telefonszám, opcionálisan cégnév és település /
                  megye, projekt típus vagy szakág, üzenet szövege. Technikai
                  metaadatok: küldés időbélyege, referrer, böngésző típus
                  (user-agent), valamint a visszaélések elleni védelmet szolgáló
                  IP-alapú korlátozás adatai, ha naplózásra kerülnek.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-black/85">Megőrzési idő</dt>
                <dd className="mt-0.5">
                  A megkeresés lezárásáig, de legfeljebb {RETENTION} a
                  beérkezéstől számítva, kivéve ha jogszabály hosszabb megőrzést
                  ír elő, vagy Önnel szerződéses kapcsolat jön létre.
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">
              4. E-mail és telefon
            </h2>
            <p className="mt-2">
              Ha e-mailt ír a{" "}
              <a
                href={`mailto:${COMPANY.emails.central}`}
                className="font-medium text-[var(--color-brand)] underline underline-offset-2"
              >
                {COMPANY.emails.central}
              </a>{" "}
              címre, vagy telefonon keres meg minket
              {phone ? (
                <>
                  {" "}
                  (
                  <a
                    href={`tel:${COMPANY.phones.primary}`}
                    className="font-medium text-[var(--color-brand)] underline underline-offset-2"
                  >
                    {phone}
                  </a>
                  )
                </>
              ) : null}
              , a megkeresés megválaszolásához szükséges adatokat kezeljük (név,
              elérhetőség, a beszélgetés / üzenet tartalma). Jogalap: a
              megkeresés megválaszolása (GDPR 6. cikk (1) bekezdés b) vagy f)
              pont). Megőrzés: a megkeresés lezárásáig, de legfeljebb{" "}
              {RETENTION}, ha nincs továbbmenő szerződéses kapcsolat.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">
              5. Honlapüzemeltetés (Vercel)
            </h2>
            <p className="mt-2">
              A honlap a <strong className="font-semibold text-black/85">Vercel Inc.</strong>{" "}
              (USA) felhőinfrastruktúráján fut (tárhely, szerver nélküli
              funkciók, tartalomszolgáltatás). A Vercel adatfeldolgozóként
              közreműködhet a Honlap kiszolgálásában és az űrlapküldések
              technikai fogadásában.
            </p>
            <p className="mt-2">
              A Vercel az EU / EGT területén kívül is működtethet infrastruktúrát.
              Ilyen esetben a GDPR szerinti megfelelő garanciák (pl. általános
              szerződési feltételek / Standard Contractual Clauses) alkalmazandók
              a szolgáltató feltételei szerint. Részletek:{" "}
              <a
                href="https://vercel.com/legal/privacy-policy"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[var(--color-brand)] underline underline-offset-2"
              >
                vercel.com/legal/privacy-policy
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">
              6. Címzettek, adatfeldolgozók
            </h2>
            <p className="mt-2">
              Az adatokat az adatkezelő azon munkatársai ismerhetik meg, akiknek
              a megkeresés megválaszolásához szükségük van rá. Külső
              adatfeldolgozók:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Vercel Inc. – honlapüzemeltetés, technikai fogadás
              </li>
              <li>
                e-mail szolgáltató / levelezőrendszer – ha a megkeresést e-mailben
                továbbítjuk vagy megválaszoljuk
              </li>
            </ul>
            <p className="mt-2">
              Az adatfeldolgozók az adatokat csak az utasításaink szerint, a
              szolgáltatás nyújtásához szükséges mértékben kezelhetik. Személyes
              adatait marketinglistára nem adjuk el.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">7. Adatbiztonság</h2>
            <p className="mt-2">
              Megfelelő technikai és szervezési intézkedésekkel védjük a
              személyes adatokat: HTTPS kapcsolat, hozzáférés-korlátozás,
              űrlapoknál visszaélés elleni korlátozás (pl. rate limit),
              naplózás ahol indokolt.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">
              8. Az érintett jogai
            </h2>
            <p className="mt-2">Ön jogosult:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>tájékoztatást kérni a személyes adatai kezeléséről,</li>
              <li>hozzáférést kérni az adatkezelőnél kezelt adataihoz,</li>
              <li>az adatok helyesbítését kérni,</li>
              <li>az adatok törlését kérni („elfeledtetéshez való jog”),</li>
              <li>az adatkezelés korlátozását kérni,</li>
              <li>
                az adathordozhatósághoz való jogot gyakorolni (ahol alkalmazható),
              </li>
              <li>a hozzájárulást bármikor visszavonni,</li>
              <li>
                tiltakozni az adatkezelés ellen (ahol a GDPR lehetővé teszi).
              </li>
            </ul>
            <p className="mt-2">
              Jogait a fenti e-mail címen gyakorolhatja. Kérésére indokolatlan
              késedelem nélkül, de legfeljebb egy hónapon belül válaszolunk.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">9. Jogorvoslat</h2>
            <p className="mt-2">
              Panasz esetén fordulhat a Nemzeti Adatvédelmi és Információszabadság
              Hatósághoz (NAIH):
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Cím: 1055 Budapest, Falk Miksa utca 9–11.</li>
              <li>
                Honlap:{" "}
                <a
                  href="https://www.naih.hu"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[var(--color-brand)] underline underline-offset-2"
                >
                  www.naih.hu
                </a>
              </li>
              <li>E-mail: ugyfelszolgalat@naih.hu</li>
            </ul>
            <p className="mt-2">
              Emellett bírósághoz is fordulhat a GDPR és a magyar jog szerint.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">10. Módosítás</h2>
            <p className="mt-2">
              Fenntartjuk a jogot, hogy a tájékoztatót a jogszabályi vagy a
              szolgáltatások változásához igazítsuk. A hatályos változat mindig
              ezen az oldalon érhető el.
            </p>
          </section>
        </div>

        <p className="mt-10 text-sm text-black/55">
          <Link
            href="/kapcsolat"
            className="font-medium text-[var(--color-brand)] underline underline-offset-2"
          >
            Vissza a Kapcsolat oldalra
          </Link>
        </p>
      </div>
    </article>
  )
}
