/**
 * Elérhető stock fotók a public/img mappából.
 * TODO: cserélje valódi projektfotókra go-live előtt.
 */
export const REFERENCE_STOCK = {
  ipariHero: "/img/szolgaltatasok/ipari-epuletek.jpg",
  ipariNav: "/img/nav/ipari-epuletek.jpg",
  munka: "/img/rolunk/hero-work.jpg",
  telephely: "/img/rolunk/telephely.jpg",
  kozepulet: "/img/nav/kozepuletek.jpg",
  csaladi: "/img/nav/csaladi-haz.jpg",
  felujitas: "/img/nav/felujitas.jpg",
  kapcsolatHero: "/img/kapcsolat/hero.jpg",
  telephelyPng: "/img/kapcsolat/telephely.png",
  houseHero: "/img/hero/house.jpg",
  skyBack: "/img/hero/back.jpg",
} as const

export type StockImageKey = keyof typeof REFERENCE_STOCK

export type StockImage = {
  src: string
  alt: string
}

/** Stock fotó — ugyanaz a fájl több galériaelemben is használható, más alt szöveggel */
export function stock(key: StockImageKey, alt: string): StockImage {
  return { src: REFERENCE_STOCK[key], alt }
}
