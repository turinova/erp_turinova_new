import { COMPANY, formatPhoneDisplay, NAIH } from "@/lib/company"
import { COOKIE_CONSENT_STORAGE_KEY } from "@/lib/cookie-consent"
import { TURINOVA_HOME_URL } from "@/lib/footer-data"
import type { LegalSection } from "@/components/site/LegalDocument"

export const LEGAL_LAST_UPDATED = "2026. május 15."

const phonePrimary = formatPhoneDisplay(COMPANY.phones.primary)
const phoneSecondary = formatPhoneDisplay(COMPANY.phones.secondary)
const infra = COMPANY.webInfrastructure

function controllerBlock(): string[] {
  return [
    `Adatkezelő: ${COMPANY.legalName} (${COMPANY.shortName})`,
    `Székhely és levelezési cím: ${COMPANY.address.full}`,
    `Adószám: ${COMPANY.taxIdDisplay}`,
    `Cégjegyzékszám: ${COMPANY.companyRegistrationNumber}`,
    `EUTR: ${COMPANY.eutr}`,
    `Weboldal: ${COMPANY.website}`,
    `E-mail: ${COMPANY.emails.central}`,
    `Telefon: ${phonePrimary}, ${phoneSecondary}`,
  ]
}

export function getCookiePolicySections(): LegalSection[] {
  return [
    {
      id: "adatkezelo",
      title: "Adatkezelő",
      list: controllerBlock(),
    },
    {
      id: "mi-a-suti",
      title: "Mi a süti?",
      paragraphs: [
        "A sütik (cookie-k) kisméretű fájlok vagy böngészőben tárolt adatok, amelyek a weboldal működéséhez, illetve – az Ön hozzájárulása esetén – statisztikai vagy marketing célokhoz szükségesek lehetnek.",
        "A leggyakoribb böngészőkben a sütik kezelése a böngésző beállításaiban módosítható. A sütik tiltása befolyásolhatja a weboldal egyes funkcióit.",
      ],
    },
    {
      id: "hozzajarulas",
      title: "Hogyan kérünk hozzájárulást?",
      paragraphs: [
        "Az első látogatáskor süti-tájékoztató jelenik meg három választással: „Csak szükséges”, „Beállítások” és „Elfogadom mind”.",
        "A választást a böngésző helyi tárolójában (localStorage) rögzítjük. A beállítások a weboldal láblécében a „Süti beállítások” menüponttal bármikor módosíthatók.",
      ],
    },
    {
      id: "kategoriak",
      title: "Süti kategóriák ezen a weboldalon",
      list: [
        "Szükséges: a süti-beállítások mentése (localStorage kulcs: „" +
          COOKIE_CONSENT_STORAGE_KEY +
          "”). Ez a weboldal működéséhez szükséges; nem kapcsolható ki a bannerben.",
        "Statisztika: jelenleg nem használunk külön analytics (mérési) szolgáltatást ezen a weboldalon. Ha később bevezetésre kerül, csak hozzájárulás után.",
        "Marketing / külső tartalom: a Google értékelések megjelenítéséhez a Trustindex szolgáltatás töltődik be (cdn.trustindex.io). Csak marketing süti engedélyezése után.",
      ],
    },
    {
      id: "harmadik-fel",
      title: "Harmadik felek",
      list: [
        `Trustindex – külső vélemény-widget; adatkezelő: a szolgáltató (trustindex.io). Csak marketing hozzájárulás után töltődik be.`,
        `A weboldal tárhelye: ${infra.hostingProvider} (${infra.hostingProviderUrl}).`,
        `A katalógus adatbázisa: ${infra.databaseProvider} (${infra.databaseProviderUrl}).`,
        `A domain szolgáltatója: ${infra.domainProvider} (${infra.domainProviderUrl}).`,
      ],
    },
    {
      id: "kapcsolat",
      title: "Kapcsolat",
      paragraphs: [
        `Adatvédelmi kérdésben: ${COMPANY.emails.central}`,
        "Részletes személyes adatkezelés: lásd az Adatkezelési tájékoztatót.",
      ],
    },
  ]
}

