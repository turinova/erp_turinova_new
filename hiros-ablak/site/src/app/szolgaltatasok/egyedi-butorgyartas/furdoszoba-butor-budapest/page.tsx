import type { Metadata } from "next"
import Link from "next/link"
import { buildBreadcrumbJsonLd, pageMetadata } from "@/lib/seo"
import { COMPANY } from "@/lib/company"
import SpokeGallery from "@/components/egyedi-butor/SpokeGallery"
import {
  SPOKE_BODY,
  SPOKE_H2,
  SPOKE_LEAD,
  SPOKE_LINK,
  SpokeFaq,
  SpokeHero,
  SpokePoints,
  SpokeRelated,
  SpokeSection,
  SpokeSurvey,
} from "@/components/egyedi-butor/SpokeSections"
import {
  CANONICAL_PATH,
  SURVEY_PHONE,
  SURVEY_PHONE_DISPLAY,
  galleryFor,
  galleryItemBySrc,
  spokeFor,
  type FaqEntry,
} from "@/lib/egyedi-butor-data"
import {
  buildFurnitureFaqJsonLd,
  buildFurnitureServiceJsonLd,
} from "@/lib/egyedi-butor-seo"

const PATH = spokeFor("furdo")!.path
const HERO = galleryItemBySrc("/img/egyedi-butor/IMG_5460.jpeg")

export const metadata: Metadata = pageMetadata({
  title: "Fürdőszoba bútor – méretre gyártva",
  description:
    "Egyedi fürdőszoba bútor: mosdószekrény, tükrös tároló, mosógép burkolat. Nedvességtűrő anyagok, díjmentes helyszíni felmérés Budapesten, Pest megyében, Bács-Kiskunban és a Balaton környékén.",
  canonical: PATH,
  ogImage: HERO.src,
})

const POINTS = [
  {
    title: "A mosdó típusa szabja meg a fiókokat",
    text: "Pultra ültetett tálmosdó alá teljes magasságú fiók mehet. Egy alulról szerelt vagy beépített kerámiamosdó viszont belelóg a szekrénybe, tehát a fiók hátát ki kell vágni, vagy két keskenyebb fiók lesz belőle. Ezért kérjük a felmérésen a mosdó típusát és méretét.",
  },
  {
    title: "A szifon és a fali bekötés helye",
    text: "A lefolyó és a vízbekötés pozíciója dönti el, hány fiók fér a mosdó alá, és milyen magasak lehetnek. Ha a csempézés még nem történt meg, ezt előre össze tudjuk hangolni a vízvezeték-szerelővel, és akkor nem a bútor fizeti meg a rossz bekötési pontot.",
  },
  {
    title: "Függesztett vagy lábon álló",
    text: "A függesztett szekrény alatt fel lehet mosni, és a helyiség nagyobbnak látszik. Ehhez viszont teherhordó rögzítés kell: gipszkarton falnál előre bele kell építeni a fát vagy a fémvázat, mert utólag már bontás nélkül nem megy.",
  },
  {
    title: "Mosógép és szárító burkolása",
    text: "Két dologra kell figyelni. A rezgés nem adható át a bútornak, tehát a gép nem szorulhat be a korpuszba. Szerviz esetén pedig ki kell tudni húzni a gépet, ezért a burkolat nyitható vagy bontható. Egymásra rakott gép fölé polc, mellé keskeny kihúzható tároló kerül.",
  },
  {
    title: "Tükör és világítás",
    text: "A tükör mögötti vagy körüli világítás azért jobb, mint a plafonlámpa, mert nem az arcra vet árnyékot. Tükrös szekrénnyel a tükör felülete egyben tárolóhely is lesz, ami kis fürdőben gyakran ez az egyetlen szabad hely.",
  },
  {
    title: "Radiátor és törölközőtartó",
    text: "A radiátor és a bútor vége között levegőt kell hagyni, különben a szekrény oldala folyamatos hőterhelést kap. Ezt a távolságot felmérjük, nem becsüljük.",
  },
] as const

