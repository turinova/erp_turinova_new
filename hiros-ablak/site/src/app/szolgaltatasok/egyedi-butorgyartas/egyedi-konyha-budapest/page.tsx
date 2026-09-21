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
  KONYHA_PRICE_FROM,
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

const PATH = spokeFor("konyha")!.path
const HERO = galleryItemBySrc("/img/egyedi-butor/IMG_5505.jpeg")

export const metadata: Metadata = pageMetadata({
  title: "Egyedi konyhabútor – méretre gyártva, 2 M Ft-tól",
  description:
    "Egyedi konyha 2 millió Ft-tól. Díjmentes helyszíni felmérés Budapesten, Pest megyében, Bács-Kiskunban és a Balaton környékén. Sarokmegoldás, gépbeépítés, saját kecskeméti üzem.",
  canonical: PATH,
  ogImage: HERO.src,
})

const POINTS = [
  {
    title: "A fal szinte soha nem derékszögű",
    text: "Panelben és régi bérházban a sarok általában néhány fokkal elfordul. Ha a bútor mereven derékszögű, a végén rés marad, és jön a kitöltőléc. Ezért a felmérésen a falak dőlését is felvesszük, és a korpusz ehhez igazodik.",
  },
  {
    title: "A sarok a konyha legdrágább négyzetmétere",
    text: "L vagy U alakú konyhánál a sarok vagy elveszik, vagy megfizeti egy kihúzható sarokelemmel. Mindkettő védhető döntés, csak jó előre tudni róla, mert az ajánlatban külön tétel.",
  },
  {
    title: "A gép helye használati kérdés, nem esztétikai",
    text: "A sütő szemmagasságban azért jobb, mert nem kell lehajolni a forró tepsihez. A mosogatógép a mosogató mellé kerül, különben a vizes edényt át kell hordani a konyhán. A hűtőt pedig nem tesszük a bejárati ajtó mögé, mert ott nem nyílik ki teljesen.",
  },
  {
    title: "A pult magassága nem szabványkérdés",
    text: "A 90 centi egy átlagra van kitalálva. Ha Ön 175 centi fölött van, néhány centivel magasabb munkalapon kényelmesebb a szeletelés és a mosogatás. Ez utólag nem állítható, ezért a felmérésen szóba kerül.",
  },
  {
    title: "A páraelszívónak útvonal kell",
    text: "A kivezetett elszívó hatékonyabb, de kell hozzá nyomvonal a külső falig, és ezt a bútor felett kell elvezetni. Ha nincs rá mód, keringetéses megoldást tervezünk — jobb ezt a megrendelés előtt tisztázni, mint a beépítés napján.",
  },
  {
    title: "Dugaljból mindig kevesebb van, mint amennyit szeretne",
    text: "A munkalap fölé általában kevés konnektor kerül, és ami van, az nem ott. Amíg a villanyszerelő dolgozik, ez még összeegyeztethető a bútor tervével; utólag már a csempét kell bontani.",
  },
] as const

