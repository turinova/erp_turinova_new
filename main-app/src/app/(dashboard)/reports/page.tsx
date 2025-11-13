import React from 'react'
import type { Metadata } from 'next'
import ReportsClient from './ReportsClient'

export const metadata: Metadata = {
  title: 'Riportok'
}

export default function ReportsPage() {
  return <ReportsClient />
}

