import type { HelpArticleMeta, HelpCategory } from "@/lib/help/types";

/**
 * Merchant súgó katalógus.
 * Új cikk: status = "draft" → szöveg jóváhagyás → .md fájl → status = "published".
 * Vázlatok: docs/HELP_CONTENT_PLAN.md
 */
export const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: "kezdes",
    label: "Első lépések",
    description: "Bolt összekötés, szinkron, widget bekapcsolás.",
    order: 1,
  },
  {
    id: "widget",
    label: "Widget a boltban",
    description: "Script, gyors rendelés, Excel és CSV.",
    order: 2,
  },
  {
    id: "arazas",
    label: "Partnerárak",
    description: "Csoportár, fix ár, mennyiségi sáv.",
    order: 3,
  },
  {
    id: "vevok",
    label: "Vevők és automatizmus",
    description: "Partnercsoportok, szintlépés, riport.",
    order: 4,
  },
  {
    id: "elofizetes",
    label: "Előfizetés",
    description: "Próba, csomag, számlázás.",
    order: 5,
  },
  {
    id: "hibak",
    label: "Hibaelhárítás",
    description: "Gyakori problémák és megoldások.",
    order: 6,
  },
];

export const HELP_ARTICLES: HelpArticleMeta[] = [
  {
    slug: "udvozlo",
    categoryId: "kezdes",
    title: "Üdv a Tudásbázisban",
    summary: "Hol találod a súgót, és hogyan kérhetsz segítséget.",
    order: 0,
    status: "published",
    keywords: ["súgó", "help", "kezdés"],
  },
  {
    slug: "bolt-osszekotes",
    categoryId: "kezdes",
    title: "Bolt összekötése (Shoprenter API)",
    summary: "API név és jelszó beállítása, első ping.",
    order: 1,
    status: "published",
    keywords: ["api", "shoprenter", "beállítások", "ping"],
    related: ["termek-szinkron"],
    appRoutes: ["/settings"],
  },
  {
    slug: "termek-szinkron",
    categoryId: "kezdes",
    title: "Termékek szinkronizálása",
    summary: "Mennyi ideig tart, mit jelent a katalógus állapot.",
    order: 2,
    status: "published",
    keywords: ["sync", "katalógus", "termék"],
    related: ["bolt-osszekotes", "widget-bekapcsolas"],
    appRoutes: ["/settings", "/home"],
  },
  {
    slug: "widget-bekapcsolas",
    categoryId: "kezdes",
    title: "Gyors rendelés bekapcsolása",
    summary: "Widget engedélyezése a portálon és a boltban.",
    order: 3,
    status: "published",
    keywords: ["widget", "gyors rendelés", "fab"],
    related: ["script-telepites"],
    appRoutes: ["/widget", "/home"],
  },
  {
    slug: "script-telepites",
    categoryId: "widget",
    title: "Script telepítése a Shoprenter boltban",
    summary: "Snippet másolása, apiBase, hard refresh.",
    order: 1,
    status: "published",
    keywords: ["script", "footer", "telepítés"],
    related: ["widget-bekapcsolas", "widget-nem-latszik"],
    appRoutes: ["/widget"],
  },
  {
    slug: "excel-csv-import",
    categoryId: "widget",
    title: "Excel, beillesztés és fotó",
    summary: "Hogyan tölti fel a vevő a listát a widgetben.",
    order: 2,
    status: "published",
    keywords: ["excel", "csv", "cikkszám", "import", "beillesztés", "fotó"],
    related: ["script-telepites"],
  },
  {
    slug: "partnerarak-attekintes",
    categoryId: "arazas",
    title: "Partnerárak — hol kezdd?",
    summary: "Link az árazás útmutatóhoz és a /arak felülethez.",
    order: 1,
    status: "published",
    keywords: ["ár", "partnerár", "csoport"],
    related: [],
    appRoutes: ["/arak", "/arak/utmutato"],
  },
  {
    slug: "vevok-es-szintlepes",
    categoryId: "vevok",
    title: "Vevők és automatizmus",
    summary: "Csoportok, szintlépés szabályok, dry-run.",
    order: 1,
    status: "draft",
    keywords: ["vevő", "automatizmus", "szintlépés"],
    appRoutes: ["/vevok", "/automatizmus"],
  },
  {
    slug: "proba-es-csomag",
    categoryId: "elofizetes",
    title: "Próbaidő és előfizetés",
    summary: "14 napos próba, csomagok, mailto aktiválás.",
    order: 1,
    status: "draft",
    keywords: ["próba", "csomag", "előfizetés"],
    appRoutes: ["/csomag"],
  },
  {
    slug: "widget-nem-latszik",
    categoryId: "hibak",
    title: "A widget nem jelenik meg a boltban",
    summary: "Ellenőrzőlista: script, bekapcsolás, cache.",
    order: 1,
    status: "published",
    keywords: ["hiba", "widget", "nem látszik"],
    related: ["script-telepites", "widget-bekapcsolas"],
  },
  {
    slug: "sync-nem-kesz",
    categoryId: "hibak",
    title: "A szinkron nem készül el",
    summary: "API hiba, ping, katalógus állapot.",
    order: 2,
    status: "draft",
    keywords: ["sync", "hiba", "katalógus"],
    related: ["bolt-osszekotes", "termek-szinkron"],
  },
];

export function getHelpCategory(id: string): HelpCategory | undefined {
  return HELP_CATEGORIES.find((c) => c.id === id);
}

export function listPublishedArticles(): HelpArticleMeta[] {
  return HELP_ARTICLES.filter((a) => a.status === "published").sort(
    (a, b) => a.order - b.order,
  );
}

export function getArticleMeta(slug: string): HelpArticleMeta | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}

export function listArticlesByCategory(categoryId: string): HelpArticleMeta[] {
  return HELP_ARTICLES.filter(
    (a) => a.categoryId === categoryId && a.status === "published",
  ).sort((a, b) => a.order - b.order);
}

export function getArticlesForAppRoute(pathname: string): HelpArticleMeta[] {
  return HELP_ARTICLES.filter(
    (a) =>
      a.status === "published" &&
      a.appRoutes?.some(
        (r) => pathname === r || pathname.startsWith(`${r}/`),
      ),
  );
}
