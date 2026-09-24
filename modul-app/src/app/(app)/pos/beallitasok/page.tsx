import { redirect } from 'next/navigation'

/** Legacy route → POS dialógus deep link. */
export default function PosSettingsRedirectPage() {
  redirect('/pos?beallitasok=1')
}