export function getPrivacyPolicySections(): LegalSection[] {
  return [
    {
      id: "adatkezelo",
      title: "Adatkezelő",
      list: controllerBlock(),
    },
    {
      id: "jogalap",
      title: "Jogszabályi háttér",
      paragraphs: [
        "Tájékoztatónk az Európai Parlament és a Tanács (EU) 2016/679 rendeletére (GDPR), az információs önrendelkezési jogról és az információszabadságról szóló 2011. évi CXII. törvényre (Infotv.), valamint a Polgári Törvénykönyvről szóló 2013. évi V. törvényre (Ptk.) épül.",
      ],
    },
    {
      id: "elvek",
      title: "Adatkezelési alapelvek",
      list: [
        "Jogszerű, tisztességes és átlátható adatkezelés",
        "Célhoz kötöttség és adattakarékosság",
        "Pontosság és korlátozott megőrzés",
        "Megfelelő technikai és szervezési biztonság",
      ],
    },
    {
      id: "adatkorok",
      title: "Milyen adatokat kezelünk ezen a weboldalon?",
      list: [
        "Kapcsolatfelvételi űrlap: név, e-mail cím, telefonszám (opcionális), téma, üzenet – az Ön megkeresésének kezeléséhez.",
        "Süti-beállítások: a böngészőben tárolt választás (localStorage) – a süti-tájékoztató szerint.",
        "Technikai naplók: a weboldal kiszolgálása során keletkező technikai adatok (pl. IP-cím, böngésző típusa) – a Vercel hosting működéséhez szükséges mértékben.",
        "Katalógus böngészés: a bútorlap és munkalap katalógusban megjelenő termékadatok a Supabase adatbázisból kerülnek kiszolgálásra; személyes adatot nem kell megadni a böngészéshez.",
      ],
    },
    {
      id: "celok",
      title: "Kezelési célok és jogalapok (összefoglalva)",
      list: [
        "Kapcsolatfelvétel, ügyfélszolgálat – jogos érdek / szerződéskötés előkészítése / hozzájárulás (űrlap).",
        "Weboldal működtetése, biztonság – jogos érdek / technikai szükségszerűség.",
        "Süti-kategóriák (statisztika, marketing) – hozzájárulás, a süti-bannerben megadott választás szerint.",
        "Üzleti teljesítés, számlázás – a személyes ügyintézés és a jogszabályi kötelezettségek szerint (részletek az ügyintézés során egyeztetve).",
      ],
    },
    {
      id: "online-rendeles",
      title: "Online árajánlat és rendelés (Turinova)",
      paragraphs: [
        `A lapszabászati online árajánlat és rendelés a ${TURINOVA_HOME_URL} címen elérhető Turinova rendszeren történik. Ez a szolgáltatás külön weboldalon fut; az ott megadott személyes adatok kezelésére a Turinova oldalán közzétett adatvédelmi tájékoztató az irányadó.`,
        "A HÍRÖS-ABLAK Kft. a Turinova rendszert fejleszti és üzemelteti üzleti célra; az adatkezelés részletei az ügyféllel folytatott szerződéses kapcsolatban is egyeztethetők.",
      ],
    },
    {
      id: "atvetel",
      title: "Átvétel, szállítás",
      paragraphs: [
        "A HÍRÖS-ABLAK Kft. üzletében vásárolt bútorlap, munkalap, lapszabászati és nagyobb tételek átvétele személyesen történik Kecskeméten, a Mindszenti körút 10. szám alatt, raklapra pakolva.",
        "Ezen a weboldalon nem vállalunk saját házhoz szállítást a fenti termékekre. A vasalatmester.hu webáruház (külön szolgáltatás) saját szabályai szerint intézhet kiszállítást; az ott megadott adatokra az adott webáruház tájékoztatója vonatkozik.",
      ],
    },
    {
      id: "kapcsolat-api",
      title: "Kapcsolatfelvételi űrlap technikai feldolgozása",
      paragraphs: [
        "A kapcsolatfelvételi űrlap adatai a weboldal szerveroldali programjához (Vercel hosting) érkeznek ellenőrzésre.",
        "Jelenleg az űrlap beküldése után az adatokat szerveroldali naplózással rögzítjük; az e-mail küldés integrációja külön beállítás alatt áll. Az űrlap csak az adatkezelési tájékoztató elfogadása után küldhető el.",
      ],
    },
    {
      id: "feldolgozok",
      title: "Adatfeldolgozók és technikai szolgáltatók (ezen a weboldalon)",
      list: [
        `${infra.hostingProvider} – a ${COMPANY.website} weboldal (Next.js alkalmazás) üzemeltetése.`,
        `${infra.databaseProvider} – a nyilvános bútorlap és munkalap katalógus adatainak tárolása és kiszolgálása.`,
        `${infra.domainProvider} – a ${COMPANY.website} domain regisztrációja és DNS szolgáltatása.`,
        `Trustindex (trustindex.io) – Google értékelések widget; csak marketing süti hozzájárulás után.`,
      ],
    },
    {
      id: "megorzes",
      title: "Megőrzési idő",
      paragraphs: [
        "A megőrzési idő az adatkezelés céljától függ. Kapcsolatfelvételi üzeneteket az ügyintézés lezárásáig, legfeljebb az ügyfélszolgálati gyakorlatnak megfelelő ideig őrizzük meg.",
        "A süti-hozzájárulás a böngészőben tárolt beállítás törléséig, illetve visszavonásáig érvényes.",
        "Számlázási és szerződéses dokumentumok megőrzése a vonatkozó jogszabályokban előírt kötelező megőrzési idő szerint történik.",
        "A pontos megőrzési időt az adott ügyben az ügyintézés során, illetve a vonatkozó jogszabályoknak megfelelően alkalmazzuk.",
      ],
    },
    {
      id: "jogok",
      title: "Érintetti jogok",
      list: [
        "Tájékoztatáshoz, hozzáféréshez, helyesbítéshez, törléshez („elfeledtetéshez”), az adatkezelés korlátozásához, tiltakozáshoz és adathordozhatósághoz való jog – a GDPR szerint.",
        "Hozzájárulás visszavonása bármikor, a hozzájáruláson alapuló adatkezelés esetén.",
        `Panasz benyújtása: ${NAIH.shortName} – ${NAIH.address}, telefon: ${NAIH.phone}, e-mail: ${NAIH.email}, web: ${NAIH.website}`,
      ],
    },
    {
      id: "sutik",
      title: "Sütik",
      paragraphs: [
        "A sütik részletes leírása a Cookie (süti) tájékoztatóban található. Marketing jellegű külső tartalom (Trustindex) csak az Ön süti-beállításában adott hozzájárulás után töltődik be.",
      ],
    },
    {
      id: "profilalkotas",
      title: "Profilalkotás, automatizált döntéshozatal",
      paragraphs: [
        "Ezen a weboldalon nem végzünk profilalkotást, és nem hozunk kizárólag automatizált adatkezelés útján Önt joghatással járó döntést.",
      ],
    },
    {
      id: "kapcsolat",
      title: "Kapcsolat adatvédelem ügyben",
      paragraphs: [
        `E-mail: ${COMPANY.emails.central}`,
        `Postai cím: ${COMPANY.address.full}`,
        `Telefon: ${phonePrimary}`,
      ],
    },
  ]
}
