import { redirect } from 'next/navigation'

/** Archiválva: POS használat riport — redirect az értékesítések listára. */
export default function PosHasznalatArchivedPage() {
  redirect('/ertekesitesek')
}
