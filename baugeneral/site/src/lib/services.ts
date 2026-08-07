import { ORGANIZATION_ID, COMPANY } from "@/lib/company"
import type { ProjectCategory } from "@/lib/projects"
import {
  getActiveProjectBySlug,
  getPublishedActiveProjects,
} from "@/lib/projects"
import { REFERENCE_STOCK as S } from "@/lib/reference-stock-images"
import type { ReferenceType } from "@/lib/references"
import {
  getPublishedReferences,
  getReferenceBySlug,
} from "@/lib/references"
import type { RouteKey } from "@/lib/routes"
import { ROUTES } from "@/lib/routes"
import { absoluteUrl } from "@/lib/seo"

export type ServiceKey =
  | "ipari"
  | "tarshazak"
  | "csaladiHaz"
  | "kozepuletek"
  | "felujitas"
  | "szakagi"
  | "asztalos"

export type ServiceTakeaway = {
  label: string
  value: string
}

export type ServiceBuildingType = {
  title: string
  description: string
  image: string
  imageAlt: string
}

export type ServiceAudience = {
  title: string
  description: string
}

export type ServiceProcessStep = {
  title: string
  description: string
}

export type ServiceFaqItem = {
  id: string
  q: string
  a: string
  defaultOpen?: boolean
}

export type ServiceRelatedLink = {
  href: string
  label: string
}

export type ServiceLayoutVariant =
  | "default"
  | "proofEarly"
  | "reverseHero"
  | "typesGrid2x2"
  | "compactSingleCol"

export type ServiceSectionHeadings = {
  why: string
  buildingTypes: string
  audience: string
  scope: string
  scopeExcludedTitle: string
  process: string
  proof: string
  faq: string
  ctaTitle: string
  ctaBody: string
}

export type ServiceDefinition = {
  key: ServiceKey
  routeKey: RouteKey
  layoutVariant: ServiceLayoutVariant
  referenceType: ReferenceType
  projectCategory: ProjectCategory
  proofReferenceSlug?: string
  proofProjectSlug?: string
  hook: string
  tldr: string
  takeaways: readonly ServiceTakeaway[]
  whyParagraphs: readonly string[]
  audience: readonly ServiceAudience[]
  processSteps: readonly ServiceProcessStep[]
  headings: ServiceSectionHeadings
  buildingTypes: readonly ServiceBuildingType[]
  scopeItems: readonly string[]
  scopeExcluded: string
  faq: readonly ServiceFaqItem[]
  relatedLinks: readonly ServiceRelatedLink[]
  ctaImage: string
  ctaImageAlt: string
}

const INDUSTRIAL_SERVICE: ServiceDefinition = {
  key: "ipari",
  routeKey: "ipari",
  layoutVariant: "default",
  referenceType: "industrial",
  projectCategory: "industrial",
  proofReferenceSlug: "autoszalon-kecskemet",
  proofProjectSlug: "hyundai-szalon-kecskemet",
  hook:
    "Ipari épületnél a nyugalom onnan jön, hogy a határidő és a szakágak egy kézben maradnak. Egy építésvezetés, heti státusz, átlátható átadás.",
  tldr:
    "A BauGenerál Kft. csarnokot, autószalont, gyártóüzemet és kereskedelmi épületet kivitelez Bács-Kiskun és Pest megyében. Egy felelős csapat viszi a munkát az alapozástól az átadásig. Székhely: Kecskemét.",
  takeaways: [
    { label: "Hogyan", value: "Egy felelős csapat" },
    { label: "Terület", value: "Bács-Kiskun és Pest" },
    { label: "Kör", value: "Alapozástól átadásig" },
    { label: "Kapcsolat", value: "Heti státusz" },
  ],
  whyParagraphs: [
    "Ipari és kereskedelmi épületnél gyakran tíz szakma dolgozik párhuzamosan. Ha mindenki külön szerződéssel jön, az egyeztetés lassú, a felelősség megoszlik, és a nyitás dátuma könnyen csúszik.",
    "Generálkivitelezésnél mi tartjuk a szálakat: egy építésvezető, heti státusz, egy kapcsolattartó. Tudja, mi van a szerződésben, és mikor várható az átadás. A gépészet és a villany a szerkezettel együtt fut, nem utána összerakva.",
  ],
  audience: [
    {
      title: "Csarnok- vagy üzemtulajdonos",
      description:
        "Logisztikai, ipari vagy gyártóépületet épít, ahol a beköltözés és a technológia üteme számít. Egy partner kell a kivitelezéshez.",
    },
    {
      title: "Autószalon- és kereskedelmi fejlesztő",
      description:
        "Nyitási határidőre és egységes megjelenésre van szüksége. Nem tucatnyi alvállalkozót akar külön menedzselni.",
    },
    {
      title: "Márka, franchise, üzlethálózat",
      description:
        "Rögzített átadási ütem és követhető minőség kell. A kivitelezés ne térjen el az egyeztetett tervtől.",
    },
  ],
  processSteps: [
    {
      title: "Műszaki keret és határidő",
      description:
        "Átbeszéljük a helyszínt, a méretet, a funkciót és a cél nyitást. Amit vállalunk, azt írásban rögzítjük.",
    },
    {
      title: "Szerkezet és szakágak egy ütemben",
      description:
        "Alapozás, szerkezet, majd gépészet és villany. A sorrend azért számít, hogy ne legyen hosszú állásidő a szakágak között.",
    },
    {
      title: "Átadás a nyitáshoz igazítva",
      description:
        "Homlokzat, belső munkák, dokumentált átadás. A cél, hogy a technológia vagy a kereskedelmi nyitás időben tudjon indulni.",
    },
  ],
  headings: {
    why: "Miért számít, ki építi az ipari épületet?",
    buildingTypes: "Milyen ipari és kereskedelmi épületeket vállalunk",
    audience: "Kinek ajánljuk",
    scope: "Mit vállalunk a kivitelezésben",
    scopeExcludedTitle: "Mit nem vállalunk",
    process: "Hogyan épül fel az ipari kivitelezés?",
    proof: "Befejezett és futó ipari munkáink",
    faq: "Gyakori kérdések ipari építés előtt",
    ctaTitle: "Csarnokot, autószalont vagy üzemet tervez?",
    ctaBody:
      "Írja meg a helyszínt, a méretet vagy a funkciót, és a terv állapotát. Hamarosan emailben jelentkezünk.",
  },
  buildingTypes: [
    {
      title: "Csarnok és raktár",
      description:
        "Logisztikai és ipari csarnokok. Szerkezet, burkolat, átadás egy kézben, a beköltözés üteméhez igazítva.",
      image: S.ipariNav,
      imageAlt: "Ipari csarnok és raktár",
    },
    {
      title: "Autószalon és kereskedelmi épület",
      description:
        "Kereskedelmi és márkaépületek, ahol a megjelenés és a nyitás dátuma egyaránt számít. Példa: 1850 m², Kecskemét.",
      image: S.ipariHero,
      imageAlt: "Autószalon és kereskedelmi épület",
    },
    {
      title: "Gyártóüzem",
      description:
        "Gyártócsarnokok és üzemi terek. Az ütemezés úgy épül, hogy a technológia időben be tudjon költözni.",
      image: S.munka,
      imageAlt: "Gyártóüzem kivitelezés",
    },
    {
      title: "Összetett, több szakmás épület",
      description:
        "Gépészet, villamos és szerkezet egy ütemben. Kisebb kereskedelmi és szolgáltató egységek is beleférnek.",
      image: S.kozepulet,
      imageAlt: "Összetett ipari és kereskedelmi épület",
    },
  ],
  scopeItems: [
    "Földmunka, alapozás, szerkezet",
    "Homlokzat, tető, burkolatok",
    "Gépészet és villamos előkészítés szervezése",
    "Belső munkák és az épület átadása",
    "Heti egyeztetés az építésvezetővel",
    "Egy kapcsolattartó a teljes projekt alatt",
    "Helyszíni minőség-ellenőrzés, dokumentálva",
    "Átadási ütem a szerződés szerint",
  ],
  scopeExcluded:
    "Tervezést, hatósági engedélyezést és berendezés-beszerzést nem vállalunk. Ha kell, egyeztetjük, de csak akkor, ha a szerződésben így szerepel.",
  faq: [
    {
      id: "risk",
      q: "Mi a legnagyobb kockázat ipari vagy kereskedelmi építésnél?",
      a: "Gyakran nem az ár, hanem a határidő: sok szakma dolgozik egymás mellett, és ha nincs központi vezetés, csúszik a nyitás. Nálunk egy csapat felel a munkáért, heti státusszal.",
      defaultOpen: true,
    },
    {
      id: "scope",
      q: "Mi tartozik a generálkivitelezéshez?",
      a: "Az alapozástól az átadásig: szerkezet, homlokzat, burkolatok, gépészet és villamos előkészítés szervezése. A pontos listát az ajánlatban és a szerződésben írjuk le.",
      defaultOpen: true,
    },
    {
      id: "types",
      q: "Milyen ipari épületeket vállalnak?",
      a: "Csarnokot, raktárt, autószalont, gyártóüzemet, kereskedelmi és összetett több szakmás épületet. Bács-Kiskun és Pest megyében, valamint a Balaton környékén.",
    },
    {
      id: "progress",
      q: "Hogyan követhetem a kivitelezést?",
      a: "Egy kapcsolattartó van a projekt alatt, heti egyeztetéssel. A műszaki tartalom és a lényeges változások írásban mennek. Így nem kell több szakma között magának egyeztetnie.",
    },
    {
      id: "area",
      q: "Vállalnak ipari épületet Pest megyében is?",
      a: "Igen. Bács-Kiskun megyében (Kecskemét és környéke), Pest megyében (beleértve a budai agglomerációt) és a Balaton környékén. A székhelyünk Kecskeméten van.",
    },
    {
      id: "contract",
      q: "Mire figyeljek ajánlatnál és szerződésnél?",
      a: "Érdemes tételes műszaki tartalmat, ütemet és fizetési szakaszokat kérni, ne csak egy végösszeget. Jó, ha világos, mi tartozik bele, és mi számít pótmunkának. Nálunk a vállalt kör írásban szerepel.",
    },
    {
      id: "price",
      q: "Van publikus ár vagy négyzetméterár?",
      a: "Nincs. Az árat a helyszín, a méret, a funkció és a műszaki tartalom alapján adjuk meg, írásban. Ha leírja a projektet, segítünk tisztázni, mire érdemes számítani.",
    },
  ],
  relatedLinks: [
    { href: "/referenciak", label: "Referenciák" },
    { href: "/futo-projektek", label: "Futó projektek" },
    { href: "/generalkivitelezes-pest-megye", label: "Pest megye" },
    { href: "/kapcsolat", label: "Kapcsolat" },
  ],
  ctaImage: S.ipariHero,
  ctaImageAlt: "Ipari és kereskedelmi épület, BauGenerál",
}

