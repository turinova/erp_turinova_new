import React from 'react'
import { getAllLinearMaterials } from '@/lib/supabase-server'
import LinearMaterialsListClient from './LinearMaterialsListClient'

export default async function LinearMaterialsPage() {
  const startTime = performance.now()
  const linearMaterials = await getAllLinearMaterials()
  const totalTime = performance.now() - startTime
  
  console.log(`[PERF] Linear Materials Page SSR: ${totalTime.toFixed(2)}ms`)

  return <LinearMaterialsListClient initialLinearMaterials={linearMaterials} />
}
