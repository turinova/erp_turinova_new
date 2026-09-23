import type { Metadata } from 'next'
import OptiLabClient from './OptiLabClient'

export const metadata: Metadata = {
  title: 'Opti Lab'
}

export default function OptiLabPage() {
  return <OptiLabClient />
}