const TARSHAZAK_SERVICE: ServiceDefinition = {
  key: "tarshazak",
  routeKey: "tarshazak",
  layoutVariant: "proofEarly",
  referenceType: "condo",
  projectCategory: "condo",
  proofReferenceSlug: "tarshaz-lakopark",
  hook:
    "Társasháznál és lakóparknál a nyugalom onnan jön, hogy az ütem egy kézben marad. Több épületrész, több szakma, egy felelős csapat.",
  tldr:
    "A BauGenerál Kft. társasházakat és lakóparkokat kivitelez Bács-Kiskun és Pest megyében. Befektetőknek és megrendelőknek dolgozunk: szerkezettől a dokumentált átadásig, központi építésvezetéssel.",
  takeaways: [
    { label: "Kinek", value: "Fejlesztő, megrendelő" },
    { label: "Projekt", value: "Társasház, lakópark" },
    { label: "Átadás", value: "Dokumentált, ütemezett" },
    { label: "Terület", value: "Bács-Kiskun és Pest" },
  ],
  whyParagraphs: [
    "Társasháznál több szakma és több épületrész halad párhuzamosan. Ha az ütemezés szétesik, a csúszás nem egy ponton marad, hanem végigmegy az egész projekten: lakások, közös terek, szakági csatlakozások egyszerre szenvednek.",
    "Generálkivitelezőként egy helyen fogjuk össze a szerkezetet, a szakágakat és az átadási ütemet. Heti státusz, egy kapcsolattartó. A cél: kiszámítható haladás és dokumentált átadás, nem tucatnyi külön szerződés közötti egyeztetés.",
  ],
  audience: [
    {
      title: "Lakópark-fejlesztő",
      description:
        "Több épületrészes projektet visz. Fontos, hogy a párhuzamos szakágak és az átadási fázisok egy ütemben maradjanak.",
    },
    {
      title: "Társasház-megrendelő",
      description:
        "Egy partnerrel akar szerződni. Átlátható felelősség, heti visszajelzés, dokumentált lakás- és közös tér átadás.",
    },
    {
      title: "Pest vagy Bács-Kiskun beruházó",
      description:
        "Agglomerációs vagy megyei helyszínen épít (például budai agglomeráció vagy Kecskemét környéke). A kivitelezésnek követhetőnek kell lennie.",
    },
  ],
  processSteps: [
    {
      title: "Projektkeret és műszaki tartalom",
      description:
        "Átbeszéljük az épületszámot, a lakásszámot, a határidőt és a műszaki kört. Amit vállalunk, azt írásban rögzítjük.",
    },
    {
      title: "Párhuzamos szerkezet és szakágak",
      description:
        "Központi építésvezetés mellett fut a szerkezet, a gépészet és a villany. A sorrend azért számít, hogy a csúszás ne fusson végig a projekten.",
    },
    {
      title: "Dokumentált lakás- és közös tér átadás",
      description:
        "A lakások és a közös terek átadása a szerződés szerinti ütemben, írásos szakági zárásokkal.",
    },
  ],
  headings: {
    why: "Miért számít, ki viszi a társasház kivitelezését?",
    buildingTypes: "Milyen projekteket vállalunk",
    audience: "Kinek ajánljuk",
    scope: "Mit vállalunk a kivitelezésben",
    scopeExcludedTitle: "Mit nem vállalunk",
    process: "Hogyan épül fel a társasház-kivitelezés?",
    proof: "Befejezett és futó társasházprojektjeink",
    faq: "Gyakori kérdések társasházépítés előtt",
    ctaTitle: "Társasház- vagy lakóparkprojektet tervez?",
    ctaBody:
      "Írja meg a helyszínt, a lakásszámot vagy épületszámot, és a terv állapotát. Hamarosan emailben jelentkezünk.",
  },
  buildingTypes: [
    {
      title: "Társasház",
      description:
        "Többlakásos épület teljes körű kivitelezése. Szerkezettől a lakások és közös terek átadásáig, egy felelős csapattal.",
      image: S.munka,
      imageAlt: "Társasház kivitelezés",
    },
    {
      title: "Lakópark",
      description:
        "Több épületrészes lakóprojekt összehangolt szakági ütemezéssel. A párhuzamos munkák egy központi vezetés alatt futnak.",
      image: S.telephely,
      imageAlt: "Lakópark kivitelezés",
    },
    {
      title: "Ütemezett lakásátadás",
      description:
        "Lakások, közös terek, lépcsőházak és kiszolgáló részek dokumentált, egymásra épülő átadással.",
      image: S.kozepulet,
      imageAlt: "Társasház közös terek és átadás",
    },
  ],
  scopeItems: [
    "Alapozás, szerkezet és szerkezetlezárás",
    "Homlokzat, tető és közös terek kialakítása",
    "Gépészeti és villamos szakágak szervezése",
    "Lakások és közlekedők ütemezett kivitelezése",
    "Heti státusz, egy kapcsolattartó",
    "Szakági átadások írásos rögzítése",
    "Központi építésvezetés a teljes projekt alatt",
    "Átadás a megbeszélt ütem szerint",
  ],
  scopeExcluded:
    "Tervezést, hatósági engedélyezést és értékesítést nem vállalunk. A kivitelezést meglévő terv és rögzített műszaki tartalom alapján visszük.",
  faq: [
    {
      id: "risk",
      q: "Mi a legnagyobb kockázat társasház- vagy lakóparképítésnél?",
      a: "Az, ha a párhuzamos szakmák és épületrészek ütemezése szétesik. Ilyenkor egy csúszás gyorsan végigfut a lakásokon, a közös tereken és a szakági csatlakozásokon. Nálunk ezért egy központi építésvezetés tartja az ütemet.",
      defaultOpen: true,
    },
    {
      id: "investor",
      q: "Kiknek dolgoznak társasházprojektnél?",
      a: "Elsősorban fejlesztőknek, befektetőknek és megrendelőknek. Olyan projektekhez, ahol fontos a kiszámítható ütem, az átlátható felelősség és a dokumentált átadás.",
      defaultOpen: true,
    },
    {
      id: "scope",
      q: "Mi tartozik a generálkivitelezéshez?",
      a: "A szerkezettől az átadásig: alapozás, szerkezet, homlokzat, közös terek, szakági szervezés, lakások ütemezett kivitelezése. A pontos műszaki tartalom a szerződésben szerepel.",
    },
    {
      id: "handover",
      q: "Hogyan zajlik a lakások és a közös terek átadása?",
      a: "A lakások és a közös terek átadása a szerződés szerinti ütemben történik. A szakági zárásokat írásban rögzítjük, mielőtt a következő fázis indul. Így a megrendelő egy helyről követi a projektállapotot.",
    },
    {
      id: "area",
      q: "Vállalnak társasházat Pest megyében is, például a budai agglomerációban?",
      a: "Igen. Bács-Kiskun megyében (Kecskemét és környéke), Pest megyében (beleértve a budai agglomerációt: Üröm, Solymár, Pilisvörösvár, Budakalász, Nagykovácsi térsége) és a Balaton környékén. A székhelyünk Kecskeméten van.",
    },
    {
      id: "contract",
      q: "Mire figyeljek ajánlatnál és szerződésnél?",
      a: "Érdemes tételes műszaki tartalmat, ütemet és fizetési szakaszokat kérni, ne csak egy végösszeget. Jó, ha világos, mi tartozik bele, és mi számít pótmunkának. Nálunk a vállalt kör írásban szerepel.",
    },
    {
      id: "price",
      q: "Van publikus ár vagy négyzetméterár?",
      a: "Nincs. A társasházprojektek ára a műszaki tartalom, a méret, az épületszám és az ütemezés alapján adható meg. Ha leírja a projektet, segítünk tisztázni, mire érdemes számítani.",
    },
  ],
  relatedLinks: [
    { href: "/referenciak", label: "Referenciák" },
    { href: "/futo-projektek", label: "Futó projektek" },
    { href: "/generalkivitelezes-pest-megye", label: "Pest megye" },
    { href: "/kapcsolat", label: "Kapcsolat" },
  ],
  ctaImage: S.munka,
  ctaImageAlt: "Társasház kivitelezés, BauGenerál",
}

