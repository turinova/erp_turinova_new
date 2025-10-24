import React from 'react'
import type { Metadata } from 'next'
import SearchClient from './SearchClient'

export const metadata: Metadata = {
  title: 'Kereső'
}

export default function SearchPage() {
  return <SearchClient />
}
