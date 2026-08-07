import Link from "next/link"
import {
  COMPANY,
  formatTaxIdDisplay,
} from "@/lib/company"
import { ROUTES } from "@/lib/routes"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: ROUTES.adatkezeles.title,
  description: ROUTES.adatkezeles.description,
  canonical: ROUTES.adatkezeles.path,
})

const RETENTION = "12 hónap"

export default function AdatkezelesiTajekoztatoPage() {
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
          Utolsó frissítés: 2026. július.
        </p>

        <div className="prose-legal mt-8 space-y-8 text-sm leading-relaxed text-black/75">
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
              honlapon elérhető kapcsolatfelvételi űrlapra és a honlapon megadott
              e-mail címekre küldött megkeresésekre vonatkozik. A cookie-k
              kezeléséről külön{" "}
              <Link
                href="/cookie-tajekoztato"
                className="font-medium text-[var(--color-brand)] underline underline-offset-2"
              >
                cookie tájékoztató
              </Link>{" "}
              rendelkezik.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">
              3. Kapcsolatfelvételi űrlap
            </h2>
            <dl className="mt-3 space-y-3">
              <div>
                <dt className="font-semibold text-black/85">Cél</dt>
                <dd className="mt-0.5">
                  Az Ön megkeresésének fogadása és megválaszolása, valamint (ha
                  kéri) a generálkivitelezési vagy kapcsolódó szolgáltatás iránti
                  érdeklődés egyeztetése.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-black/85">Jogalap</dt>
                <dd className="mt-0.5">
                  Az Ön hozzájárulása (GDPR 6. cikk (1) bekezdés a) pont). A
                  hozzájárulást az űrlapon a jelölőnégyzet bejelölésével adja
                  meg. A hozzájárulás bármikor visszavonható. A visszavonás nem
                  érinti a visszavonás előtti adatkezelés jogszerűségét.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-black/85">Kezelt adatok</dt>
                <dd className="mt-0.5">
                  Név, e-mail cím, telefonszám, opcionálisan cégnév és település
                  / megye, projekt típus, üzenet szövege, valamint a küldés
                  technikai metaadatai (pl. időbélyeg, ha naplózásra kerül).
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-black/85">Megőrzési idő</dt>
                <dd className="mt-0.5">
                  A megkeresés lezárásáig, de legfeljebb {RETENTION} a beérkezéstől
                  számítva, kivéve ha jogszabály hosszabb megőrzést ír elő, vagy
                  Önnel szerződéses kapcsolat jön létre (ebben az esetben a
                  szerződéses adatkezelés szabályai érvényesek).
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">
              4. Címzettek, adatfeldolgozók
            </h2>
            <p className="mt-2">
              Az adatokat az adatkezelő munkatársai ismerhetik meg, akiknek a
              megkeresés megválaszolásához szükségük van rá. A honlap
              üzemeltetéséhez és (ha bevezetésre kerül) az e-mail továbbításhoz
              külső szolgáltatókat (pl. tárhely, e-mail szolgáltató) vehetünk
              igénybe. Ezek a szolgáltatók adatfeldolgozóként, írásbeli szerződés
              alapján járnak el, és az adatokat csak az utasításaink szerint
              kezelhetik.
            </p>
            <p className="mt-2">
              Személyes adatait harmadik országba nem továbbítjuk, kivéve ha a
              használt szolgáltató EU-n kívüli infrastruktúrát is igénybe vesz. Ilyen
              esetben a GDPR szerinti megfelelő garanciákat alkalmazzuk.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">5. Adatbiztonság</h2>
            <p className="mt-2">
              Az adatkezelő megfelelő technikai és szervezési intézkedésekkel
              gondoskodik a személyes adatok védelméről (hozzáférés-korlátozás,
              biztonságos kapcsolatok, naplózás ahol indokolt).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">
              6. Az érintett jogai
            </h2>
            <p className="mt-2">Ön jogosult:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>tájékoztatást kérni a személyes adatai kezeléséről,</li>
              <li>hozzáférést kérni az adatkezelőnél kezelt adataihoz,</li>
              <li>az adatok helyesbítését kérni,</li>
              <li>az adatok törlését kérni („elfeledtetéshez való jog”),</li>
              <li>az adatkezelés korlátozását kérni,</li>
              <li>az adathordozhatósághoz való jogot gyakorolni (ahol alkalmazható),</li>
              <li>a hozzájárulást bármikor visszavonni,</li>
              <li>tiltakozni az adatkezelés ellen (ahol a GDPR lehetővé teszi).</li>
            </ul>
            <p className="mt-2">
              Jogait a fenti e-mail címen gyakorolhatja. Kérésére indokolatlan
              késedelem nélkül, de legfeljebb egy hónapon belül válaszolunk.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">7. Jogorvoslat</h2>
            <p className="mt-2">
              Panasz esetén fordulhat a Nemzeti Adatvédelmi és Információszabadság
              Hatósághoz (NAIH):
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Cím: 1055 Budapest, Falk Miksa utca 9–11.</li>
              <li>Honlap: https://www.naih.hu</li>
              <li>E-mail: ugyfelszolgalat@naih.hu</li>
            </ul>
            <p className="mt-2">
              Emellett bírósághoz is fordulhat a GDPR és a magyar jog szerint.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">8. Módosítás</h2>
            <p className="mt-2">
              Fenntartjuk a jogot, hogy a tájékoztatót a jogszabályi változásokhoz
              vagy a szolgáltatások változásához igazítsuk. A hatályos változat
              mindig ezen az oldalon érhető el.
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