const FAQ: readonly FaqEntry[] = [
  {
    q: "Milyen anyagból készül egy fürdőszoba bútor?",
    a: "A korpusz általában nedvességnek jobban ellenálló bútorlapból, a front bútorlapból, fóliás, matt vagy festett felülettel. Nem az anyagválasztás a leggyakoribb hibaforrás, hanem a kidolgozás: ha egy vágott él zárás nélkül marad, ott a lap felveszi a vizet. Nálunk az élzárás házon belül van, ugyanazon a gépsoron, amin a szakmának is dolgozunk.",
  },
  {
    q: "Tönkreteszi-e a pára a bútort?",
    a: "Rendesen zárt élekkel és megfelelő szellőzéssel nem. A tipikus meghibásodás oda köthető, ahol víz áll: a mosdó körüli felület, a szifon környéke és a lábazat. Ezeken a pontokon zárt éllel, vízálló ragasztással és a lábazat elemelésével dolgozunk. Ha a fürdőben nincs elszívás vagy nyitható ablak, azt a felmérésen jelezzük, mert az minden bútort megvisel.",
  },
  {
    q: "Kis fürdőszobába is érdemes egyedi bútort csináltatni?",
    a: "Ott a legnagyobb a különbség. Egy 3–4 négyzetméteres fürdőben a bolti méretek közül általában egy sem illeszkedik, tehát vagy nem fér be, vagy marad kihasználatlan sáv. Méretre gyártásnál a mosdó és az ajtó közötti 22 centi is fiókos tároló lehet.",
  },
  {
    q: "A mosógépet be tudják építeni a bútorba?",
    a: "Igen, de a burkolatot úgy tervezzük, hogy a gép szerviz esetén kihúzható legyen, és a rezgés ne adódjon át a korpuszra. Ha a mosógépre szárítót tesz, a két gép összekötő készletét érdemes előre megvenni, mert a magasság ettől is függ. A típusszámokat ezért kérjük a felmérésen.",
  },
  {
    q: "Csak mosdószekrényt is vállalnak, vagy a teljes fürdőt kell megcsináltatni?",
    a: "Egyetlen mosdószekrényt is legyártunk. Sokan így kezdik: kicserélik a mosdó alatti bútort, aztán jön a tükrös szekrény és a mosógép burkolata.",
  },
  {
    q: "Kádburkolatot vagy fa falburkolatot is készítenek?",
    a: "Igen, a fürdőben nem csak a mosdószekrény asztalosmunka. Készítettünk már szabadon álló kád mögé fa falburkolatot, szauna melletti burkolatot és beépített, kihúzható szennyestartót is. A galériában ezekre is talál példát.",
  },
]

