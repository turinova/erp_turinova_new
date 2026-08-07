export type TeamMember = {
  id: string
  name: string
  role: string
  roleShort: string
  bio: string
  /** Empty = do not show email on contact cards */
  email: string
  imageSrc: string
  imageAlt: string
  tier: "lead" | "project" | "site"
}

export const CONTACT_TEAM: TeamMember[] = [
  {
    id: "mezo-robert",
    name: "Mező Róbert",
    role: "Ügyvezető",
    roleShort: "Ügyvezető",
    bio: "Vállalati felelősség és partnerek kapcsolata.",
    email: "mezo.robert@baugeneral.hu",
    imageSrc: "/img/team/mezo-robert.png",
    imageAlt: "Mező Róbert, ügyvezető, BauGenerál Kft.",
    tier: "lead",
  },
  {
    id: "gyorke-gabor",
    name: "Győrke Gábor",
    role: "Építésvezető",
    roleShort: "Építésvezető",
    bio: "Projekt egyeztetés, határidők és szakágak koordinációja.",
    email: "gyorke.gabor@baugeneral.hu",
    imageSrc: "/img/team/gyorke-gabor.png",
    imageAlt: "Győrke Gábor, építésvezető, BauGenerál Kft.",
    tier: "project",
  },
  {
    id: "toth-ferenc",
    name: "Tóth Ferenc",
    role: "Építésvezető",
    roleShort: "Építésvezető",
    bio: "Projekt egyeztetés, határidők és szakágak koordinációja.",
    email: "toth.ferenc@baugeneral.hu",
    imageSrc: "/img/team/toth-ferenc.png",
    imageAlt: "Tóth Ferenc, építésvezető, BauGenerál Kft.",
    tier: "project",
  },
  {
    id: "baranyi-richard",
    name: "Baranyi Richárd",
    role: "Művezető",
    roleShort: "Művezető",
    bio: "Kivitelezés a helyszínen, minőség és ütemezés.",
    email: "",
    imageSrc: "/img/team/baranyi-richard.png",
    imageAlt: "Baranyi Richárd, művezető, BauGenerál Kft.",
    tier: "site",
  },
]

export type ContactFaqItem = {
  id: string
  q: string
  a: string
}

export const CONTACT_FAQ: readonly ContactFaqItem[] = [
  {
    id: "indulas",
    q: "Hogyan indul egy megkeresés?",
    a: "Töltse ki az űrlapot: név, e-mail, telefon, projekt típus és pár mondat. E-mailben válaszolunk, és onnan folytatjuk.",
  },
  {
    id: "uzenet",
    q: "Mit írjon az első üzenetben?",
    a: "Írja meg a helyszínt, a nagyságrendet, a határidőt, és hogy van-e már terv. Pár mondat is elég.",
  },
  {
    id: "munkakor",
    q: "Milyen munkát vállal a BauGenerál?",
    a: "Ipari épület, társasház, családi ház, középület, felújítás. Az első beszélgetésen tisztázzuk a részleteket. Részletek a szolgáltatások oldalakon.",
  },
  {
    id: "terulet",
    q: "Mely területeken vállalnak kivitelezést?",
    a: "Bács-Kiskun és Pest megyében, valamint a Balaton környékén. Székhely: Kecskemét. Pest megyei fókusz: generálkivitelezés Pest megyében oldal.",
  },
  {
    id: "telefon",
    q: "Van publikus telefonszám?",
    a: "Nem. Megkeresést az űrlapon vagy e-mailben várunk (mezo.david@baugeneral.hu). Válaszunkat e-mailben küldjük.",
  },
  {
    id: "terv",
    q: "Kell már terv vagy építési engedély?",
    a: "Nem minden esetben. Felújításnál gyakran elég a leírás. Új építésnél általában kell dokumentáció. Megírjuk, mi hiányzik.",
  },
  {
    id: "ar",
    q: "Hogyan alakul ki az ajánlati ár?",
    a: "Attól függ, mit kér, milyen minőségben és mikorra. Ha látjuk a feladatot, írásos ajánlatot készítünk. Nincs publikus m²-ár a weboldalon.",
  },
  {
    id: "szemelyes",
    q: "Lehetséges személyes egyeztetés a telephelyen?",
    a: "Igen, előre egyeztetett időpontban a kecskeméti telephelyen (Mindszenti krt. 10.). Írjon először, és megbeszéljük, mikor tud jönni.",
  },
]

export const PROJECT_TYPE_OPTIONS = [
  { value: "ipari", label: "Ipari épület" },
  { value: "kozepulet", label: "Középület" },
  { value: "tarshaz", label: "Társasház" },
  { value: "csaladi", label: "Családi ház" },
  { value: "felujitas", label: "Felújítás" },
  { value: "szakagi", label: "Szakági munka" },
  { value: "egyeb", label: "Egyéb" },
] as const
