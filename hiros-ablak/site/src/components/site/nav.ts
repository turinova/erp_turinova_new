export const NAV_ITEMS = [
  {
    href: "/szolgaltatasok/lapszabaszat-es-elzaras",
    label: "Szolgáltatások",
    children: [
      { href: "/szolgaltatasok/lapszabaszat-es-elzaras", label: "Lapszabászat és élzárás" },
      { href: "/szolgaltatasok/online-lapszabaszat", label: "Online lapszabászat" },
      { href: "/szolgaltatasok/nettfront", label: "NettFront" },
      { href: "/szolgaltatasok/ipari-megoldasok/szallitolada-keszites", label: "Szállítóláda készítés" },
    ],
  },
  {
    href: "/butorlap",
    label: "Anyagkatalógus",
    children: [
      { href: "/butorlap", label: "Bútorlap" },
      { href: "/munkalap", label: "Munkalap" },
    ],
  },
  { href: "/barkacsaruhaz-kecskemet", label: "Üzletünk" },
  { href: "/kapcsolat", label: "Kapcsolat" },
] as const
