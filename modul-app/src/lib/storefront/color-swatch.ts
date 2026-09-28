/**
 * Kártya-színminta a szín jellemző értékéből („matt fekete” → #1f1f1f).
 * Csak felismert név kap pöttyöt; ismeretlen értéknél a kártya a szöveges jelzésre esik vissza.
 */

const RULES: [RegExp, string][] = [
  [/antracit|grafit/, '#3b3d40'],
  [/fekete|black/, '#1f1f1f'],
  [/feh[eé]r|white/, '#f4f4f2'],
  [/sz[uü]rke|grey|gray/, '#8d9096'],
  [/inox|rozsdamentes|nemesac[eé]l|ac[eé]l/, '#b9bcc1'],
  [/kr[oó]m/, '#d3d6da'],
  [/nikkel/, '#a9a79f'],
  [/ez[uü]st|silver|elox[aá]lt|alum[ií]nium/, '#c4c7cb'],
  [/s[aá]rgar[eé]z|brass/, '#b59a4a'],
  [/r[eé]z|copper/, '#b06f45'],
  [/bronz/, '#80613c'],
  [/arany|gold/, '#c8a24c'],
  [/pezsg[oő]|champagne/, '#d9c7a3'],
  [/burgundi|bord[oó]/, '#6b1f2b'],
  [/piros|v[oö]r[oö]s|red/, '#b3261e'],
  [/narancs/, '#d9722b'],
  [/s[aá]rga|yellow/, '#e3c33b'],
  [/z[oö]ld|green/, '#3d6b4c'],
  [/k[eé]k|blue/, '#2f5597'],
  [/lila|purple/, '#6c4a8f'],
  [/r[oó]zsaszín|pink/, '#e3a1b4'],
  [/b[eé]zs|homok|cappuccino/, '#d6c3a5'],
  [/di[oó]|wenge/, '#5a4232'],
  [/t[oö]lgy|b[uü]kk|[eé]ger|feny[oő]|bambusz|juhar|natur/, '#c49a6c'],
  [/mahag[oó]ni|cseresznye/, '#7d3b2c'],
  [/barna|brown/, '#6e4b33']
]

export function swatchColor(label: string): string | null {
  const s = label.toLocaleLowerCase('hu')
  for (const [re, hex] of RULES) if (re.test(s)) return hex
  return null
}
