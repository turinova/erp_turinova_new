/** Iparági landing oldalak — footer + /kiknek/[slug]. Minden bejegyzés egyedi szöveg. */

export type ProGateVertical = {
  slug: string;
  /** Rövid footer link */
  footerLabel: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  /** Konkrét fájdalompontok — nem sablon mondatok */
  pains: readonly [string, string, string];
  closing: string;
  /** Főoldali #kiknek kártyán is megjelenik */
  featured?: boolean;
};

export const PROGATE_VERTICALS: readonly ProGateVertical[] = [
  {
    slug: "autoalkatresz-nagyker",
    footerLabel: "Autóalkatrész nagyker",
    h1: "Autóalkatrész nagyker: cikkszámra rendeljen a viszonteladó, ne e-mailben",
    metaTitle: "B2B gyors rendelés autóalkatrész nagykereskedőknek | ProGate",
    metaDescription:
      "Shoprenteres autóalkatrész nagyker: SKU/EAN alapú gyors rendelés, partnerár, készlet. A szervizek és viszonteladók percek alatt töltik a kosarat.",
    intro:
      "Egy szerviz listában küldi a fékbetétet, szűrőt, olajat — te visszaírod, ami nincs raktáron, és holnapra csúszik a fuvar. A ProGate a meglévő Shoprenter boltodra tesz gyors rendelőt: a partner cikkszámra dolgozik, te pedig egy portálon tartod az árakat.",
    pains: [
      "Hetente ugyanazok a szervizek ugyanazzal a 40 soros Excellel — mégis kézzel viszed be.",
      "Gyári és aftermarket cikkszám keveredik; egy elírás = rossz alkatrész a futárban.",
      "Amíg vár a visszaigazolásra, a konkurenciánál rendel, ahol azonnal látja a készletet.",
    ],
    closing:
      "A widget Excelt, szöveget és fotót is felismer; a kosár a natív Shoprenter checkoutba megy. Indulás: API, script a sablonba, partnerár — sok nagyker napok alatt élő.",
    featured: true,
  },
  {
    slug: "allateledel-nagyker",
    footerLabel: "Állateledel nagyker",
    h1: "Állateledel nagyker: ismétlődő zsákrendelés, nem telefonhívás",
    metaTitle: "B2B rendelés állateledel nagykereskedőknek | ProGate",
    metaDescription:
      "Állateledel és felszerelés nagyker Shoprenteren: viszonteladói gyors rendelés, csomagméret, partnerár. Kevesebb admin, több heti rendelés.",
    intro:
      "A kisállat-boltok ugyanazt a 15 kg-os tápot rendelik kéthetente — mégis e-mailben vagy Messengeren. A ProGate self-serve réteget ad a Shoprenter boltodra: a partner a saját kedvezményes áron tölti a kosarat, te nem gépelod újra.",
    pains: [
      "Szezonális csúcsoknál elakad a rendelésfelvétel, miközben a fuvar időzítése számít.",
      "Különböző csomagméret és EAN — a kézi lista könnyen félremehet.",
      "Új viszonteladót nehéz betanítani a webshop böngészésére; a cikkszám-lista ismerős.",
    ],
    closing:
      "Rendeléstörténet és újrarendelés a widgetben — a bolt visszatér hetente anélkül, hogy újra írna e-mailt.",
    featured: true,
  },
  {
    slug: "ruha-divat-nagyker",
    footerLabel: "Ruha és divat nagyker",
    h1: "Divat nagyker: kollekciós lista kosárba, méret/cikk kód alapján",
    metaTitle: "B2B gyors rendelés ruha és divat nagykereskedőknek | ProGate",
    metaDescription:
      "Ruhaüzleteknek nagyker rendelés Shoprenteren: gyors SKU-lista, partnerár csoportok szerint, gyors rendelés widget.",
    intro:
      "A viszonteladó nem katalógust lapoz — kollekciós Excelt küld méret-szín kóddal. A ProGate ezt a munkát ismeri: gyors bevitel, ellenőrzés, kosár a meglévő boltodon.",
    pains: [
      "Szezonindításkor egyszerre 30 bolt küld listát — a csapat csak gépel.",
      "Outlet és teljes áras csoport keveredik; rossz ár = vitás számla.",
      "A partner nem akar fiókot nyitni minden márkánál; egy ismert boltnál akar rendelni.",
    ],
    closing:
      "Csoportár a portálon: fix kivétel, sáv, tömeges szerkesztés — a divatnál is kell a rugalmasság.",
    featured: true,
  },
  {
    slug: "butorlap-nagyker",
    footerLabel: "Bútorlap nagyker",
    h1: "Bútorlap nagyker: asztalos listája → kosár, méret és dekór kód szerint",
    metaTitle: "B2B gyors rendelés bútorlap nagykereskedőknek | ProGate",
    metaDescription:
      "Bútorlap és munkalap nagyker Shoprenterhez: cikkszám, Excel import, partnerár. Asztalosok és bútorosok gyorsan rendelnek.",
    intro:
      "Az asztalos nem a webshop képeit nézegeti — tudja a dekór kódot és a méretet. E-mailben küldi a listát, te pedig összeírod. A ProGate gyors rendelő widgettel ugyanaz a bolt marad, csak a partner percek alatt leadja.",
    pains: [
      "Sok variáns (méret, dekór, élzárás) — egy sor elcsúszik, az egész lap rossz.",
      "Ismétlődő megrendelők hetente ugyanazt kérik; felesleges újra gépelni.",
      "A Shoprenter kosár jó, de nincs hozzá gyors B2B lista-beillesztés natívan.",
    ],
    closing:
      "Turinova környezetből ismerjük a lap- és vasalat-nagyker tempóját — erre épült a termék.",
    featured: true,
  },
  {
    slug: "vasalat-nagyker",
    footerLabel: "Vasalat és szerelvény",
    h1: "Vasalat nagyker: Blum, Hettich, cikkszám — lista feloldás egy lépésben",
    metaTitle: "B2B gyors rendelés vasalat nagykereskedőknek | ProGate",
    metaDescription:
      "Vasalat és bútor szerelvény nagyker: SKU gyors rendelés, partnerár, Shoprenter integráció. Viszonteladók és asztalosok self-serve rendelése.",
    intro:
      "Egy fiókrendelés 80 tétel, mind cikkszám — ha e-mailben jön, fél nap munka. A ProGate a partnerednek gyors mezőt ad; neked pedig portált, ahol csoportonként állítod az árat.",
    pains: [
      "Gyári cikkszám és saját SKU párhuzamosan — a partner keveri.",
      "Kis tételű sürgős rendelések elnyomják a nagy listákat.",
      "Nincs látható különbség widget- és telefonos forgalom között — nem tudod mérni a B2B-t.",
    ],
    closing:
      "Riport: widget vs. bolti rendelés — végre látod, ki tényleg online rendel.",
    featured: true,
  },
  {
    slug: "epitoanyag-nagyker",
    footerLabel: "Építőanyag nagyker",
    h1: "Építőanyag nagyker: raklap és zsák mennyiség, nem félrement e-mail",
    metaTitle: "B2B gyors rendelés építőanyag nagykereskedőknek | ProGate",
    metaDescription:
      "Építőanyag és szerelvény nagyker Shoprenteren: gyors lista, partnerár, készlet. Kivitelezők és viszonteladók önkiszolgáló rendelése.",
    intro:
      "A kivitelező hétfő reggel küldi, mit visztek ki a hétre — zsák cement, profil, csavar. A ProGate nem cseréli le a logisztikát; csak azt, hogy a rendelés felvétel ne legyen szűk keresztmetszet.",
    pains: [
      "Mennyiségi egység (raklap, zsák, fm) félreértés gyakori telefonos rendelésnél.",
      "Viszonteladói ár csoportok — a diszpécser nem mindig tudja fejből.",
      "Dupla admin: rendelés papíron és utána a webshopban is.",
    ],
    closing:
      "Volume tier és csoport % egy helyen a portálon — nem kell minden árat külön Excelben tartani.",
    featured: true,
  },
  {
    slug: "barkacs-szerszam-nagyker",
    footerLabel: "Barkács és szerszám",
    h1: "Barkács nagyker: viszonteladói lista → kosár, nem call center",
    metaTitle: "B2B gyors rendelés barkács és szerszám nagykereskedőknek | ProGate",
    metaDescription:
      "Barkácsáruház és szerszám nagyker Shoprenterhez: gyors rendelés widget, SKU, partnerár. Kevesebb telefon, több online B2B.",
    intro:
      "A helyi barkácsbolt tudja, mit akar — csak nincs ideje a webshopon végigkattintani 200 terméket. Gyors rendelés cikkszámra és Excelből: ismerős nagyker-flow a Shoprenter boltodon.",
    pains: [
      "Telefonos rendelés csúcsidőben elnyomja az értékesítőt.",
      "Akciós és alapár keveredik csoportonként.",
      "A partner azt hiszi, nincs online nagyker — mert eddig csak e-mail volt.",
    ],
    closing:
      "14 napos próba kártya nélkül — beilleszted a scriptet, mutatsz egy partnernek, mérheted a különbséget.",
  },
  {
    slug: "elektronika-viszontelado",
    footerLabel: "Elektronika viszonteladó",
    h1: "Elektronika viszonteladó: EAN és cikkszám, gyors kosár feltöltés",
    metaTitle: "B2B gyors rendelés elektronika nagykereskedőknek | ProGate",
    metaDescription:
      "Elektronika és IT nagyker Shoprenteren: EAN/SKU rendelés, partnerár, készlet. Viszonteladók self-serve B2B rendelése.",
    intro:
      "Az EAN a közös nyelv — a viszonteladó listában küldi, te pedig keresed a termékoldalt. A ProGate feloldja a listát, mutatja a készletet és az árat, a kosár pedig natív marad.",
    pains: [
      "Gyorsan avuló készlet — a visszaigazolás késése eladásvesztés.",
      "Több árkategória (viszont, prémium partner) — könnyű elrontani kézzel.",
      "CSV export hiányzik a natív shopból a partnernek; e-mailhez szoktak.",
    ],
    closing:
      "Automatizmus: csoportlépés költés vagy rendelésszám alapján — a növekvő viszonteladó automatikusan jobb árat kap.",
  },
  {
    slug: "villamossagi-nagyker",
    footerLabel: "Villamossági nagyker",
    h1: "Villamossági nagyker: szerelő listája percek alatt a kosárban",
    metaTitle: "B2B gyors rendelés villamossági nagykereskedőknek | ProGate",
    metaDescription:
      "Villamossági anyag nagyker Shoprenterhez: gyors SKU rendelés, partnerár, riport. Villanyszerelők és viszonteladók online rendelése.",
    intro:
      "Doboz, kábel, automata, csatlakozó — a szerelő tudja a cikkszámot, nem a kategóriafát. Self-serve gyors rendelés a meglévő Shoprenter boltodra, magyar supporttal.",
    pains: [
      "Projektlista 150 sor — diszpécser napokig dolgozik rajta.",
      "Készlethiány csak utólag derül ki, ha már lefoglalták a munkát.",
      "Nem látszik, melyik partner mennyit rendel online vs. telefonon.",
    ],
    closing:
      "Partnerlap a portálon: forgalom, utolsó rendelés, csoport — egy képernyőn.",
  },
  {
    slug: "kozmetika-nagyker",
    footerLabel: "Kozmetika nagyker",
    h1: "Kozmetika nagyker: drogéria viszonteladó rendel cikkszámra",
    metaTitle: "B2B gyors rendelés kozmetika nagykereskedőknek | ProGate",
    metaDescription:
      "Kozmetika és drogéria nagyker Shoprenteren: gyors rendelés, partnerár, csoportkedvezmény. Viszonteladói self-serve rendelés.",
    intro:
      "A szalon és a drogéria ugyanazt a márkát rendeli különböző kedvezménnyel. A ProGate csoportonként áraz; a partner csak a saját árát látja gyors rendelés közben.",
    pains: [
      "Minimum rendelés és csomag egység — telefonon gyakran félremegy.",
      "Új termékbevezetésnél minden viszonteladónak külön PDF megy.",
      "A webshop DTC élmény; a nagyker partner listában gondolkodik.",
    ],
    closing:
      "Újrarendelés egy kattintás — a havi fix lista másodpercek alatt visszatöltődik.",
  },
  {
    slug: "sport-nagyker",
    footerLabel: "Sport és outdoor",
    h1: "Sport nagyker: szezonális lista, gyors feltöltés, partnerár",
    metaTitle: "B2B gyors rendelés sport nagykereskedőknek | ProGate",
    metaDescription:
      "Sportfelszerelés és outdoor nagyker Shoprenterhez: SKU gyors rendelés, viszonteladói ár, készlet.",
    intro:
      "Szezon előtt jön a nagy rendelés — cipő, mez, labda, mind méret szerint kódolva. Ne e-mail csatolt Excel legyen az utolsó mérföld; a partner maga töltse a kosarat a boltodon.",
    pains: [
      "Méretválaszték miatt hosszú a webshopos rendelés; lista gyorsabb lenne, de nincs hozzá eszköz.",
      "Előrendelés és készletes tétel keveredik egy listában.",
      "Viszonteladói ár sávok — szezon végén nehéz emlékezni, ki melyik szinten van.",
    ],
    closing:
      "Szintlépés szabályok: ha a partner eléri a havi költést, automatikusan jobb csoportba kerül.",
  },
  {
    slug: "haztartasigep-nagyker",
    footerLabel: "Háztartásigép nagyker",
    h1: "Háztartásigép nagyker: viszonteladói rendelés, nem 20 perc böngészés",
    metaTitle: "B2B gyors rendelés háztartásigép nagykereskedőknek | ProGate",
    metaDescription:
      "Háztartásigép és kisgep nagyker Shoprenteren: gyors cikkszám rendelés, partnerár, B2B widget.",
    intro:
      "A kereskedő tudja a modell cikkszámát — nem kell szűrni a teljes katalógust. Gyors rendelés réteg a Shoprenterre: lista, ellenőrzés, kosár.",
    pains: [
      "Garanciális és kereskedelmi ár keveredése külön csoportoknál.",
      "Nagy tételű fuvar szervezés előtt kell a rendelés — a késés napokba kerül.",
      "Telefonos rendelés nem hagy nyomot a riportban.",
    ],
    closing:
      "Widget forgalom külön mérve — látod, mennyi B2B online vs. hagyományos csatorna.",
  },
  {
    slug: "papir-iroszer-nagyker",
    footerLabel: "Papír-írószer nagyker",
    h1: "Irodaszer nagyker: céglista → kosár, havi utánrendelés egyszerűen",
    metaTitle: "B2B gyors rendelés papír-írószer nagykereskedőknek | ProGate",
    metaDescription:
      "Papír-írószer és irodaszer nagyker Shoprenterhez: gyors lista rendelés, partnerár, ismétlődő B2B forgalom.",
    intro:
      "Céges irodák és viszonteladók ugyanazt a tonert, papírt, füzetet kérik havonta. A ProGate újrarendelést és listát ad — nem kell minden hónapban új e-mail.",
    pains: [
      "Katalógus széles, de a rendelés mindig 30 fix cikk — felesleges kategóriaböngészés.",
      "Közbeszerzéses és szabad áras partner együtt — árkeveredés veszély.",
      "Kis értékű, gyakori rendelések eszik az admin időt.",
    ],
    closing:
      "Gyors rendelés a partnernek, árazás és riport neked — havi bruttó 7 500 Ft-tól.",
  },
  {
    slug: "konyha-nagyker",
    footerLabel: "Konyhafelszerelés nagyker",
    h1: "Konyhafelszerelés nagyker: HORECA és viszonteladó cikkszám-listával",
    metaTitle: "B2B gyors rendelés konyhafelszerelés nagykereskedőknek | ProGate",
    metaDescription:
      "Konyhai eszköz és HORECA nagyker Shoprenteren: B2B gyors rendelés, partnerár, készlet.",
    intro:
      "Éttermi üzemeltető és kisbolt is listában rendel — edény, kés, gépek cikkszám szerint. A ProGate a Shoprenter boltodra ül rá; külön B2B shop nélkül.",
    pains: [
      "HORECA sürgős rendelés elől nem állhat a diszpécser fél napig.",
      "Több márka, egy webshop — a partner a kódot ismeri, a képet nem.",
      "Mennyiségi kedvezmény sávok — kézi számolás hibás lehet.",
    ],
    closing:
      "Volume tier a portálon: ha többet vesz, olcsóbb — automatikusan a kosárban is.",
  },
  {
    slug: "jatek-hobby-nagyker",
    footerLabel: "Játék és hobby",
    h1: "Játék nagyker: szezon előtti nagy lista, gyors kosár",
    metaTitle: "B2B gyors rendelés játék és hobby nagykereskedőknek | ProGate",
    metaDescription:
      "Játék és hobby nagyker Shoprenterhez: viszonteladói gyors rendelés, SKU, partnerár.",
    intro:
      "Karácsony előtt jön a 500 soros rendelés — minden sor egy EAN. A gyors rendelés widget feloldja, a hiányzó tételeket azonnal látod.",
    pains: [
      "Szezonális csúcs túlterheli a rendelésfelvételt.",
      "Korhatár és kategória a webshopon zavarja a viszonteladót — neki kód kell.",
      "Visszaigazolás késése = partner más nagykerhez fordul.",
    ],
    closing:
      "14 napos teljes próba — szezon előtt be tudod kapcsolni, mielőtt a csúcs jön.",
  },
  {
    slug: "mezogazdasagi-nagyker",
    footerLabel: "Mezőgazdasági nagyker",
    h1: "Agro nagyker: vetőmag, trágya, alkatrész — lista alapú rendelés",
    metaTitle: "B2B gyors rendelés mezőgazdasági nagykereskedőknek | ProGate",
    metaDescription:
      "Mezőgazdasági input és géprész nagyker Shoprenteren: gyors B2B rendelés, partnerár, készlet.",
    intro:
      "A gazda tavasz előtt adja le a listát — nem kategóriákat böngész. Cikkszám és Excel import a meglévő Shoprenter boltodra, magyar support.",
    pains: [
      "Szezon rövid — admin lassúság közvetlenül bevételkiesés.",
      "Kiszedési egység (zsák, bigbag) telefonon félreértés.",
      "Régiós viszonteladók külön áron — csoportkezelés kell.",
    ],
    closing:
      "Tömeges ármódosítás és csoport % a portálon — szezon eleji árfrissítés órák, nem napok.",
  },
  {
    slug: "gepipari-alkatresz",
    footerLabel: "Gépipari alkatrész",
    h1: "Gépipari alkatrész nagyker: projektlista → ellenőrzött kosár",
    metaTitle: "B2B gyors rendelés gépipari alkatrész nagykereskedőknek | ProGate",
    metaDescription:
      "Ipari alkatrész és MRO nagyker Shoprenterhez: SKU gyors rendelés, partnerár, B2B portál.",
    intro:
      "Karbantartó és termelő cég cikkszám-listát küld — csapágy, szíj, szenzor. A ProGate nem ERP; a rendelés felvételt gyorsítja a webshopon.",
    pains: [
      "Projekt-specifikus ár csak pár partnernek — könnyű elrontani kézi bevitelnél.",
      "Kritikus alkatrész készlet kérdés — késői visszajelzés drága.",
      "Ugyanaz a cikk hetente — felesleges újra gépelni.",
    ],
    closing:
      "Rendeléstörténet a widgetben: a karbantartó visszanézi, mit rendelt múlt hónapban.",
  },
  {
    slug: "muanyag-csomagolas-nagyker",
    footerLabel: "Műanyag és csomagolás",
    h1: "Csomagolóanyag nagyker: raklap és tekercs mennyiség, gyors lista",
    metaTitle: "B2B gyors rendelés csomagolóanyag nagykereskedőknek | ProGate",
    metaDescription:
      "Műanyag és csomagolás nagyker Shoprenteren: viszonteladói gyors rendelés, partnerár, SKU.",
    intro:
      "Fólia, doboz, ragasztó — a gyártó tudja a cikkszámot és a raklapmennyiséget. Self-serve rendelés a Shoprenter boltodon, te pedig a portálon irányítasz.",
    pains: [
      "Egyedi méret és standard készlet keveredik egy listában.",
      "Fuvar előtt kell a végleges tétel — e-mail kör lassít.",
      "Alacsony margin — az admin idő költség közvetlenül nyeli a hasznot.",
    ],
    closing:
      "Kevesebb admin = több idő új viszonteladóra — pont erre való a gyors rendelés réteg.",
  },
  {
    slug: "textil-nagyker",
    footerLabel: "Textil nagyker",
    h1: "Textil nagyker: futó méter, színkód — lista, nem katalóguslapozás",
    metaTitle: "B2B gyors rendelés textil nagykereskedőknek | ProGate",
    metaDescription:
      "Textil és szövet nagyker Shoprenterhez: B2B gyors rendelés, partnerár, viszonteladói self-serve.",
    intro:
      "A varrodá és a viszonteladó szín- és cikkszám szerint rendel — nem hero fotókat néz. Gyors rendelés widget + partnerár motor a meglévő boltodra.",
    pains: [
      "Minimum rendelés fm-ben — hibás bevitel drága visszaküldés.",
      "Kifutó szín készlet kérdés — késői válasz elveszített megrendelés.",
      "Szezonális kollekcióváltás: minden partnernek új PDF helyett online lista jobb.",
    ],
    closing:
      "Shoprenter-natív kosár — a textil is ugyanazzal a checkout flow-val megy, amit már ismersz.",
  },
  {
    slug: "disztributorok",
    footerLabel: "Disztribútorok",
    h1: "Disztribútor: több márka, egy portál — viszonteladói self-serve",
    metaTitle: "B2B gyors rendelés disztribútoroknak Shoprenteren | ProGate",
    metaDescription:
      "Disztribútor és import nagyker: gyors rendelés, partnerár, csoportok, riport. Shoprenter B2B réteg.",
    intro:
      "Több beszállító, egy webshop — a viszonteladó márkát kever a listában, te pedig cikkszám alapján feloldod. A ProGate erre a disztribútor-modellre épül.",
    pains: [
      "Partnerbázis nő, admin csapat nem — szűk keresztmetszet.",
      "Külön ár márkánként és régiónként — Excel pokol.",
      "Nem tudod, ki hanyatlik el (csendes churn) — ritkább rendelés online.",
    ],
    closing:
      "Vevő 360 a portálon: forgalom trend, csoport, utolsó widget rendelés.",
  },
  {
    slug: "gyartok-viszonteladoi",
    footerLabel: "Gyártók viszonteladói",
    h1: "Gyártói nagyker: saját Shoprenter bolt, partner self-serve rendelés",
    metaTitle: "B2B gyors rendelés gyártói viszonteladói hálózatnak | ProGate",
    metaDescription:
      "Gyártó webshopja Shoprenteren: viszonteladói gyors rendelés, partnerár, automatizmus. ProGate B2B réteg.",
    intro:
      "Gyártóként a saját boltodra akarsz B2B-t — nem marketplace-re. A ProGate réteg: partnerár, gyors lista, riport; a márka és a checkout a tiéd marad.",
    pains: [
      "Viszonteladói hálózat országos — telefonos rendelés skálázhatatlan.",
      "Új partner bevezetés: árlista e-mail helyett azonnali belépés jobb.",
      "Saját márka widget opció — a gyártó neve látszik, nem a szoftveré.",
    ],
    closing:
      "Saját márka csomag: ProGate felirat elrejthető a widgeten — a partnered a te boltodat látja.",
  },
] as const;

const bySlug = new Map<string, ProGateVertical>(
  PROGATE_VERTICALS.map((v) => [v.slug, v]),
);

export function getVerticalBySlug(slug: string): ProGateVertical | undefined {
  return bySlug.get(slug);
}

export function getAllVerticalSlugs(): string[] {
  return PROGATE_VERTICALS.map((v) => v.slug);
}

export function getFeaturedVerticals(): ProGateVertical[] {
  return PROGATE_VERTICALS.filter((v) => v.featured);
}
