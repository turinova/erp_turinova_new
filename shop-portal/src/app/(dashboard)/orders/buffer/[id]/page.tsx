import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

/** Buffer detail page removed: all info is in the list (Teljesíthetőség popover). Redirect to list. */
export default async function OrderBufferDetailPage({ params }: PageProps) {
  await params
  redirect('/orders/buffer')
}
