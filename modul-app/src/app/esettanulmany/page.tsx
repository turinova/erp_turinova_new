import { redirect } from 'next/navigation'

/** Régi case study URL — a tartalom a lapszabászat landingen van. */
export default function CaseStudyIndexRedirect() {
  redirect('/lapszabaszat')
}
