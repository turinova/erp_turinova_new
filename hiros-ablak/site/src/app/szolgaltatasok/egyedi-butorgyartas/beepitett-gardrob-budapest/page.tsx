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

const PATH = spokeFor("gardrob")!.path
const HERO = galleryItemBySrc("/img/egyedi-butor/BJP_3653.jpg")

export const metadata: Metadata = pageMetadata({
  title: "Beépített gardrób és szekrény – méretre gyártva",
  description:
    "Beépített gardrób méretre: előszoba, ferde tetőtér, lépcső alatti tér. Díjmentes helyszíni felmérés Budapesten, Pest megyében, Bács-Kiskunban és a Balaton környékén.",
  canonical: PATH,
  ogImage: HERO.src,
})

const POINTS = [
  {
    title: "Mélység: a vállfa adja a méretet",
    text: "Vállfás tárolásra 60 centi belső mélység kell, mert a vállfa szélessége szabja meg. 45–50 centinél a ruha már csak hosszában fér el, oldalra fordított vállfán vagy kihúzható rúdon. Egy 55 centis előszobában ez az egy adat dönti el, mi kerülhet a szekrénybe.",
  },
  {
    title: "Tolóajtó vagy nyíló",
    text: "A tolóajtóból mindig csak az egyik fele nyílik ki, és a sínrendszer elvisz 8–10 centit a belső mélységből. A nyíló ajtó teljes hozzáférést ad, viszont kell előtte hely a kinyitáshoz. Szűk előszobában ez a döntés mindent meghatároz, ezért a felmérésen a szemközti falat is bemérjük.",
  },
  {
    title: "A belső beosztás a ruhatárához igazodik",
    text: "Sok hosszú kabát mást kíván, mint sok összehajtott póló. Végigkérdezzük: mennyi vállfás rész kell, mennyi polc, kell-e fiók, nadrágtartó, cipős rész, és hova menjenek a bőröndök. Ez a rész nem kerül többe, csak végig kell beszélni.",
  },
  {
    title: "Ferde tető: a szarufa dőlése a szekrény oldala",
    text: "Tetőtérben a szekrény oldallapja a tetősík dőlését követi, így a térdfal előtti sáv sem marad üresen. A legalacsonyabb részt fiókkal vagy kihúzható kosárral érdemes megnyitni, mert oda benyúlni kényelmetlen.",
  },
  {
    title: "Tükör és világítás",
    text: "Tükrös ajtó szűk előszobában optikailag is segít, és megspórol egy külön tükröt. A mozgásérzékelős LED a szekrény belsejében gyakorlati kérdés: egy 60 centi mély szekrény hátsó harmadában amúgy nincs fény.",
  },
  {
    title: "Fogantyú, vagy fogantyú nélkül",
    text: "A fogantyú nélküli, nyomásra nyíló front tisztább képet ad, de a felületen jobban látszik a kézlenyomat. Matt, ujjlenyomat-mentes fronttal ez kezelhető. Peremes, gola profilos megoldásnál a fogás a front élén van, és a felület érintetlen marad.",
  },
] as const

const PLACES = [
  {
    title: "Előszoba",
    text: "Itt a legszűkebb a hely, és itt a legnagyobb a nyereség. Kabát, cipő, porszívó, kulcs és a bejövő csomagok egy szekrénybe: ez az a bútor, ami napi tíz alkalommal kinyílik.",
  },
  {
    title: "Hálószoba",
    text: "Padlótól mennyezetig érő szekrényfal, gyakran a falfülke vagy a kémény mellé illesztve. A fal síkjában futó front miatt a szoba nem lesz szűkebb, csak eltűnik egy fal mögé a ruhatár.",
  },
  {
    title: "Tetőtér",
    text: "Ferde, alacsony, és két egyforma sarok sincs benne. Tipikusan olyan tér, ahol bolti szekrény nem áll meg, viszont méretre gyártva jelentős tárolót ad.",
  },
  {
    title: "Lépcső alatt",
    text: "Csökkenő magasságú háromszög, ahol a fiók és a kihúzható tároló működik, a mély polc nem. Cipőnek, szezonális dolgoknak és a takarítógépeknek ideális.",
  },
  {
    title: "Falfülke, kiugrás mellett",
    text: "Régi bérházakban gyakori az a 40–70 centis beugró, amihez nincs kapható méret. Pontosan ez az a hely, ahol a méretre gyártás nem luxus, hanem az egyetlen megoldás.",
  },
] as const

