import type { Metadata } from 'next'

import { getAllCustomers, getAllMaterials } from '@/lib/supabase-server'
import FronttervezoClient from './FronttervezoClient'

export const metadata: Metadata = {
  title: 'Fronttervező'
}

export default async function FronttervezoPage() {
  const [customers, materials] = await Promise.all([getAllCustomers(), getAllMaterials()])

  return <FronttervezoClient initialCustomers={customers} initialMaterials={materials} />
}
