#!/usr/bin/env node
/**
 * Riex főképek tömeges feltöltése → tenant-media + media_files + accessories.image_url
 *
 * Usage:
 *   node --env-file=.env.local scripts/upload-riex-fokepek.mjs
 *   node --env-file=.env.local scripts/upload-riex-fokepek.mjs --limit 50
 *   node --env-file=.env.local scripts/upload-riex-fokepek.mjs --concurrency 6 --no-link
 */

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DEFAULT_DIR = path.join(ROOT, 'transfer', 'riex-media-fokepek')
const PROGRESS_PATH = path.join(ROOT, 'transfer', 'riex-fokepek-upload-progress.json')

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const TENANT =
  process.env.SPEED_TEST_TENANT_ID ||
  process.env.UPLOAD_TENANT_ID ||
  '45dd7c02-28e9-4f4a-b74c-704f63437927'
const BUCKET = 'tenant-media'

const args = process.argv.slice(2)
function flag(name) {
  return args.includes(`--${name}`)
}
function opt(name, fallback) {
  const i = args.indexOf(`--${name}`)
  if (i < 0) return fallback
  return args[i + 1] ?? fallback
}

const DIR = path.resolve(opt('dir', DEFAULT_DIR))
const LIMIT = Number(opt('limit', Infinity))
const CONCURRENCY = Math.max(1, Number(opt('concurrency', 8)))
const LINK = !flag('no-link')
const DRY = flag('dry-run')

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function isTransient(msg) {
  return /too many connections|internal server error|timeout|timed out|fetch failed|network|rate limit|429|500|502|503|504|gateway|ECONNRESET|ETIMEDOUT/i.test(
    msg ?? ''
  )
}

async function withRetry(fn, tries = 6) {
  let last
  for (let t = 0; t < tries; t++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      const msg = e?.message ?? String(e)
      if (!isTransient(msg) || t === tries - 1) throw e
      await sleep(Math.min(40_000, 1500 * 2 ** t))
    }
  }
  throw last
}

async function pool(items, size, fn) {
  let i = 0
  let done = 0
  const errors = []
  const workers = Array.from({ length: size }, async () => {
    while (i < items.length) {
      const idx = i++
      const item = items[idx]
      try {
        await fn(item, idx)
      } catch (e) {
        errors.push({ file: item.name, error: e?.message ?? String(e) })
      }
      done++
      if (done % 50 === 0 || done === items.length) {
        console.log(`  progress ${done}/${items.length} (errors=${errors.length})`)
      }
    }
  })
  await Promise.all(workers)
  return errors
}

async function loadProgress() {
  try {
    const raw = await fs.readFile(PROGRESS_PATH, 'utf8')
    return JSON.parse(raw)
  } catch {
    return { uploaded: {}, linked: {}, failed: {} }
  }
}

async function saveProgress(p) {
  await fs.writeFile(PROGRESS_PATH, JSON.stringify(p, null, 2))
}