const CSALADI_HAZ_SERVICE: ServiceDefinition = {
  key: "csaladiHaz",
  routeKey: "csaladiHaz",
  layoutVariant: "reverseHero",
  referenceType: "family",
  projectCategory: "family",
  proofReferenceSlug: "csaladi-haz-bacs-kiskun",
  proofProjectSlug: "ikerhaz-sajat-kecskemet",
  hook:
    "Családi háznál a nyugalom onnan jön, hogy egy felelős csapat viszi a kivitelezést. Nem tucatnyi szakma között kell egyeztetnie.",
  tldr:
    "A BauGenerál Kft. egyedi családi házakat kivitelez Bács-Kiskun és Pest megyében, meglévő terv alapján. A szerkezettől a befejezésig egy kézben tartjuk a munkát. Igény szerint bútorozással záruló, beköltözhető állapotig, a Hírös-Ablak beépített bútorával.",
  takeaways: [
    { label: "Kiindulás", value: "Meglévő terv alapján" },
    { label: "Átadás", value: "Beköltözhető állapotig" },
    { label: "Kapcsolat", value: "Egy felelős csapat" },
    { label: "Terület", value: "Bács-Kiskun és Pest" },
  ],
  whyParagraphs: [
    "Egy családi ház építése során folyamatosan jönnek a döntések: anyag, szakági sorrend, részletek. Ha nincs, aki ezeket összefogja, nő a bizonytalanság, és gyakran újra kell nyitni azt, ami már kész volt.",
    "Mi meglévő terv alapján dolgozunk. Egy kapcsolattartón keresztül követheti a munkát, heti egyeztetéssel. A cél nem a félkész átadás, hanem egy átlátható, dokumentált kivitelezés, amely a megbeszélt tartalom szerint zárul. Ha beépített bútor is kell, azt a kecskeméti Hírös-Ablak üzemben készítjük, és a ház üteméhez igazítjuk.",
  ],
  audience: [
    {
      title: "Minőségi otthont építő család",
      description:
        "Saját házat épít, és nem akar tizenkét alvállalkozót külön szervezni. Egy partner kell, aki végigviszi a kivitelezést.",
    },
    {
      title: "Agglomerációs vagy megyei telektulajdonos",
      description:
        "Pest megyében (például Üröm, Solymár és környéke) vagy Bács-Kiskunban van telke és terve. Fontos a kiszámítható ütem és a tiszta felelősség.",
    },
    {
      title: "Beköltözhető átadást váró megrendelő",
      description:
        "Nem félkész házat szeretne. A befejezés, és ha kell, a beépített bútor is legyen egyeztetett ütemben.",
    },
  ],
  processSteps: [
    {
      title: "Terv és műszaki tartalom",
      description:
        "Átnézzük a meglévő tervet, és tisztázzuk, milyen állapotig visszük a házat. Amit vállalunk, azt írásban rögzítjük.",
    },
    {
      title: "Szerkezet és szakágak sorrendje",
      description:
        "Alapozás, szerkezet, majd gépészet és villany. A sorrend azért számít, hogy ne kelljen később visszabontani.",
    },
    {
      title: "Befejezés és átadás",
      description:
        "Nyílászárók, burkolatok, befejező munkák. Igény szerint beépített bútor. Átadás a szerződés szerinti készültséggel.",
    },
  ],
  headings: {
    why: "Miért számít, ki építi a családi házat?",
    buildingTypes: "Milyen családi házakat vállalunk",
    audience: "Kinek ajánljuk",
    scope: "Mit vállalunk a kivitelezésben",
    scopeExcludedTitle: "Mit nem vállalunk",
    process: "Hogyan épül fel a kivitelezés?",
    proof: "Befejezett és futó családi házprojektjeink",
    faq: "Gyakori kérdések családi ház építés előtt",
    ctaTitle: "Családi házat tervez Bács-Kiskun vagy Pest megyében?",
    ctaBody:
      "Írja meg a telek helyszínét és a terv állapotát. Hamarosan emailben jelentkezünk.",
  },
  buildingTypes: [
    {
      title: "Egyszintes családi ház",
      description:
        "Egyedi, egyszintes ház meglévő terv alapján. Szerkezettől a befejezésig, egy felelős csapattal.",
      image: S.csaladi,
      imageAlt: "Egyszintes családi ház",
    },
    {
      title: "Emeletes családi ház",
      description:
        "Többszintes lakóház összehangolt szakágakkal. A sorrend és a minőség végig követhető.",
      image: S.kapcsolatHero,
      imageAlt: "Emeletes családi ház",
    },
    {
      title: "Kulcsrakész, bútorozással",
      description:
        "Beköltözhető állapotig. A beépített bútor a Hírös-Ablak üzemben készülhet, a ház üteméhez igazítva.",
      image: "/img/asztalos/portfolio/kitchen-island-wide.jpg",
      imageAlt: "Beköltözhető családi ház, beépített konyhával",
    },
  ],
  scopeItems: [
    "Meglévő terv alapján induló kivitelezés",
    "Alapozás, szerkezet és szerkezetlezárás",
    "Nyílászárók, burkolatok és befejező munkák",
    "Gépészeti és villamos szakágak szervezése",
    "Heti egyeztetés, egy kapcsolattartó",
    "Dokumentált műszaki átadás",
    "Igény szerint bútorozással záruló állapot",
    "Beépített bútor a Hírös-Ablak partnerrel",
  ],
  scopeExcluded:
    "Tervezést és hatósági engedélyezést nem vállalunk. A kivitelezést meglévő, egyeztetett terv és műszaki tartalom alapján visszük.",
  faq: [
    {
      id: "plan",
      q: "Csak meglévő terv alapján dolgoznak?",
      a: "Igen. Családi háznál kivitelezést vállalunk, tervezést nem. A munka meglévő, egyeztetett terv alapján indul. Ha még nincs kész a terv, az első beszélgetésen megmondjuk, mi kell a következő lépéshez.",
      defaultOpen: true,
    },
    {
      id: "turnkey",
      q: "Mit jelent a kulcsrakész, bútorozással záruló átadás?",
      a: "Nem félkész szerkezetet adunk át. A ház a szerződésben rögzített befejező tartalomig készül. Ha beépített bútor is kell, azt a Hírös-Ablak kecskeméti üzemben gyártjuk, és a kivitelezés üteméhez igazítjuk. Részletek az asztalos munkák oldalon.",
      defaultOpen: true,
    },
    {
      id: "duration",
      q: "Mennyi ideig tart egy családi ház kivitelezése?",
      a: "Mérettől, műszaki tartalomtól és a helyszín adottságaitól függ. Egy egyszerűbb ház más ütem, mint egy összetett, több szakmás épület. Általános „X hónap” ígéretet a weben nem teszünk. Amit vállalunk, azt az ajánlatban és a szerződésben rögzítjük.",
    },
    {
      id: "quality",
      q: "Hogyan látom a haladást, és ki felel a minőségért?",
      a: "Egy kapcsolattartó van a projekt alatt, heti egyeztetéssel. A műszaki tartalom és a változások írásban mennek. A lényeges módosításokat csak jóváhagyás után visszük tovább. Így nem kell több szakma között magának egyeztetnie.",
    },
    {
      id: "area",
      q: "Vállalnak családi házat Pest megyében is, például Ürömön vagy Solymáron?",
      a: "Igen. Bács-Kiskun megyében (Kecskemét és környéke), Pest megyében (beleértve a budai agglomerációt: Üröm, Solymár, Pilisvörösvár, Budakalász, Nagykovácsi térsége) és a Balaton környékén. A székhelyünk Kecskeméten van.",
    },
    {
      id: "contract",
      q: "Mire figyeljek ajánlatnál és szerződésnél?",
      a: "Érdemes tételes műszaki tartalmat, ütemet és fizetési szakaszokat kérni, ne csak egy végösszeget. Jó, ha világos, mi tartozik bele, és mi számít pótmunkának. Nálunk a vállalt kör írásban szerepel.",
    },
    {
      id: "price",
      q: "Van publikus ár vagy négyzetméterár?",
      a: "Nincs. A családi ház ára a terv, a műszaki tartalom, az anyagok és a helyszín alapján adható meg. Ha leírja a projektet, segítünk tisztázni, mire érdemes számítani.",
    },
  ],
  relatedLinks: [
    { href: "/szolgaltatasok/asztalos-munkak", label: "Asztalos munkák" },
    { href: "/generalkivitelezes-pest-megye", label: "Pest megye" },
    { href: "/kapcsolat", label: "Kapcsolat" },
  ],
  ctaImage: S.csaladi,
  ctaImageAlt: "Családi ház kivitelezés, BauGenerál",
}

