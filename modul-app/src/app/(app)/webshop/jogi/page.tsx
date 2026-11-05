import { redirect } from 'next/navigation'

/** Régi generált jogi admin → Bolt beállítások · Jogi (Fogyasztó Barát). */
export default function WebshopJogiRedirectPage() {
  redirect('/webshop/beallitasok?tab=jogi')
}