async function main() {
  if (!URL || !SERVICE) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const sb = createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  const entries = (await fs.readdir(DIR))
    .filter((n) => !n.startsWith('._') && /\.jpe?g$/i.test(n))
    .sort()
    .slice(0, Number.isFinite(LIMIT) ? LIMIT : undefined)
    .map((name) => ({
      name,
      sku: name.replace(/\.[^.]+$/, '').toUpperCase(),
      abs: path.join(DIR, name)
    }))

  console.log(`Dir: ${DIR}`)
  console.log(`Tenant: ${TENANT}`)
  console.log(`Files: ${entries.length}  concurrency=${CONCURRENCY}  link=${LINK}  dry=${DRY}`)

  const progress = await loadProgress()

  // meglévő media fájlnevek
  const existing = new Set()
  {
    const page = 1000
    for (let from = 0; ; from += page) {
      const { data, error } = await sb
        .from('media_files')
        .select('original_filename, public_url')
        .eq('tenant_id', TENANT)
        .range(from, from + page - 1)
      if (error) throw error
      for (const r of data ?? []) {
        existing.add(String(r.original_filename).toLowerCase())
        progress.uploaded[String(r.original_filename).toLowerCase()] = r.public_url
      }
      if (!data || data.length < page) break
    }
  }
  console.log(`Already in media_files: ${existing.size}`)

  const toUpload = entries.filter(
    (e) => !existing.has(e.name.toLowerCase()) && !progress.uploaded[e.name.toLowerCase()]
  )
  console.log(`To upload: ${toUpload.length}`)

  if (!DRY && toUpload.length > 0) {
    const errors = await pool(toUpload, CONCURRENCY, async (item) => {
      const buf = await fs.readFile(item.abs)
      const stored = `${randomUUID()}_${item.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const storagePath = `${TENANT}/${stored}`

      await withRetry(async () => {
        const { error } = await sb.storage.from(BUCKET).upload(storagePath, buf, {
          contentType: 'image/jpeg',
          upsert: false,
          cacheControl: '3600'
        })
        if (error && !/already exists|duplicate/i.test(error.message)) {
          throw new Error(error.message)
        }
      })

      const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(storagePath)
      const publicUrl = urlData.publicUrl

      await withRetry(async () => {
        const { error } = await sb.from('media_files').insert({
          tenant_id: TENANT,
          original_filename: item.name,
          stored_filename: stored,
          storage_path: storagePath,
          public_url: publicUrl,
          size_bytes: buf.length,
          mime_type: 'image/jpeg',
          created_by: null
        })
        if (error && !/media_files_tenant_filename|duplicate/i.test(error.message)) {
          await sb.storage.from(BUCKET).remove([storagePath])
          throw new Error(error.message)
        }
      })

      progress.uploaded[item.name.toLowerCase()] = publicUrl
      delete progress.failed[item.name]
      if (Object.keys(progress.uploaded).length % 25 === 0) {
        await saveProgress(progress)
      }
    })

    await saveProgress(progress)
    if (errors.length) {
      for (const e of errors) progress.failed[e.file] = e.error
      await saveProgress(progress)
      console.log(`Upload errors: ${errors.length}`)
      console.log(errors.slice(0, 10))
    }
  }

  if (!LINK) {
    console.log('Skip link (--no-link)')
    return
  }

  // SKU → public_url map from progress + just uploaded
  const bySku = new Map()
  for (const e of entries) {
    const url = progress.uploaded[e.name.toLowerCase()]
    if (url) bySku.set(e.sku, url)
  }
  console.log(`Link candidates: ${bySku.size}`)

  if (DRY) {
    console.log('Dry-run: no DB updates')
    return
  }

  // Batch update accessories by sku
  const skus = [...bySku.keys()]
  let linked = 0
  let missing = 0
  const BATCH = 80
  for (let i = 0; i < skus.length; i += BATCH) {
    const chunk = skus.slice(i, i + BATCH)
    const { data: rows, error } = await sb
      .from('accessories')
      .select('id, sku, image_url')
      .eq('tenant_id', TENANT)
      .is('deleted_at', null)
      .in('sku', chunk)
    if (error) throw error

    const found = new Set((rows ?? []).map((r) => String(r.sku).toUpperCase()))
    for (const sku of chunk) if (!found.has(sku)) missing++

    const updates = (rows ?? []).filter((r) => {
      const want = bySku.get(String(r.sku).toUpperCase())
      return want && r.image_url !== want
    })

    for (const row of updates) {
      const url = bySku.get(String(row.sku).toUpperCase())
      await withRetry(async () => {
        const { error: uErr } = await sb
          .from('accessories')
          .update({ image_url: url })
          .eq('id', row.id)
          .eq('tenant_id', TENANT)
        if (uErr) throw new Error(uErr.message)
      })
      linked++
      progress.linked[String(row.sku).toUpperCase()] = url
    }

    if ((i / BATCH) % 5 === 0) {
      console.log(`  link progress ${Math.min(i + BATCH, skus.length)}/${skus.length} linked=${linked}`)
      await saveProgress(progress)
    }
  }

  await saveProgress(progress)
  console.log(`Done. uploaded_map=${Object.keys(progress.uploaded).length} linked=${linked} sku_missing=${missing} failed=${Object.keys(progress.failed).length}`)
  console.log(`Progress file: ${PROGRESS_PATH}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