const KOZEPULETEK_SERVICE: ServiceDefinition = {
  key: "kozepuletek",
  routeKey: "kozepuletek",
  layoutVariant: "typesGrid2x2",
  referenceType: "public",
  projectCategory: "public",
  proofReferenceSlug: "kozepulet-ovoda",
  hook:
    "Középületnél nem elég, hogy kész legyen. Az átadásnak dokumentáltnak és ellenőrizhetőnek is kell lennie.",
  tldr:
    "A BauGenerál Kft. középületeket kivitelez Bács-Kiskun és Pest megyében. Óvoda, bölcsőde, hivatal és más intézményi épület esetén is teljes körű generálkivitelezést vállalunk.",
  takeaways: [
    { label: "Fókusz", value: "Intézményi kivitelezés" },
    { label: "Mit adunk", value: "Dokumentált átadás" },
    { label: "Tapasztalat", value: "Közbeszerzési projektek" },
    { label: "Terület", value: "Bács-Kiskun és Pest" },
  ],
  whyParagraphs: [
    "Középületnél az ütemezés mellett a dokumentáltság is alapkövetelmény. Az átadásnak ellenőrizhetőnek kell lennie, és a kivitelezés közben is nyomon követhető döntésekre van szükség.",
    "A BauGenerál közbeszerzési kivitelezésben szerzett tapasztalattal dolgozik. A cél nem a hangos marketing, hanem az, hogy a munka és az átadás is rendben legyen.",
  ],
  audience: [
    {
      title: "Önkormányzat",
      description:
        "Olyan kivitelezőre van szükség, aki dokumentáltan, átláthatóan és kiszámítható ütemben dolgozik.",
    },
    {
      title: "Intézményfenntartó",
      description:
        "Bölcsőde, óvoda, hivatal vagy más középület kivitelezése esetén fontos a rendezett átadás és a szakági fegyelem.",
    },
    {
      title: "Fejlesztő",
      description:
        "Közfunkciót ellátó épületnél is egyetlen partner kell, aki összefogja a kivitelezést.",
    },
  ],
  processSteps: [
    {
      title: "Megkeresés",
      description: "Alapadatok és műszaki anyagok áttekintése.",
    },
    {
      title: "Egyeztetés",
      description: "Feladat, határidő, műszaki tartalom és átadási elvárások pontosítása.",
    },
    {
      title: "Ajánlat és szerződés",
      description: "A kivitelezési kör és a dokumentálási rend írásban rögzül.",
    },
    {
      title: "Kivitelezés",
      description: "Központi építésvezetés, szakági koordináció, nyomon követhető státuszok.",
    },
    {
      title: "Átadás",
      description: "Dokumentált átadás a megbeszélt műszaki tartalom szerint.",
    },
  ],
  headings: {
    why: "Miért fontos a dokumentált kivitelezés középületnél?",
    buildingTypes: "Milyen középületeket vállalunk",
    audience: "Kinek ajánljuk",
    scope: "Mit vállalunk a kivitelezésben",
    scopeExcludedTitle: "Mit nem vállalunk",
    process: "Hogyan zajlik a munka",
    proof: "Befejezett és futó középület-projektjeink",
    faq: "Gyakori kérdések",
    ctaTitle: "Középület kivitelezése előtt áll?",
    ctaBody: "Írjon nekünk. Hamarosan emailben jelentkezünk.",
  },
  buildingTypes: [
    {
      title: "Óvoda és bölcsőde",
      description: "Gyermekintézmények kivitelezése, rendezett átadási folyamattal.",
      image: S.kozepulet,
      imageAlt: "Óvoda vagy bölcsőde, helyőrző fotó",
    },
    {
      title: "Oktatási épület",
      description: "Iskolai vagy oktatási funkciójú épületek kivitelezése meglévő terv alapján.",
      image: S.munka,
      imageAlt: "Oktatási épület, helyőrző fotó",
    },
    {
      title: "Hivatal és közintézmény",
      description: "Ügyfélforgalmat kiszolgáló intézményi épületek és közösségi terek.",
      image: S.telephely,
      imageAlt: "Hivatal vagy közintézmény, helyőrző fotó",
    },
    {
      title: "Egyéb közfunkciós épület",
      description: "Olyan projektek, ahol a kivitelezés mellett az átadás rendje is kulcsfontosságú.",
      image: S.ipariNav,
      imageAlt: "Közfunkciós épület, helyőrző fotó",
    },
  ],
  scopeItems: [
    "Szerkezet, homlokzat és tető kivitelezése",
    "Szakági munkák szervezése és összehangolása",
    "Belső terek és közös használatú részek kivitelezése",
    "Központi építésvezetés a projekt alatt",
    "Állapotkövetés és dokumentált műszaki átadás",
    "Közbeszerzési kivitelezésben szerzett tapasztalat",
  ],
  scopeExcluded:
    "Tervezést nem vállalunk. A kivitelezés meglévő terv és rögzített műszaki tartalom alapján történik.",
  faq: [
    {
      id: "public",
      q: "Milyen középületeket vállal a BauGenerál?",
      a: "Óvodát, bölcsődét, hivatalt és más közfunkciós épületet is kivitelezünk, meglévő terv alapján.",
      defaultOpen: true,
    },
    {
      id: "procurement",
      q: "Van közbeszerzési kivitelezési tapasztalatuk?",
      a: "Igen. Közbeszerzési kivitelezésben szerzett tapasztalattal dolgozunk, és a dokumentált átadást fontos részének tekintjük a munkának.",
      defaultOpen: true,
    },
    {
      id: "handover",
      q: "Mit jelent a dokumentált átadás?",
      a: "A kivitelezés lezárása nem csak fizikai készültséget jelent, hanem átlátható, rögzített átadási folyamatot is.",
    },
    {
      id: "scope",
      q: "Mi tartozik bele a generálkivitelezésbe?",
      a: "A szerkezettől a szakági szervezésen át a belső terekig visszük a munkát, a szerződésben rögzített kör szerint.",
    },
    {
      id: "area",
      q: "Milyen területen vállalnak középületet?",
      a: "Bács-Kiskun megyében (Kecskemét és környéke), Pest megyében (beleértve a budai agglomerációt) és a Balaton környékén. A székhelyünk Kecskeméten van.",
    },
    {
      id: "price",
      q: "Van publikus ár a honlapon?",
      a: "Nincs. A középületi projektek ára a műszaki tartalom és az ütemezés alapján adható meg.",
    },
  ],
  relatedLinks: [
    { href: "/referenciak", label: "Referenciák" },
    { href: "/generalkivitelezes-pest-megye", label: "Pest megye" },
  ],
  ctaImage: S.telephelyPng,
  ctaImageAlt: "BauGenerál Kft. telephely, Kecskemét",
}

