import React from 'react'
import type { Metadata } from 'next'
import ProductSuggestionsClient from './ProductSuggestionsClient'

export const metadata: Metadata = {
  title: 'Termék javaslatok'
}

export default function ProductSuggestionsPage() {
  return <ProductSuggestionsClient />
}


