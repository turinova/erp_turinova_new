import React from 'react'
import type { Metadata } from 'next'
import ScannerClient from './ScannerClient'

export const metadata: Metadata = {
  title: 'Scanner'
}

export default function ScannerPage() {
  return <ScannerClient />
}
