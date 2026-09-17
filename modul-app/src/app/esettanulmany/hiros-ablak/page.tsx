import { redirect } from 'next/navigation'

/** Régi URL — a tartalom most: /a-tortenetunk */
export default function HirosCaseStudyRedirect() {
  redirect('/a-tortenetunk')
}
