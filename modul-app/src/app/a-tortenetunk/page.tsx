import { redirect } from 'next/navigation'

/** Régi „A történetünk” URL — az oldal megszűnt. */
export default function OurStoryRemovedRedirect() {
  redirect('/')
}
