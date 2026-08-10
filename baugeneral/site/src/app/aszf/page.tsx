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
  title: ROUTES.aszf.title,
  description: ROUTES.aszf.description,
  canonical: ROUTES.aszf.path,
})

const UPDATED = "2026. augusztus"

export default function AszfPage() {
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
          Általános szerződési feltételek
        </h1>
        <p className="mt-3 text-sm text-black/55">
          Utolsó frissítés: {UPDATED}.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-black/70">
          Ez az ÁSZF a {COMPANY.website.replace(/^https?:\/\//, "")} honlap
          használatára és a honlapon keresztül történő megkeresésekre vonatkozik.
          Az egyedi kivitelezési szerződéseket nem helyettesíti: ha építési
          munkára szerződünk, a konkrét szerződés az irányadó.
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-black/75">
          <section>
            <h2 className="text-lg font-semibold text-black/90">1. Szolgáltató</h2>
            <p className="mt-2">
              A honlapot a {COMPANY.legalName} ({COMPANY.shortName}) üzemelteti.
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
            <h2 className="text-lg font-semibold text-black/90">2. Fogalmak</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>
                <strong className="font-semibold text-black/85">Honlap:</strong>{" "}
                a {COMPANY.website.replace(/^https?:\/\//, "")} címen elérhető
                weboldal és aloldalai.
              </li>
              <li>
                <strong className="font-semibold text-black/85">Felhasználó:</strong>{" "}
                aki a Honlapot böngészi, vagy azon keresztül megkeresést küld.
              </li>
              <li>
                <strong className="font-semibold text-black/85">Megkeresés:</strong>{" "}
                kapcsolatűrlap, e-mail vagy telefon útján érkező érdeklődés,
                ajánlatkérés.
              </li>
              <li>
                <strong className="font-semibold text-black/85">
                  Egyedi szerződés:
                </strong>{" "}
                a Felek által aláírt vagy írásban elfogadott kivitelezési,
                szakági vagy egyéb vállalkozási szerződés.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">
              3. Az ÁSZF hatálya
            </h2>
            <p className="mt-2">
              Az ÁSZF a Honlap használatára, a Megkeresések fogadására és a
              Honlapon közzétett tájékoztató tartalomra vonatkozik. Nem
              minősül általános vállalkozási szerződésnek kivitelezési
              munkákra.
            </p>
            <p className="mt-2">
              Ha a Felek Egyedi szerződést kötnek, az Egyedi szerződés és annak
              mellékletei az irányadók. Ellentmondás esetén az Egyedi szerződés
              megelőzi ezt az ÁSZF-et a konkrét munkára nézve.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">
              4. A Honlap használata
            </h2>
            <p className="mt-2">
              A Honlap célja a {COMPANY.shortName} tevékenységeinek bemutatása
              (generálkivitelezés, szakági és asztalos munkák), valamint a
              kapcsolatfelvétel megkönnyítése.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                A Honlap tartalma tájékoztató jellegű. Nem minősül kötelező
                ajánlattételnek, nyilvános ajánlatnak vagy árjegyzéknek.
              </li>
              <li>
                A Felhasználó a Honlapot jogszerűen, a rendeltetésének megfelelően
                használhatja. Tilos a Honlap működését akadályozni, jogosulatlanul
                adatot kinyerni, vagy a rendszert túlterhelni.
              </li>
              <li>
                A Honlapot a Vercel Inc. infrastruktúráján üzemeltetjük. Az
                elérhetőségért és a folyamatos működésért a tárhelyszolgáltató
                és a hálózat adottságai is felelősek; 100%-os rendelkezésre állást
                nem vállalunk.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">
              5. Megkeresés, ajánlatkérés
            </h2>
            <p className="mt-2">
              A kapcsolatűrlap, e-mail vagy telefon útján küldött Megkeresés nem
              hoz létre vállalkozási szerződést. A {COMPANY.shortName} a
              Megkeresést megvizsgálja, és e-mailben vagy telefonon válaszol.
            </p>
            <p className="mt-2">
              Írásos árajánlat csak a műszaki tartalom, helyszín és egyéb
              szükséges adatok tisztázása után készül. Az ajánlat csak az abban
              megjelölt időtartamig és feltételekkel kötelezi a szolgáltatót.
              A munka megkezdéséhez általában írásbeli Egyedi szerződés
              szükséges.
            </p>
            <p className="mt-2">
              A Felhasználó felel azért, hogy a Megkeresésben megadott adatok
              valósak és aktuálisak legyenek.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">
              6. Árak és fizetés
            </h2>
            <p className="mt-2">
              A Honlapon nincs publikus négyzetméterár vagy árkalkulátor. Az ár
              mindig az adott projekt műszaki tartalma, mennyisége, helyszíne és
              ütemezése alapján, írásban kerül meghatározásra. Fizetési feltételek
              az Egyedi szerződésben szerepelnek.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">
              7. Szellemi tulajdon
            </h2>
            <p className="mt-2">
              A Honlap szövegei, fotói, grafikai elemei, logója és szerkesztett
              tartalma a {COMPANY.shortName} vagy jogosult partnereinek
              tulajdonát képezik. Másolás, továbbközlés vagy üzleti célú
              felhasználás csak előzetes írásbeli hozzájárulással engedélyezett,
              kivéve a jogszabály által megengedett eseteket.
            </p>
            <p className="mt-2">
              A referenciák és futó projektek fotói ügyfél-jóváhagyással
              jelenhetnek meg. Harmadik személyek védjegyei (pl. márkanevek a
              fotókon) az adott jogosult tulajdonát képezik.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">
              8. Felelősség
            </h2>
            <p className="mt-2">
              A Honlapon közölt információkat gondosan állítjuk össze, de nem
              vállalunk helytállást a teljeskörűségért, aktualitásért vagy azért,
              hogy a tartalom minden döntési helyzetben elegendő. A kivitelezési
              felelősség az Egyedi szerződés és a vonatkozó jogszabályok szerint
              érvényesül.
            </p>
            <p className="mt-2">
              A {COMPANY.shortName} nem felel olyan károkért, amelyek a Honlap
              ideiglenes elérhetetlenségéből, a Felhasználó eszközéből, a
              hálózatból, vagy harmadik fél oldalára mutató linkekből erednek,
              kivéve ha a kár szándékos vagy súlyosan gondatlan magatartásunkra
              vezethető vissza.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">
              9. Külső linkek
            </h2>
            <p className="mt-2">
              A Honlap tartalmazhat külső weboldalakra mutató hivatkozásokat (pl.
              Google Térkép, partner oldalak, sajtócikkek). Ezek tartalmáért és
              adatkezeléséért a {COMPANY.shortName} nem felel.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">
              10. Adatvédelem és cookie
            </h2>
            <p className="mt-2">
              A személyes adatok kezeléséről az{" "}
              <Link
                href="/adatkezelesi-tajekoztato"
                className="font-medium text-[var(--color-brand)] underline underline-offset-2"
              >
                adatkezelési tájékoztató
              </Link>
              , a cookie-król a{" "}
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
              11. Irányadó jog, jogvita
            </h2>
            <p className="mt-2">
              Az ÁSZF-re a magyar jog az irányadó. A Felek a vitákat elsősorban
              egyeztetéssel kísérlik meg rendezni. Ennek sikertelensége esetén a
              magyar bíróságok rendelkeznek hatáskörrel és illetékességgel a
              Polgári perrendtartás szerint.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">12. Módosítás</h2>
            <p className="mt-2">
              Fenntartjuk a jogot, hogy az ÁSZF-et frissítsük. A hatályos
              változat mindig ezen az oldalon érhető el. A módosítás a közzététel
              napjától érvényes a Honlap használatára és az azt követően érkező
              Megkeresésekre.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black/90">13. Kapcsolat</h2>
            <p className="mt-2">
              Kérdés esetén írjon a{" "}
              <Link
                href="/kapcsolat"
                className="font-medium text-[var(--color-brand)] underline underline-offset-2"
              >
                Kapcsolat
              </Link>{" "}
              oldalon, vagy e-mailben:{" "}
              <a
                href={`mailto:${COMPANY.emails.central}`}
                className="font-medium text-[var(--color-brand)] underline underline-offset-2"
              >
                {COMPANY.emails.central}
              </a>
              {phone ? (
                <>
                  , telefon:{" "}
                  <a
                    href={`tel:${COMPANY.phones.primary}`}
                    className="font-medium text-[var(--color-brand)] underline underline-offset-2"
                  >
                    {phone}
                  </a>
                </>
              ) : null}
              .
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
