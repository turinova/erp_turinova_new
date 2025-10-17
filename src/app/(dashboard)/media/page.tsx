import React from 'react'
import MediaClient from './MediaClient'
import { getAllMediaFiles } from '@/lib/supabase-server'

// Server-side rendered Media page
export default async function MediaPage() {
  const startTime = performance.now()
  
  // Fetch media files on server-side for better performance
  const initialMediaFiles = await getAllMediaFiles()
  
  const totalTime = performance.now() - startTime
  console.log(`[PERF] Media Page SSR: ${totalTime.toFixed(2)}ms`)
  
  return <MediaClient initialMediaFiles={initialMediaFiles} />
}

