import { redirect } from 'next/navigation'

export default async function RootPage() {
  // Redirect root page directly to login
  redirect('/login')
}