const FELUJITAS_SERVICE: ServiceDefinition = {
  key: "felujitas",
  routeKey: "felujitas",
  layoutVariant: "compactSingleCol",
  referenceType: "renovation",
  projectCategory: "renovation",
  proofReferenceSlug: "felujitas-lakas",
  proofProjectSlug: "zwack-rendezvenyhaz-kecskemet",
  hook:
    "Felújításnál a legtöbb gond nem a burkolatnál kezdődik. Hanem ott, amikor nincs sorrend a szakmák között.",
  tldr:
    "A BauGenerál Kft. teljes lakás- és házfelújítást vállal Kecskeméten, Bács-Kiskun és Pest megyében, valamint a Balaton környékén. A bontástól a befejező munkákig egy kézben tartjuk a szakágakat, hogy ne kelljen minden mestert külön szervezni.",
  takeaways: [
    { label: "Fő fókusz", value: "Teljes lakás- és házfelújítás" },
    { label: "Kiegészítés", value: "Hozzáépítés, korszerűsítés" },
    { label: "Szervezés", value: "Szakágak összehangolva" },
    { label: "Terület", value: "Bács-Kiskun, Pest, Balaton" },
  ],
  whyParagraphs: [
    "Felújításnál sokszor nem maga a feladat a nehéz, hanem a sorrend. Ha a bontás, a gépészet, a villany és a befejezés nincs összehangolva, nő az állásidő, és gyakran újra kell bontani azt, ami már kész volt.",
    "Teljes lakás- vagy házfelújításnál mi fogjuk össze a munkát. A helyszíni sorrendet előre rögzítjük, a szakágak egymásra épülnek. Itt a felújítás helyszíni logikájára koncentrálunk: mi után mi jön, és miért számít.",
  ],
  audience: [
    {
      title: "Lakástulajdonos",
      description:
        "Teljes lakásfelújítást tervez, és szeretné, ha a bontás, a szakági munka és a befejezés egy kézben maradna.",
    },
    {
      title: "Háztulajdonos",
      description:
        "Családi ház korszerűsítését vagy teljes felújítását tervezi, kiszámítható kivitelezéssel.",
    },
    {
      title: "Befektető",
      description:
        "Egy ingatlant felújítás után használatba vagy piacra akar hozni, átlátható ütemmel.",
    },
  ],
  processSteps: [
    {
      title: "Bontás és előkészítés",
      description:
        "Ami nem marad, azt tiszta sorrendben bontjuk. Így a következő szakágak nem a törmelék között dolgoznak.",
    },
    {
      title: "Szerkezet és átalakítás",
      description:
        "Faláttörések, javítások, ahol kell, a helyiséglogika átrendezése. Ehhez igazítjuk a későbbi gépészetet és villanyt.",
    },
    {
      title: "Gépészet és villamos munka",
      description:
        "Víz, fűtés, villany a burkolat előtt. Ha ez a sorrend felborul, gyakran újra kell nyitni a már kész felületeket.",
    },
    {
      title: "Burkolatok és befejezés",
      description:
        "Padló, falburkolat, festés, befejező részletek. Akkor indul, amikor a szakágak már a helyükön vannak.",
    },
    {
      title: "Átadás a rögzített tartalom szerint",
      description:
        "A készültséget a szerződésben leírt műszaki tartalomhoz mérjük. Amit vállaltunk, azt átadjuk.",
    },
  ],
  headings: {
    why: "Miért fontos a sorrend teljes felújításnál?",
    buildingTypes: "Milyen felújításokat vállalunk",
    audience: "Kinek ajánljuk",
    scope: "Mit vállalunk a kivitelezésben",
    scopeExcludedTitle: "Mit nem vállalunk",
    process: "Milyen sorrendben érdemes felújítani?",
    proof: "Befejezett és futó felújítási munkáink",
    faq: "Gyakori kérdések felújítás előtt",
    ctaTitle: "Lakás- vagy házfelújítást tervez?",
    ctaBody:
      "Írja meg, milyen állapotban van az ingatlan, és miben gondolkodik. Hamarosan emailben jelentkezünk.",
  },
  buildingTypes: [
    {
      title: "Teljes lakásfelújítás",
      description: "Bontástól a befejező munkákig, egy összehangolt kivitelezési sorban.",
      image: S.felujitas,
      imageAlt: "Teljes lakásfelújítás",
    },
    {
      title: "Teljes házfelújítás",
      description: "Belső és külső munkák egységes kivitelezéssel, rögzített ütemezéssel.",
      image: S.csaladi,
      imageAlt: "Teljes házfelújítás",
    },
    {
      title: "Hozzáépítés és átalakítás",
      description: "A meglévő épülethez igazított szerkezeti és belső átalakítások.",
      image: S.munka,
      imageAlt: "Hozzáépítés vagy átalakítás",
    },
    {
      title: "Korszerűsítés",
      description:
        "Energetikai és műszaki fejlesztések (például szigetelés, nyílászáró, fűtés) a felújítás részeként vagy önállóan.",
      image: S.telephely,
      imageAlt: "Energetikai korszerűsítés",
    },
  ],
  scopeItems: [
    "Bontási és szerkezeti előkészítés",
    "Faláttörések, átalakítások és javítások",
    "Gépészeti és villamos szakágak szervezése",
    "Burkolatok, festés és befejező munkák",
    "Teljes lakás- és házfelújítás egy ütemben",
    "Hozzáépítés és korszerűsítés igény szerint",
  ],
  scopeExcluded:
    "Tervezést és hatósági engedélyezést nem vállalunk. A felújítás meglévő terv vagy egyeztetett műszaki tartalom alapján indul.",
  faq: [
    {
      id: "cost",
      q: "Mennyibe kerül egy lakás- vagy házfelújítás?",
      a: "Nincs egyetlen négyzetméterár a weben, mert a költség az állapottól, a bontás mértékétől, a gépészet és villany cseréjétől, a burkolatoktól és a befejezés színvonalától függ. Ami számít: tételes, írásos ajánlat a műszaki tartalommal. Ha leírja, milyen ingatlanról van szó, segítünk tisztázni, mire érdemes számítani.",
      defaultOpen: true,
    },
    {
      id: "duration",
      q: "Mennyi ideig tart egy teljes felújítás?",
      a: "Mérettől, tartalomtól és attól függ, mennyire járható a helyszín. Egy kisebb lakás más ütem, mint egy teljes ház gépészettel. Általános „X hét” ígéretet nem teszünk a weben. Amit vállalunk, azt az ajánlatban és a szerződésben rögzítjük.",
    },
    {
      id: "general-vs-diy",
      q: "Generálkivitelező kell, vagy érdemes saját magam szervezni a szakmákat?",
      a: "Ha csak egy szakág hiányzik, gyakran elég egy önálló szakági megbízás. Ha bontás, szerkezet, gépészet, villany és befejezés is jön, a saját szervezés sok egyeztetést és felelősségi határt jelent. Ilyenkor egy kézben tartott kivitelezés nyugodtabb. Nem minden projekthez kell generál; az első beszélgetés célja éppen ennek a tisztázása.",
    },
    {
      id: "order",
      q: "Milyen sorrendben mennek a munkák a helyszínen?",
      a: "Ésszerű sorrend: bontás és előkészítés, szerkezeti átalakítás, gépészet és villany, majd burkolat és befejezés. Ha ez felborul, gyakran újra kell bontani. A pontos sorrendet a projekt műszaki tartalmához igazítjuk.",
      defaultOpen: true,
    },
    {
      id: "living",
      q: "Lakhatunk a lakásban vagy a házban a felújítás idején?",
      a: "Nem minden esetben. Részleges felújításnál néha megoldható. Teljes bontásnál, gépészet- vagy villanycserénél gyakran praktikusabb a kiköltözés. Őszintén megmondjuk, mi a realisztikus az adott állapotra. Nem ígérünk kényelmes lakhatást ott, ahol a munkák ezt nem teszik lehetővé.",
    },
    {
      id: "permit",
      q: "Kell engedély vagy társasházi hozzájárulás?",
      a: "Attól függ, mi változik. Belső felületcsere gyakran más keret, mint teherhordó fal, homlokzat vagy közös terület. Társasháznál a házirend és a közös képviselő egyeztetése is szóba jöhet. Engedélyeztetést nem vállalunk; segítünk tisztázni, milyen dokumentum vagy hozzájárulás szokott kelleni az adott típusú munkához.",
    },
    {
      id: "contract",
      q: "Mire figyeljek ajánlatnál és szerződésnél?",
      a: "Érdemes tételes műszaki tartalmat, ütemet és fizetési szakaszokat kérni, ne csak egy végösszeget. Jó, ha világos, mi tartozik bele, és mi számít pótmunkának. Nálunk a vállalt kör írásban szerepel.",
    },
    {
      id: "area",
      q: "Milyen területen vállalnak felújítást?",
      a: "Bács-Kiskun megyében (Kecskemét és környéke), Pest megyében (beleértve a budai agglomerációt) és a Balaton környékén. A székhelyünk Kecskeméten van.",
    },
  ],
  relatedLinks: [
    { href: "/referenciak", label: "Referenciák" },
    { href: "/kapcsolat", label: "Kapcsolat" },
    { href: "/generalkivitelezes-pest-megye", label: "Pest megye" },
  ],
  ctaImage: S.felujitas,
  ctaImageAlt: "Lakás- és házfelújítás, BauGenerál",
}