const FAQ: readonly FaqEntry[] = [
  {
    q: "Tolóajtós vagy nyíló ajtós gardróbot válasszunk?",
    a: "Ha a szekrény előtt kevesebb mint egy méter hely van, tolóajtó. Ha van elég hely az ajtók kinyitásához, akkor nyíló, mert egyszerre a teljes belsőt látja, és nem veszít 8–10 centi mélységet a sínekre. A felmérésen mindkét változatot végigvesszük az adott térre.",
  },
  {
    q: "Mennyibe kerül egy beépített gardrób?",
    a: "A méret, a front anyaga és a belső felszereltség dönti el. Ugyanaz a szekrényfal más árat ad bútorlap fronttal, mint matt vagy festett felülettel, és a fiókok, a nadrágtartó vagy a tükrös ajtó is külön tétel. A felmérés után tételes ajánlatot adunk, amiben látja, melyik elem mennyi — így van mit összehasonlítani.",
  },
  {
    q: "Ferde tetőtérbe is tudnak gardróbot gyártani?",
    a: "Igen, ez az egyik tipikus eset. A szekrény oldallapja a tetősík dőlését követi, a térdfal előtti alacsony rész pedig fiókkal vagy kihúzható kosárral használható. A felmérésen a szarufák dőlését és a belmagasságot több ponton felvesszük, mert a tetőtér ritkán szabályos.",
  },
  {
    q: "Bérelt lakásba érdemes beépített szekrényt csináltatni?",
    a: "A beépített bútor a helyiséghez készül, tehát bontás nélkül nem vihető át máshova. Ha a lakás nem az Öné, vagy néhány éven belül költözne, akkor inkább szabadon álló, méretre gyártott szekrényt javasolunk: az ugyanúgy kitölti a helyet, de arányosan elszállítható.",
  },
  {
    q: "A meglévő szekrényt elszállítják?",
    a: "A bontásról és az elszállításról a felmérésen egyeztetünk, hogy a beépítés napjára üres legyen a hely. Ha ezt Ön szervezi, az is rendben, csak előre tudnunk kell róla, mert a beépítés ütemezése ezen áll vagy bukik.",
  },
  {
    q: "Csak ajtókat kérhetünk egy meglévő falfülkére?",
    a: "Igen, előfordul, hogy a fülke oldala és hátfala jó, és csak front kell rá pántokkal. Ilyenkor is kimegyünk felmérni, mert a fülke oldalfalai szinte biztosan nem párhuzamosak, és a front csak mért adatokból fog hézagmentesen zárni.",
  },
]

