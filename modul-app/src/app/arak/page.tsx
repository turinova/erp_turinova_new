import { redirect } from 'next/navigation'

import { WAITLIST_HREF } from '@/lib/marketing/nav'

/** Publikus árak jegelve 2027 Q2-ig — várólista a főoldalon. */
export default function PricingRedirectPage() {
  redirect(WAITLIST_HREF)
}
