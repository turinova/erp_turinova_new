import React from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Szállítmányok'
}

export default function ShipmentsPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Szállítmányok</h1>
    </div>
  )
}


