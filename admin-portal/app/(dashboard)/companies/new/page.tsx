import React from 'react'
import type { Metadata } from 'next'
import CompanyNewClient from './CompanyNewClient'

export const metadata: Metadata = {
  title: 'Új cég hozzáadása'
}

export default function CompanyNewPage() {
  return <CompanyNewClient />
}

