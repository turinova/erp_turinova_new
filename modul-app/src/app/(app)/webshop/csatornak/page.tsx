import { redirect } from 'next/navigation'

/** Régi Csatornák menü → Bolt beállítások · Domain fül. */
export default function WebshopCsatornakRedirectPage() {
  redirect('/webshop/beallitasok?tab=domain')
}