const SZAKAGI_SERVICE: ServiceDefinition = {
  key: "szakagi",
  routeKey: "szakagi",
  layoutVariant: "compactSingleCol",
  referenceType: "trades",
  projectCategory: "renovation",
  hook:
    "Nem minden projekt igényel generálkivitelezőt. Ha csak egy szakág hiányzik, azt is vállaljuk: villany, gépészet, burkolás, térkő és a többi.",
  tldr:
    "A BauGenerál Kft. szakági kivitelezést önálló megbízásként is vállal. Villanyszerelés, épületgépészet, szerkezet, burkolás, festés, térkövezés, kerítés, hőszigetelés, gipszkarton, napelem. Bács-Kiskun, Pest megye és a Balaton környéke, generál nélkül is.",
  takeaways: [
    { label: "Forma", value: "Önálló szakági megbízás" },
    { label: "Szakágak", value: "10 fő terület" },
    { label: "Hol", value: "Bács-Kiskun, Pest, Balaton" },
    { label: "Válasz", value: "Hamarosan emailben" },
  ],
  whyParagraphs: [
    "Sok megrendelőnek nincs szüksége teljes generálkivitelezésre, csak egy hiányzó szakágra. Ilyenkor a teljes projektmenedzsment felesleges költség.",
    "Nálunk a szakági munka ugyanazzal a felelősséggel jár, mint a generál: egy kapcsolattartó, rögzített műszaki tartalom, átlátható ütem.",
  ],
  audience: [
    {
      title: "Magánmegrendelő",
      description:
        "Meglévő házához villanyt, gépészetet, burkolást, térkövet vagy más szakágot keres, egy felelős kivitelezővel.",
    },
    {
      title: "Generál nélküli projekt",
      description:
        "Már van fővállalkozója, de egy szakágat külön szeretne megbízni, átlátható szerződéssel.",
    },
    {
      title: "Felújító / korszerűsítő",
      description:
        "Energetikai fejlesztés, belső felújítás vagy kültér a fókusz, nem a teljes átépítés.",
    },
  ],
  processSteps: [
    {
      title: "Megkeresés",
      description: "Leírja a szakágat és a helyszínt. Hamarosan emailben jelentkezünk.",
    },
    {
      title: "Felmérés",
      description: "Pontosítjuk a műszaki tartalmat és a szükséges anyagokat.",
    },
    {
      title: "Ajánlat és szerződés",
      description: "Rögzítjük a kört, a határidőt és a felelősséget.",
    },
    {
      title: "Kivitelezés",
      description: "A szakág egy ütemben, egy kapcsolattartóval készül el.",
    },
    {
      title: "Átadás",
      description: "Dokumentált átadás a szerződés szerinti készültséggel.",
    },
  ],
  headings: {
    why: "Mikor érdemes szakáganként megbízni?",
    buildingTypes: "Ezeket szakáganként is vállaljuk",
    audience: "Kinek ajánljuk",
    scope: "Mit vállalunk",
    scopeExcludedTitle: "Mit nem vállalunk",
    process: "Hogyan zajlik a munka",
    proof: "Kapcsolódó munkáink",
    faq: "Gyakori kérdések",
    ctaTitle: "Szakági munkát tervez?",
    ctaBody: "Írja meg, melyik szakágra van szüksége. Hamarosan emailben jelentkezünk.",
  },
  buildingTypes: [
    {
      title: "Villanyszerelés",
      description:
        "Erős- és gyengeáram, elosztók, világítás. Új hálózat vagy meglévő bővítés, dokumentált átadással.",
      image: S.skyBack,
      imageAlt: "Villanyszerelés helyőrző fotó",
    },
    {
      title: "Épületgépészet",
      description:
        "Fűtés, víz, csatorna, szellőzés. Meglévő vagy új épülethez igazítva.",
      image: S.munka,
      imageAlt: "Épületgépészeti kivitelezés helyőrző fotó",
    },
    {
      title: "Szerkezetépítés",
      description:
        "Falazás, beton, szerkezeti munkák. Önálló megbízásként vagy nagyobb projekt részeként.",
      image: S.ipariHero,
      imageAlt: "Szerkezetépítés helyőrző fotó",
    },
    {
      title: "Burkolás",
      description:
        "Hidegburkolás beltérben: padló, fal, fürdő, konyha. Pontos illesztés, tiszta átadás.",
      image: S.felujitas,
      imageAlt: "Burkolási munkák helyőrző fotó",
    },
    {
      title: "Festés, mázolás",
      description:
        "Glettelés, festés, mázolás. Belső felületek, ahogy a projekt kéri.",
      image: S.csaladi,
      imageAlt: "Festési munkák helyőrző fotó",
    },
    {
      title: "Térkövezés",
      description:
        "Udvar, bejáró, terasz. Tartós burkolat, pontos lejtéssel.",
      image: S.houseHero,
      imageAlt: "Térkövezés helyőrző fotó",
    },
    {
      title: "Kerítésépítés",
      description:
        "Kerítés, kapu, lábazat. Új építés vagy cseréje a telekhez igazítva.",
      image: S.telephely,
      imageAlt: "Kerítésépítés helyőrző fotó",
    },
    {
      title: "Homlokzati hőszigetelés",
      description:
        "Homlokzati szigetelés és kapcsolódó felületképzés. Energetikai korszerűsítéshez.",
      image: S.kozepulet,
      imageAlt: "Homlokzati hőszigetelés helyőrző fotó",
    },
    {
      title: "Gipszkarton",
      description:
        "Válaszfalak, álmennyezet, szárazépítés. Belső átalakításokhoz.",
      image: S.kapcsolatHero,
      imageAlt: "Gipszkarton munkák helyőrző fotó",
    },
    {
      title: "Napelem-telepítés",
      description:
        "Háztartási és kisebb üzleti rendszerek telepítése, egyeztetett ütemben.",
      image: S.ipariNav,
      imageAlt: "Napelem telepítés helyőrző fotó",
    },
  ],
  scopeItems: [
    "Villanyszerelés (erős- és gyengeáram)",
    "Épületgépészet (fűtés, víz, szellőzés)",
    "Szerkezetépítés és kőműves munkák",
    "Burkolás, festés, gipszkarton",
    "Térkövezés, kerítés, homlokzati hőszigetelés",
    "Napelem-telepítés",
    "Önálló szakági szerződés, generál nélkül",
    "Egy kapcsolattartó a teljes szakági munkára",
  ],
  scopeExcluded:
    "Tervezést és engedélyeztetést nem vállalunk. A szakági munka meglévő terv vagy egyeztetett műszaki tartalom alapján indul. Teljes generálkivitelezéshez lásd a többi szolgáltatásunkat.",
  faq: [
    {
      id: "solo",
      q: "Vállalnak szakági munkákat generálkivitelezés nélkül?",
      a: "Igen. A fenti szakágakat önálló megbízásként is vállaljuk: egy kapcsolattartóval és rögzített műszaki tartalommal. Nem kell teljes generálszerződést kötnie, ha csak egy hiányzó szakágra van szüksége.",
      defaultOpen: true,
    },
    {
      id: "vs-general",
      q: "Mikor érdemes inkább generálkivitelezőt választani?",
      a: "Ha több szakág fut párhuzamosan, és kell valaki, aki összefogja őket. Ha csak egy szakág hiányzik, a szakági megbízás általában gyorsabb és átláthatóbb. Ha bizonytalan, írja meg a projektet: megmondjuk, melyik forma illik jobban.",
      defaultOpen: true,
    },
    {
      id: "trades",
      q: "Milyen szakágakat vállalnak?",
      a: "Villanyszerelés, épületgépészet, szerkezetépítés, burkolás, festés, térkövezés, kerítésépítés, homlokzati hőszigetelés, gipszkarton és napelem-telepítés. A pontos kör a megkeresés után tisztázható.",
    },
    {
      id: "multi",
      q: "Több szakágot is kérhetek egyszerre, generál nélkül?",
      a: "Igen, ha a munka így átláthatóbb. Ha a szakágak erősen függnek egymástól, gyakran a generálkivitelezés a jobb forma. Ezt az ajánlat előtt egyeztetjük.",
    },
    {
      id: "area",
      q: "Hol vállalnak szakági munkát?",
      a: "Bács-Kiskun megyében, Pest megyében és a Balaton környékén. Ha a helyszín ettől távolabb esik, a kapcsolatfelvételnél jelezze. Megnézzük, és megmondjuk, vállalható-e.",
    },
    {
      id: "price",
      q: "Van publikus ár?",
      a: "Nincs listaár a neten. A szakági munka ára a műszaki tartalom, az anyag és a helyszín alapján adható meg. Írásos ajánlatot a megkeresés után készítünk.",
    },
  ],
  relatedLinks: [
    { href: "/szolgaltatasok/felujitas", label: "Felújítás" },
    { href: "/szolgaltatasok/csaladi-haz-epites", label: "Családi ház" },
    { href: "/szolgaltatasok/asztalos-munkak", label: "Asztalos munkák" },
    { href: "/generalkivitelezes-pest-megye", label: "Pest megye" },
    { href: "/kapcsolat", label: "Kapcsolat" },
  ],
  ctaImage: S.munka,
  ctaImageAlt: "Szakági kivitelezés helyőrző fotó",
}

