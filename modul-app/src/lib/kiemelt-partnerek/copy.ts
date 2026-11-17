/** Plain-language UI szövegek — ügyvezető / asztalos üzem. */

export const KIEMELT_COPY = {
  pageTitle: 'Kiemelt partnerek',
  pageDescription: (n: number) =>
    n === 0
      ? 'Itt a csillaggal jelölt partnerek forgalma látszik'
      : `${n} kiemelt partner · lapszabászat forgalom`,
  searchPlaceholder: 'Keresés név szerint…',
  searchAria: 'Partner keresés',

  overviewTitle: 'Áttekintés',
  overviewLink: 'Ügyfelek →',
  metricFavorites: 'Kedvencek',
  metricFavoritesHint: 'csillaggal jelölve',
  metricMonthly: 'Kb. ennyi / hónap',
  metricMonthlyHint: 'összes kedvenc',
  metricSilent: 'Rég nem rendelt',
  metricSilentHint: '30 napnál régebben',
  metricOpen: 'Folyamatban',
  metricOpenHint: 'gyártás vagy kész',

  chartTitle: 'Bevétel hónapról hónapra',
  chartYtd: 'Idén eddig',
  chartEmpty: 'Ebben az évben még nincs megrendelés.',
  chartTooltip: 'Bevétel',
  chartPriorDelta: (pct: number, priorYear: number) => {
    const sign = pct > 0 ? '+' : ''
    return `Tavaly ilyenkorhoz képest: ${sign}${pct}% (${priorYear})`
  },
  chartPriorNew: (priorYear: number) =>
    `Tavaly ilyenkorhoz képest új forgalom (${priorYear})`,
  chartNoPrior: 'Nincs tavalyi adat összehasonlításhoz',

  sortAria: 'Rendezés',
  sortAvg: 'Legnagyobb havi átlag',
  sortLast: 'Legutóbbi rendelés',
  sortCutting: 'Legtöbb szabás (90 nap)',
  sortName: 'Név',

  filterAll: 'Mindenki',
  filterActive: 'Mostanában rendelt',
  filterSilent: 'Rég nem rendelt',
  filterDown: 'Csökken a forgalma',

  emptyFilteredTitle: 'Nincs találat',
  emptyFilteredHint: 'Próbálj más keresést vagy szűrőt.',
  emptyNoneTitle: 'Még nincs kiemelt partner',
  emptyNoneHint: 'Az Ügyfelek listán jelöld csillaggal, akit figyelnél.',
  emptyCta: 'Ügyfelek megnyitása',

  cardMonthlySuffix: '/ hónap',
  cardTrendUp: (pct: number) => `Növekszik +${pct}%`,
  cardTrendDown: (pct: number) => `Csökken −${Math.abs(pct)}%`,
  cardTrendFlat: 'Változatlan',
  cardTrendNone: '—',
  cardNeverOrdered: 'Még nem rendelt',
  cardLastToday: 'ma',
  cardLastDays: (n: number) => (n === 1 ? '1 napja' : `${n} napja`),
  cardOpen: (n: number) =>
    n === 1 ? '1 folyamatban' : `${n} folyamatban`,
  cardBadgeSilent: 'Rég nem',
  cardBadgeDown: 'Csökken',
  cardBadgeUp: 'Növekszik'
} as const

export const TREND_DOWN_THRESHOLD = -20
export const TREND_UP_THRESHOLD = 20
export const TOP3_SHARE_THRESHOLD = 0.6
