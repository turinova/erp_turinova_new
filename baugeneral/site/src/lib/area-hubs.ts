/**
 * Area hub pages: Pest megye (+ Budapest) + Bács-Kiskun.
 * County-wide claim; city lists are examples, not exclusive coverage.
 * Doorway city/district sites avoided.
 */

export type AreaHubServiceCard = {
  href: string
  title: string
  text: string
}

export type AreaHubFaq = { q: string; a: string }

export type AreaHubCluster = {
  title: string
  body: string
  href: string
  linkLabel: string
}

/** Example places for Pest hub + JSON-LD (not an exclusive list). */
export const PEST_CITIES = [
  "Budapest",
  "Üröm",
  "Solymár",
  "Pilisvörösvár",
  "Pilisborosjenő",
  "Budakalász",
  "Nagykovácsi",
  "Telki",
  "Budajenő",
] as const

/** Example places for Bács-Kiskun hub + JSON-LD (not an exclusive list). */
export const BACS_CITIES = [
  "Kecskemét",
  "Lajosmizse",
  "Kiskunfélegyháza",
  "Kiskőrös",
  "Kalocsa",
  "Baja",
  "Jánoshalma",
  "Lakitelek",
] as const

export const AREA_SERVICE_CARDS: readonly AreaHubServiceCard[] = [
  {
    href: "/szolgaltatasok/ipari-epuletek",
    title: "Ipari épületek",
    text: "Csarnokok, autószalonok, kereskedelmi létesítmények.",
  },
  {
    href: "/szolgaltatasok/csaladi-haz-epites",
    title: "Családi házak",
    text: "Meglévő terv alapján, beköltözhető állapotig.",
  },
  {
    href: "/szolgaltatasok/felujitas",
    title: "Felújítás",
    text: "Lakás- és házfelújítás összehangolt szakágakkal.",
  },
  {
    href: "/szolgaltatasok/kozepuletek",
    title: "Középületek",
    text: "Óvodák, hivatalok, intézményi kivitelezés.",
  },
  {
    href: "/szolgaltatasok/szakagi-kivitelezes",
    title: "Szakági kivitelezés",
    text: "Gépészet, villany, napelem, térkő, önállóan is.",
  },
  {
    href: "/szolgaltatasok/asztalos-munkak",
    title: "Asztalos munkák",
    text: "Egyedi bútor a Hírös-Ablak kecskeméti üzeméből.",
  },
]

export const PEST_CLUSTERS: readonly AreaHubCluster[] = [
  {
    title: "Felújítás Budapesten és Pest megyében",
    body: "Lakás- és házfelújítás Budapesten és Pest megyében. Egy kapcsolattartó, bontástól a befejezésig. Székhely: Kecskemét; helyszíni művezetés a projekt üteméhez igazítva.",
    href: "/szolgaltatasok/felujitas",
    linkLabel: "Felújítás szolgáltatás",
  },
  {
    title: "Szakági kivitelezés Budapesten és Pest megyében",
    body: "Villany, gépészet, burkolás és más szakágak önállóan is, generál nélkül. Tipikus megkeresés: fürdő / lakásfelújítás mellé hiányzó szakember.",
    href: "/szolgaltatasok/szakagi-kivitelezes",
    linkLabel: "Szakági kivitelezés",
  },
  {
    title: "Generálkivitelezés Pest megyében",
    body: "Ipari épület, családi ház, középület. Helyszíni művezetés; székhely Kecskemét.",
    href: "/szolgaltatasok/ipari-epuletek",
    linkLabel: "Ipari épületek",
  },
  {
    title: "Asztalos / beépített bútor Pest megyében",
    body: "A bútor Kecskeméten készül, a beépítést a ház vagy felújítás üteméhez igazítjuk Budapesten és Pest megyében is.",
    href: "/szolgaltatasok/asztalos-munkak",
    linkLabel: "Asztalos munkák",
  },
]

