/** Belső felhasználó (építésvezető) — később valódi auth sessionből */
export interface AppUser {
  id: string
  email: string
  displayName: string
}