const FAQ: readonly FaqEntry[] = [
  {
    q: "Mennyibe kerül egy egyedi konyha Budapesten?",
    a: `Egyedi konyha ${KONYHA_PRICE_FROM.label}. Ugyanaz a konyha kétszeres áron is elkészülhet, ha festett front és kőmintás munkalap kerül rá. ${KONYHA_PRICE_FROM.note} A felmérésen meg tudjuk mondani, hogy amit elképzelt, melyik árszinthez esik közel.`,
  },
  {
    q: "A beépíthető gépeket Önök szerzik be?",
    a: "Ahogy szeretné. Sokan maguk vásárolják meg a gépeket, mert akciót találnak rá; ilyenkor a típusszámokat kérjük a felmérésen, mert a beépítési méret gépenként eltér. Mosogatót, csaptelepet és vasalatot az áruházunk készletéből is tudunk adni.",
  },
  {
    q: "Melyik munkalapot érdemes választani?",
    a: "A laminált munkalap ára és választéka a legjobb, de a vágott élt és a mosogató körüli részt gondosan kell zárni. A kőmintás, vastagabb felületek karc- és hőtűrése jobb, viszont drágábbak, és a szabásuk is más technológia. A felmérésen végigvesszük, hogyan használja a konyhát: aki sokat sütöget, más lapot kap, mint aki hetente kétszer főz.",
  },
  {
    q: "Panelbe is érdemes egyedi konyhát csináltatni?",
    a: "Ott a legnagyobb a különbség. A panelkonyha alapterülete kicsi, a falak pedig ritkán derékszögűek, tehát a készmodulos megoldásnál pontosan azok a centik mennek el lécre, amikre a legnagyobb szükség van. A mennyezetig épített felsőszekrény és a rendes sarokmegoldás ugyanabból az alapterületből érezhetően több tárolót ad.",
  },
  {
    q: "Ki szereli be, és mennyi idő a helyszíni munka?",
    a: "A beépítést a mi csapatunk végzi, nem adjuk ki alvállalkozónak. A helyszíni munka hossza a konyha méretétől és a gépek számától függ; a pontos ütemezést az ajánlat elfogadása után egyeztetjük, hogy a víz- és villanyszerelő is a megfelelő napon legyen ott.",
  },
  {
    q: "A konyha és a nappali egybe nyílik. Ezt is együtt lehet kezelni?",
    a: "Igen, és érdemes is. Ha a konyha látszik a nappaliból, akkor a szigetnek, a tv-falnak és a beépített tárolónak ugyanabból az anyagpárból kell kijönnie, különben két külön bútor áll egy térben. A felmérésen mindkét helyiséget felmérjük, és egy tervben kezeljük.",
  },
  {
    q: "A régi konyhát elszállítják?",
    a: "A bontásról és a régi bútor elszállításáról a felmérésen egyeztetünk, hogy a beépítés napjára üres legyen a hely. Ha ezt Ön szervezi, az is rendben van, csak tudnunk kell róla előre.",
  },
]

