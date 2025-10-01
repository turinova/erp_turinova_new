import React from 'react'
import MediaClient from './MediaClient'

// Server-side rendered Media page
export default async function MediaPage() {
  // Media files will be fetched client-side via API to handle Supabase storage properly
  return <MediaClient />
}