export default function BeepitettGardrobBudapestPage() {
  const items = galleryFor("gardrob").filter((g) => g.src !== HERO.src)
  const phoneTel = `tel:${SURVEY_PHONE}`

  const serviceJsonLd = buildFurnitureServiceJsonLd({
    name: "Beépített gardrób és szekrény gyártás Budapesten",
    description:
      "Méretre gyártott beépített gardrób és szekrény Budapesten, Pest megyében, Bács-Kiskunban és a Balaton környékén: előszoba, hálószoba, ferde tetőtér és lépcső alatti tér. Díjmentes helyszíni felmérés, gyártás a kecskeméti üzemünkben.",
    path: PATH,
    serviceType: [
      "Beépített gardrób",
      "Beépített szekrény",
      "Gardróbszekrény gyártás",
      "Tolóajtós szekrény",
      "Előszoba bútor",
    ],
  })

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Főoldal", path: "/" },
    { name: "Egyedi bútorgyártás", path: CANONICAL_PATH },
    { name: "Beépített gardrób", path: PATH },
  ])

  return (
    <>
      <script
        id="ld-service-gardrob"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <script
        id="ld-breadcrumb-gardrob"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        id="ld-faq-gardrob"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildFurnitureFaqJsonLd(FAQ)),
        }}
      />

      <SpokeHero
        image={HERO}
        eyebrow="Beépített gardrób"
        title="Beépített gardrób oda, ahol nincs kész méret"
        lead="Előszoba, ferde tetőtér, lépcső alatti háromszög: pont azok a helyek, ahova bolti szekrény nem megy be."
        chips={[
          "Díjmentes helyszíni felmérés",
          "Mennyezetig építve",
          "Tolóajtós vagy nyíló",
        ]}
        phoneDisplay={SURVEY_PHONE_DISPLAY}
        phoneTel={phoneTel}
      />

      <SpokeSection>
        <h2 className={SPOKE_H2}>Nem a hely kevés, hanem a tároló</h2>
        <p className={SPOKE_LEAD}>
          Egy budapesti lakásban ritkán az alapterület a szűk keresztmetszet.
          Sokkal gyakrabban az, hogy a meglévő teret nem lehet kihasználni: a
          2,7 méteres belmagasságból egy bolti szekrény 2,1-et használ, a fölötte
          maradó sáv pedig porfogó lesz.
        </p>
        <p className={SPOKE_BODY}>
          A méretre gyártott szekrény a mennyezetig megy, a falhoz zár, és a
          szabálytalan sarkokat is befogja. A beugró, amihez nincs kapható méret,
          ugyanúgy tároló lesz, mint a lépcső alatti háromszög. Ugyanaz a
          négyzetméter, csak végre használható.
        </p>
        <p className={SPOKE_BODY}>
          Felmérni Budapesten, Pest megyében, Bács-Kiskunban és a Balaton
          környékén járunk, a gyártás a
          kecskeméti üzemünkben történik, a beépítést pedig a mi csapatunk
          végzi. Bútorlapot 1996 óta szabunk, tehát a lapszabászat és az élzárás
          nem külsős munka.
        </p>
      </SpokeSection>

      <SpokeSection tone="wash">
        <h2 className={SPOKE_H2}>Amit a felmérésen eldöntünk</h2>
        <p className={SPOKE_LEAD}>
          Egy gardrób akkor jó, ha reggel nem kell keresni benne semmit. Ehhez
          hat dolgot kell végigbeszélni.
        </p>
        <SpokePoints items={POINTS} />
      </SpokeSection>

      <SpokeSection>
        <h2 className={SPOKE_H2}>Hova szoktunk szekrényt építeni</h2>
        <p className={SPOKE_LEAD}>
          A gardrób nem csak a hálószoba ügye. Ezek a leggyakoribb helyek, és
          mindegyiknek más a logikája.
        </p>
        <SpokePoints items={PLACES} />
      </SpokeSection>

      <SpokeSection tone="wash">
        <h2 className={SPOKE_H2}>Anyagok és felületek</h2>
        <p className={SPOKE_LEAD}>
          A korpusz általában bútorlapból készül, a front pedig bútorlapból,
          fóliás, matt vagy festett felülettel, igény szerint tükörrel.
        </p>
        <p className={SPOKE_BODY}>
          A dekorokat a{" "}
          <Link href="/butorlap" className={SPOKE_LINK}>
            bútorlap katalógusunkban
          </Link>{" "}
          böngészheti, a különleges frontokat{" "}
          <Link href="/szolgaltatasok/nettfront" className={SPOKE_LINK}>
            NettFront partnerként
          </Link>{" "}
          hozzuk, a pántokat és a fiókrendszereket pedig{" "}
          <Link href="/barkacsaruhaz-kecskemet" className={SPOKE_LINK}>
            az áruházunk készletéből
          </Link>{" "}
          adjuk. Ha a bútort maga építené össze, a{" "}
          <Link
            href="/szolgaltatasok/lapszabaszat-es-elzaras"
            className={SPOKE_LINK}
          >
            méretre szabás és élzárás
          </Link>{" "}
          önmagában is megrendelhető nálunk.
        </p>
      </SpokeSection>

      <SpokeGallery
        items={items}
        heading="Gardróbok és beépített szekrények"
        phoneDisplay={SURVEY_PHONE_DISPLAY}
        phoneTel={phoneTel}
      />

      <SpokeFaq
        heading="Gardróbbal kapcsolatos kérdések"
        intro="Ezek jönnek elő szinte minden első telefonban."
        items={FAQ}
      />

      <SpokeSurvey
        heading="Mérjük fel a helyet"
        intro="A felmérés díjmentes, és nem kötelez semmire. Egy munkanapon belül hívjuk, és egyeztetünk egy időpontot."
        category="gardrob"
        email={COMPANY.emails.central}
        phoneDisplay={SURVEY_PHONE_DISPLAY}
        phoneTel={phoneTel}
      />

      <SpokeRelated current="gardrob" />
    </>
  )
}