export default function FurdoszobaButorBudapestPage() {
  const items = galleryFor("furdo").filter((g) => g.src !== HERO.src)
  const phoneTel = `tel:${SURVEY_PHONE}`

  const serviceJsonLd = buildFurnitureServiceJsonLd({
    name: "Egyedi fürdőszoba bútor gyártás Budapesten",
    description:
      "Méretre gyártott fürdőszoba bútor Budapesten, Pest megyében, Bács-Kiskunban és a Balaton környékén: mosdószekrény, tükrös tároló, mosógép burkolat, kádburkolat. Nedvességtűrő anyagok, zárt élek, díjmentes helyszíni felmérés.",
    path: PATH,
    serviceType: [
      "Fürdőszoba bútor",
      "Mosdószekrény gyártás",
      "Egyedi fürdőszoba bútor",
      "Mosógép burkolat",
    ],
  })

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Főoldal", path: "/" },
    { name: "Egyedi bútorgyártás", path: CANONICAL_PATH },
    { name: "Fürdőszoba bútor", path: PATH },
  ])

  return (
    <>
      <script
        id="ld-service-furdo"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <script
        id="ld-breadcrumb-furdo"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        id="ld-faq-furdo"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildFurnitureFaqJsonLd(FAQ)),
        }}
      />

      <SpokeHero
        image={HERO}
        eyebrow="Fürdőszoba bútor"
        title="Fürdőszoba bútor, ami kibírja a párát"
        lead="A fürdőben két dolog szab határt: a pára és a centi. Mindkettőt a felmérésen kezeljük, nem a beépítés napján."
        chips={[
          "Díjmentes helyszíni felmérés",
          "Minden vágott él zárva",
          "A mosdó és a szifon szerint méretezve",
        ]}
        phoneDisplay={SURVEY_PHONE_DISPLAY}
        phoneTel={phoneTel}
      />

      <SpokeSection>
        <h2 className={SPOKE_H2}>Miért más egy fürdőszoba bútor</h2>
        <p className={SPOKE_LEAD}>
          A fürdőben a bútor évekig napi páraterhelést kap, és a víz mindig a
          legsérülékenyebb ponton találja meg: a vágott élen. Ahol a lapszél
          zárás nélkül marad, ott a hordozó anyag felveszi a vizet és megdagad.
          A legtöbb tönkrement mosdószekrény nem az anyagválasztáson, hanem
          ezen bukik el.
        </p>
        <p className={SPOKE_BODY}>
          Az élzárás nálunk nem alvállalkozói tétel: 1996 óta szabunk és élzárunk
          Kecskeméten, ugyanazokon a gépeken, amelyeken a szakmának is dolgozunk.
          Ezért nem kompromisszum kérdése, hogy minden vágott él zárva legyen,
          beleértve a fiókok hátsó és a szifon körüli kivágásokat is.
        </p>
        <p className={SPOKE_BODY}>
          A másik határ a centi. Egy budapesti fürdő gyakran 3–4 négyzetméter,
          benne ajtóval, radiátorral és lefolyóval, amiket nem lehet elmozdítani.
          Ilyen térben a kapható bútorméretek közül általában egy sem illeszkedik,
          és ami befér, az kihasználatlan sávot hagy.
        </p>
      </SpokeSection>

      <SpokeSection tone="wash">
        <h2 className={SPOKE_H2}>Amit a felmérésen tisztázunk</h2>
        <p className={SPOKE_LEAD}>
          Hat kérdés, ami eldönti, hogy a bútor évekig működni fog-e, vagy
          folyamatos kompromisszum lesz.
        </p>
        <SpokePoints items={POINTS} />
      </SpokeSection>

      <SpokeSection>
        <h2 className={SPOKE_H2}>Nem csak a mosdószekrény</h2>
        <p className={SPOKE_LEAD}>
          A fürdőben több asztalosmunka van, mint amire elsőre gondol.
          Kádburkolat, fa falburkolat, szauna melletti padok, tükrös szekrény,
          beépített szennyestartó, keskeny kihúzható tároló a gépek mellé.
        </p>
        <p className={SPOKE_BODY}>
          Ha a fürdő és a hálószoba egy felújításban készül, érdemes együtt
          felmérni: a{" "}
          <Link href={spokeFor("gardrob")!.path} className={SPOKE_LINK}>
            beépített gardróbbal
          </Link>{" "}
          egy anyagpárból kihozva a két helyiség összeér. A felületeket a{" "}
          <Link href="/butorlap" className={SPOKE_LINK}>
            bútorlap katalógusban
          </Link>{" "}
          böngészheti, a csaptelepet és a vasalatot pedig{" "}
          <Link href="/barkacsaruhaz-kecskemet" className={SPOKE_LINK}>
            az áruházunk készletéből
          </Link>{" "}
          is tudjuk adni.
        </p>
      </SpokeSection>

      <SpokeGallery
        items={items}
        heading="Fürdőszobák, amiket gyártottunk"
        phoneDisplay={SURVEY_PHONE_DISPLAY}
        phoneTel={phoneTel}
      />

      <SpokeFaq
        heading="Fürdőszobával kapcsolatos kérdések"
        intro="A pára, a szifon és a mosógép: ezek jönnek elő a leggyakrabban."
        items={FAQ}
      />

      <SpokeSurvey
        heading="Mérjük fel a fürdőszobáját"
        intro="A felmérés díjmentes, és nem kötelez semmire. Egy munkanapon belül hívjuk, és egyeztetünk egy időpontot."
        category="furdo"
        email={COMPANY.emails.central}
        phoneDisplay={SURVEY_PHONE_DISPLAY}
        phoneTel={phoneTel}
      />

      <SpokeRelated current="furdo" />
    </>
  )
}
