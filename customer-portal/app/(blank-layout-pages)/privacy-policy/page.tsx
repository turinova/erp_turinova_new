import { redirect } from 'next/navigation'

/** Legacy URL → /adatkezeles (also covered by next.config redirect). */
export default function PrivacyPolicyRedirect() {
  redirect('/adatkezeles')
}
