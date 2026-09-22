import { redirect } from 'next/navigation'

/** Régi URL — a tartalom most: /lapszabaszat */
export default function HirosCaseStudyRedirect() {
  redirect('/lapszabaszat')
}