export default function EgyediKonyhaBudapestPage() {
  const items = galleryFor("konyha").filter((g) => g.src !== HERO.src)
  const phoneTel = `tel:${SURVEY_PHONE}`

  const serviceJsonLd = buildFurnitureServiceJsonLd({
    name: "Egyedi konyhabútor gyártás Budapesten",
    description:
      "Méretre gyártott egyedi konyha Budapesten, Pest megyében, Bács-Kiskunban és a Balaton környékén: díjmentes helyszíni felmérés, sarokmegoldások, gépbeépítés, munkalap és vasalat egy kézből. A gyártás a kecskeméti üzemünkben történik.",
    path: PATH,
    serviceType: [
      "Egyedi konyhabútor",
      "Konyhabútor gyártás",
      "Konyhasziget készítés",
      "Méretre gyártott konyha",
    ],
  })

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Főoldal", path: "/" },
    { name: "Egyedi bútorgyártás", path: CANONICAL_PATH },
    { name: "Egyedi konyha", path: PATH },
  ])

  return (
    <>
      <script
        id="ld-service-konyha"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <script
        id="ld-breadcrumb-konyha"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        id="ld-faq-konyha"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildFurnitureFaqJsonLd(FAQ)),
        }}
      />

      <SpokeHero
        image={HERO}
        eyebrow="Egyedi konyha"
        title="Egyedi konyha Budapesten, a saját üzemünkből"
        lead="Felmérjük a falakat, a nyílásokat és a csatlakozókat, és a bútor születik a méretekhez. Nem fordítva. Egyedi konyha 2 millió Ft-tól."
        chips={[
          "Díjmentes helyszíni felmérés",
          "2 millió Ft-tól",
          "Gyártás saját üzemben",
        ]}
        phoneDisplay={SURVEY_PHONE_DISPLAY}
        phoneTel={phoneTel}
      />

      <SpokeSection>
        <h2 className={SPOKE_H2}>Ahol a készkonyha elfogy</h2>
        <p className={SPOKE_LEAD}>
          Egy modulos konyhánál 60 centis elemekből kell kiraknia a falat, és
          ami a végén marad, azt kitöltőléc fedi. Néhány centi, csak épp mindig
          a legrosszabb helyen: a sarokban, a hűtő mellett vagy a munkalap
          végén.
        </p>
        <p className={SPOKE_BODY}>
          Méretre gyártásnál ez a néhány centi nem veszteség, hanem fiók. A
          felsőszekrény a mennyezetig megy, tehát nem marad porfogó rés fölötte,
          a sarokba pedig olyan megoldás kerül, amit valóban el lehet érni.
          Ugyanabból az alapterületből annyival több tároló jön ki, amennyit egy
          bolti bútornál a lécek és a kihasználatlan sávok elvisznek.
        </p>
        <p className={SPOKE_BODY}>
          A bútorlapot 1996 óta szabjuk Kecskeméten, és ugyanazokon a gépeken
          dolgozunk a szakmának is. A konyhája nem külsős üzemben készül: aki
          felmérte, ugyanabban az épületben adja le a rajzot, ahol vágunk és
          élzárunk.
        </p>
      </SpokeSection>

      <SpokeSection tone="wash">
        <h2 className={SPOKE_H2}>Amin a felmérésen végigmegyünk</h2>
        <p className={SPOKE_LEAD}>
          Nem méretszalaggal kezdünk, hanem kérdésekkel. Ezek azok, amelyeknél a
          legtöbb konyha eldől.
        </p>
        <SpokePoints items={POINTS} />
      </SpokeSection>

      <SpokeSection>
        <h2 className={SPOKE_H2}>Front, munkalap, vasalat</h2>
        <p className={SPOKE_LEAD}>
          Nem egy gyártó egy kínálatából választ. A front, a munkalap és a
          vasalat külön döntés, és együtt adják ki az árat.
        </p>
        <p className={SPOKE_BODY}>
          A frontok készülhetnek bútorlapból, illetve festett, fóliás vagy matt
          felülettel. A laptárunk online is böngészhető a{" "}
          <Link href="/butorlap" className={SPOKE_LINK}>
            bútorlap katalógusban
          </Link>
          , a különleges frontokat pedig{" "}
          <Link href="/szolgaltatasok/nettfront" className={SPOKE_LINK}>
            NettFront partnerként
          </Link>{" "}
          hozzuk. A munkalap dekorjait a{" "}
          <Link href="/munkalap" className={SPOKE_LINK}>
            munkalap katalógusban
          </Link>{" "}
          találja, és a kecskeméti bemutatótermünkben kézbe is tudja venni őket.
        </p>
        <p className={SPOKE_BODY}>
          A pántot, a fiókrendszert, a mosogatót és a csaptelepet{" "}
          <Link href="/barkacsaruhaz-kecskemet" className={SPOKE_LINK}>
            az áruházunk készletéből
          </Link>{" "}
          is tudjuk adni. Ennek az a gyakorlati haszna, hogy nem a beszerzési
          idő dönti el, mi kerül a bútorba. Ha valamit már megvett máshol, azt
          építjük be.
        </p>
      </SpokeSection>

      <SpokeSection tone="wash">
        <h2 className={SPOKE_H2}>Új építésnél és felújításnál más a sorrend</h2>
        <p className={SPOKE_LEAD}>
          Ha még folyik a kivitelezés, hívjon minket a villanyszerelés előtt. A
          konnektor, a gázcsonk, a szellőző nyomvonala és a lefolyó helye ilyenkor
          még papíron rendezhető, és nem a bútornak kell alkalmazkodnia hozzájuk.
        </p>
        <p className={SPOKE_BODY}>
          Kész, lakott konyhánál is dolgozunk, csak ott a meglévő adottságokhoz
          mérünk. A folyamat mindkét esetben ugyanaz: felmérés, rajz és tételes
          ajánlat, gyártás, beépítés. A{" "}
          <Link href={`${CANONICAL_PATH}#folyamat`} className={SPOKE_LINK}>
            négy lépést itt írtuk le részletesen
          </Link>
          .
        </p>
      </SpokeSection>

      <SpokeGallery
        items={items}
        heading="Konyhák, amiket gyártottunk"
        phoneDisplay={SURVEY_PHONE_DISPLAY}
        phoneTel={phoneTel}
      />

      <SpokeFaq
        heading="Konyhával kapcsolatos kérdések"
        intro="Ezeket kérdezik a leggyakrabban, amikor konyha miatt hívnak."
        items={FAQ}
      />

      <SpokeSurvey
        heading="Mérjük fel a konyháját"
        intro="A felmérés díjmentes, és nem kötelez semmire. Egy munkanapon belül hívjuk, és egyeztetünk egy időpontot."
        category="konyha"
        email={COMPANY.emails.central}
        phoneDisplay={SURVEY_PHONE_DISPLAY}
        phoneTel={phoneTel}
      />

      <SpokeRelated current="konyha" />
    </>
  )
}
