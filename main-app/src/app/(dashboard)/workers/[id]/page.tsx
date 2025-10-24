import React from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getWorkerById } from '@/lib/supabase-server'
import WorkerEditClient from './WorkerEditClient'

interface Worker {
  id: string
  name: string
  nickname: string | null
  mobile: string | null
  color: string | null
  created_at: string
  updated_at: string
}

interface WorkerEditPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: WorkerEditPageProps): Promise<Metadata> {
  const resolvedParams = await params
  const worker = await getWorkerById(resolvedParams.id)
  
  return {
    title: worker ? `Dolgozó - ${worker.name}` : 'Dolgozó'
  }
}

// Server-side rendered worker edit page
export default async function WorkerEditPage({ params }: WorkerEditPageProps) {
  const resolvedParams = await params
  const worker = await getWorkerById(resolvedParams.id)
  
  if (!worker) {
    notFound()
  }
  
  return <WorkerEditClient initialWorker={worker} />
}