const ASZTALOS_SERVICE: ServiceDefinition = {
  key: "asztalos",
  routeKey: "asztalos",
  layoutVariant: "default",
  referenceType: "carpentry",
  projectCategory: "family",
  hook:
    "A kulcsrakész nálunk a bútorral ér véget. Saját partnerüzemben gyártjuk az egyedi beépített bútorokat.",
  tldr:
    "A BauGenerál Kft. asztalos munkákat is vállal: egyedi beépített bútor, konyhabútor és belső terek. A gyártást saját tulajdonú partnercégünk, a Hírös-Ablak Kft. végzi Kecskeméten (lapszabászat, élzárás, saját üzem). Így az átadás beköltözhető otthont jelent.",
  takeaways: [
    { label: "Gyártó", value: "Hírös-Ablak Kft." },
    { label: "Üzem", value: "kb. 1500 m² Kecskemét" },
    { label: "Mióta", value: "1996 óta faipar" },
    { label: "Mit kap", value: "Tervtől bútorig, egy kézben" },
  ],
  whyParagraphs: [
    "Sok generálkivitelező üres falakat ad át. A bútorozást Önnek kell külön szerveznie: más cég, más határidő, más minőség.",
    "Nálunk a beépített bútor és a konyha a projekt része lehet. A Hírös-Ablak Kft. saját üzemben gyárt (lapszabászat, élzárás); a BauGenerál a helyszíni beépítést és az átadást fogja össze.",
  ],
  audience: [
    {
      title: "Családi ház építtető",
      description:
        "Kulcsrakész otthont szeretne: beépített bútorral és konyhával, egy felelős csapattal.",
    },
    {
      title: "Felújító",
      description:
        "Lakás- vagy házfelújítás végén egyedi bútort és belső tereket szeretne, nem polcról.",
    },
    {
      title: "Irodai / üzleti megrendelő",
      description:
        "Recepció, iroda vagy bemutatótér egyedi bútorozását keresi, gyártóval a háttérben.",
    },
  ],
  processSteps: [
    {
      title: "Megkeresés",
      description: "Átbeszéljük, milyen bútorra és belső terekre van szükség.",
    },
    {
      title: "Anyag és méret",
      description:
        "A Hírös-Ablak bevonásával pontosítjuk az anyagot, a lapszabászatot és a méreteket.",
    },
    {
      title: "Ajánlat és szerződés",
      description: "Rögzítjük a bútorozás körét és az átadási ütemet.",
    },
    {
      title: "Gyártás a saját üzemben",
      description: "Lapszabászat, élzárás, összeszerelés a Hírös-Ablak Kecskeméten.",
    },
    {
      title: "Beépítés és átadás",
      description: "Helyszíni beépítés a kivitelezés üteméhez igazítva. Beköltözhető állapot.",
    },
  ],
  headings: {
    why: "Miért számít a saját bútorüzem?",
    buildingTypes: "Milyen asztalos munkákat vállalunk",
    audience: "Kinek ajánljuk",
    scope: "Mit vállalunk",
    scopeExcludedTitle: "Mit nem vállalunk",
    process: "Hogyan zajlik a munka",
    proof: "Kapcsolódó munkáink",
    faq: "Gyakori kérdések",
    ctaTitle: "Egyedi bútort vagy beépített belső teret tervez?",
    ctaBody: "Írjon nekünk. Hamarosan emailben jelentkezünk.",
  },
  buildingTypes: [
    {
      title: "Beépített bútor",
      description: "Gardrób, polcrendszer, tárolók — a falhoz és a térhez igazítva.",
      image: "/img/asztalos/bemutato.jpg",
      imageAlt: "Bútorlap- és fogantyúminták a Hírös-Ablak bemutatótermében",
    },
    {
      title: "Konyhabútor",
      description: "Egyedi konyha frontokkal és munkalappal. Gyártás a Hírös-Ablaknál.",
      image: "/img/asztalos/munkalap.jpg",
      imageAlt: "Konyhai munkalap és anyagválaszték a Hírös-Ablaknál",
    },
    {
      title: "Belső terek",
      description: "Nappali, háló, iroda: egységes asztalos megoldások egy projektben.",
      image: "/img/asztalos/tablafeloszto.jpg",
      imageAlt: "Táblafelosztó gép a Hírös-Ablak gyártóüzemében",
    },
    {
      title: "Kulcsrakész átadás",
      description: "Építés és bútorozás egy ütemben. Beköltözhető állapot.",
      image: "/img/asztalos/telephely-udvar.jpg",
      imageAlt: "Hírös-Ablak faipari telephely Kecskeméten",
    },
  ],
  scopeItems: [
    "Egyedi beépített bútor tervezése egyeztetéssel",
    "Konyhabútor gyártása és beépítése",
    "Belső terek asztalos munkái",
    "Lapszabászat és élzárás a Hírös-Ablak saját üzemében",
    "Helyszíni beépítés a kivitelezés üteméhez igazítva",
    "Kulcsrakész, bútorozott átadás igény szerint",
  ],
  scopeExcluded:
    "Önálló nyílászáró-gyártást ezen az oldalon nem hirdetünk. A bútor- és belsőépítészeti asztalos munkákra fókuszálunk. A Hírös-Ablak további szolgáltatásai (barkácsáruház, online lapszabászat, asztalos partner) a hirosablak.hu-n érhetők el.",
  faq: [
    {
      id: "who",
      q: "Ki gyártja az egyedi bútorokat?",
      a: "Saját tulajdonú partnercégünk, a Hírös-Ablak Kft. Kecskeméten, saját üzemben (lapszabászat, élzárás, bútor). A BauGenerál fogja össze a helyszíni beépítést és az átadást.",
      defaultOpen: true,
    },
    {
      id: "hiros",
      q: "Mi a Hírös-Ablak Kft.?",
      a: "Kecskeméti faipari cég 1996 óta: kb. 1500 m² saját üzem, 500 m² bemutatóterem, Mindszenti krt. 10. Lapszabászat, élzárás, anyagok. Külön jogi személy a BauGeneráltól, kapcsolódó tulajdonosi kör.",
      defaultOpen: true,
    },
    {
      id: "key",
      q: "Mit jelent a kulcsrakész bútorozással?",
      a: "Az átadáskor nem üres falakat kap, hanem a szerződés szerinti beépített bútorokat és konyhát is, beköltözhető állapotban.",
    },
    {
      id: "solo-furniture",
      q: "Csak bútort is rendelhetek, építés nélkül?",
      a: "Igen. Asztalos munkát önállóan is vállalunk; a gyártás a Hírös-Ablaknál történik. Anyag és lapszabászat: hirosablak.hu.",
    },
    {
      id: "lapszabaszat",
      q: "Lapszabászatot külön is kérhetek?",
      a: "Igen, közvetlenül a Hírös-Ablaknál (hirosablak.hu). Generálprojekthez kapcsolódó bútorozást a BauGenerál kapcsolaton keresztül indítjuk.",
    },
    {
      id: "area",
      q: "Hol vállalnak asztalos munkát?",
      a: "Bács-Kiskun és Pest megyében (Üröm, Solymár és a budai agglomeráció is), valamint a Balaton környékén.",
    },
    {
      id: "price",
      q: "Van publikus ár?",
      a: "Nincs. Az egyedi bútor ára az anyag, a méret és a beépítés alapján adható meg.",
    },
  ],
  relatedLinks: [
    { href: "https://www.hirosablak.hu", label: "Hírös-Ablak — gyártó partner" },
    {
      href: "https://www.hirosablak.hu/lapszabaszat-kecskemet",
      label: "Lapszabászat Kecskeméten",
    },
    { href: "/szolgaltatasok/csaladi-haz-epites", label: "Családi ház építés" },
    { href: "/generalkivitelezes-pest-megye", label: "Pest megye" },
    { href: "/kapcsolat", label: "Kapcsolat" },
  ],
  ctaImage: "/img/asztalos/telephely-drone.jpg",
  ctaImageAlt: "Hírös-Ablak faipari üzem és áruház Kecskeméten, drónfelvétel",
}