export const BACS_CLUSTERS: readonly AreaHubCluster[] = [
  {
    title: "Felújítás Bács-Kiskun megyében",
    body: "Lakás- és házfelújítás a megyében: szakágak egy ütemben, írásos műszaki tartalommal. Nem csak Kecskemét; más település is szóba jöhet.",
    href: "/szolgaltatasok/felujitas",
    linkLabel: "Felújítás szolgáltatás",
  },
  {
    title: "Szakági kivitelezés a megyében",
    body: "Villany, gépészet, burkolás és más szakágak önállóan is, generál nélkül. Kecskemét és Bács-Kiskun szélesebb körben.",
    href: "/szolgaltatasok/szakagi-kivitelezes",
    linkLabel: "Szakági kivitelezés",
  },
  {
    title: "Generálkivitelezés Bács-Kiskunban",
    body: "Csarnok, családi ház, középület. A székhelyünk Kecskeméten van; a megyében helyszíni művezetéssel dolgozunk.",
    href: "/szolgaltatasok/ipari-epuletek",
    linkLabel: "Ipari épületek",
  },
  {
    title: "Asztalos munkák Kecskemétről",
    body: "Beépített bútor és konyha: gyártás a Hírös-Ablak Mindszenti körúti üzemében, beépítés a megyei helyszínen.",
    href: "/szolgaltatasok/asztalos-munkak",
    linkLabel: "Asztalos munkák",
  },
]

export const PEST_FAQ: readonly AreaHubFaq[] = [
  {
    q: "Csak a budai oldalon vagy Üröm–Solymár környékén dolgoznak?",
    a: "Nem. Pest megyében és Budapesten szélesebb körben vállalunk. A településlista példákat mutat (gyakori vagy jellemző helyszínek), nem kizáró listát. Írja meg a konkrét települést vagy kerületet: megmondjuk, vállalható-e.",
  },
  {
    q: "Vállalnak felújítást és szakági munkát Budapesten is?",
    a: "Igen. Budapesten és Pest megyében vállalunk lakás- és házfelújítást, valamint szakági munkákat (villany, gépészet, burkolás és más). A székhelyünk Kecskeméten van; a helyszíni művezetést a projekt üteméhez igazítjuk.",
  },
  {
    q: "Vállal a BauGenerál építkezést Ürömön és Solymáron?",
    a: "Igen. Ezek gyakori példák a budai agglomerációban, de nem csak ott dolgozunk Pest megyében.",
  },
  {
    q: "Milyen típusú projekteket vállalnak Pest megyében és Budapesten?",
    a: "Felújítást, szakági megbízást (pl. villany, gépészet, burkolás), ipari és kereskedelmi épületeket, családi házakat, középületeket és asztalos munkákat. A szolgáltatás oldalakon a tartalom, ezen az oldalon a terület szerepel.",
  },
  {
    q: "Mennyibe kerül a kiszállás Budapestre vagy Pest megyébe?",
    a: "Nincs külön publikus „kiszállási díjlista”. Az ajánlatban a helyszín és a projekt mérete alapján szerepel minden költség, a szerződés előtt.",
  },
  {
    q: "Hogyan indul a kapcsolatfelvétel?",
    a: "Írjon a kapcsolat oldalon, vagy hívjon. Egy munkanapon belül emailben vagy telefonon válaszolunk. Elég a település / kerület és egy rövid leírás.",
  },
]

export const BACS_FAQ: readonly AreaHubFaq[] = [
  {
    q: "Csak Kecskeméten vállalnak munkát?",
    a: "Nem. Bács-Kiskun megyében szélesebb körben dolgozunk. A településlista példákat mutat (pl. Kecskemét, Lajosmizse, Kiskunfélegyháza, Baja), nem kizáró listát. Más megyei helyszín is szóba jöhet: írja meg az első üzenetben.",
  },
  {
    q: "Hol van a BauGenerál székhelye?",
    a: "Kecskeméten, a Mindszenti krt. 10. alatt. Innen indul a megyei működés; Pest megyében, Budapesten és a Balaton környékén is vállalunk.",
  },
  {
    q: "Vállalnak felújítást, szakági és asztalos munkát is a megyében?",
    a: "Igen. Teljes lakás- és házfelújítást, szakági megbízást, valamint beépített bútort (Hírös-Ablak gyártás) is. Generálkivitelezés mellett szakági forma is lehetséges.",
  },
  {
    q: "Milyen projekteket vállalnak Bács-Kiskunban?",
    a: "Ipari és kereskedelmi épületeket, családi házakat, középületeket, felújításokat, szakági és asztalos munkákat.",
  },
  {
    q: "Hogyan indul a megkeresés?",
    a: "Írjon a kapcsolat oldalon, vagy hívjon (+36 30 958 6331). Helyszín (település) és rövid leírás elég az első válaszhoz.",
  },
]
