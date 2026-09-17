import { redirect } from 'next/navigation'

/** Legacy URL — a marketing főoldal a /. */
export default function ComingSoonRedirectPage() {
  redirect('/')
}