const SERVICES: Partial<Record<ServiceKey, ServiceDefinition>> = {
  ipari: INDUSTRIAL_SERVICE,
  tarshazak: TARSHAZAK_SERVICE,
  csaladiHaz: CSALADI_HAZ_SERVICE,
  kozepuletek: KOZEPULETEK_SERVICE,
  felujitas: FELUJITAS_SERVICE,
  szakagi: SZAKAGI_SERVICE,
  asztalos: ASZTALOS_SERVICE,
}

export function getServiceByKey(key: ServiceKey): ServiceDefinition {
  const service = SERVICES[key]
  if (!service) {
    throw new Error(`Service not implemented: ${key}`)
  }
  return service
}

export function getServiceRoute(service: ServiceDefinition) {
  return ROUTES[service.routeKey]
}

export type ServiceProof = {
  reference: NonNullable<ReturnType<typeof getReferenceBySlug>>
  project: ReturnType<typeof getActiveProjectBySlug>
}

export function getServiceProof(service: ServiceDefinition): ServiceProof | null {
  const reference =
    (service.proofReferenceSlug
      ? getReferenceBySlug(service.proofReferenceSlug)
      : undefined) ??
    getPublishedReferences().find((r) => r.type === service.referenceType)

  if (!reference) return null

  const project =
    (service.proofProjectSlug
      ? getActiveProjectBySlug(service.proofProjectSlug)
      : undefined) ??
    getPublishedActiveProjects().find(
      (p) => p.category === service.projectCategory,
    )

  return { reference, project }
}

export function buildServiceJsonLd(service: ServiceDefinition) {
  const route = getServiceRoute(service)

  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: route.title,
    description: service.tldr,
    url: absoluteUrl(route.path),
    provider: { "@id": ORGANIZATION_ID },
    areaServed: COMPANY.serviceArea.map((name) => ({
      "@type": "AdministrativeArea",
      name,
    })),
    serviceType: route.label,
  }
}

export function buildServiceFaqJsonLd(faq: readonly ServiceFaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  }
}
