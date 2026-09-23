/**
 * Local filesystem store for Opti Lab runs & hard fixtures.
 * Intended for local iteration (not Vercel-persistent).
 */
import { promises as fs } from 'fs'
import path from 'path'
import type {
  BatchSummary,
  QuoteCompareResult
} from '@/lib/optimization/compareScores'

const ROOT = process.cwd()
export const RUNS_DIR = path.join(ROOT, 'opti-lab-runs')
export const FIXTURES_DIR = path.join(ROOT, 'opti-lab-fixtures')

export type OptiLabRunMeta = {
  id: string
  label: string
  notes: string
  created_at: string
  baseline: { algorithm: string; sortStrategy: string }
  candidate: { algorithm: string; sortStrategy: string }
  summary: BatchSummary
  quote_count: number
  material_count: number
}

export type OptiLabRun = OptiLabRunMeta & {
  quotes: QuoteCompareResult[]
}

export type OptiLabFixture = {
  id: string
  created_at: string
  source_run_id: string | null
  reason: string
  quote_id: string
  quote_number: string
  customer_name: string | null
  panel_count: number
  outcome: string
  delta_boards: number
  waste_baseline: number
  waste_candidate: number
  materials: QuoteCompareResult['materials']
  /** Job payload for offline re-run (optional). */
  job_materials?: unknown
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

function slugify(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `${ts}-${base || 'run'}`
}

export async function listRuns(): Promise<OptiLabRunMeta[]> {
  await ensureDir(RUNS_DIR)
  const entries = await fs.readdir(RUNS_DIR, { withFileTypes: true })
  const metas: OptiLabRunMeta[] = []
  for (const ent of entries) {
    if (!ent.isDirectory()) continue
    try {
      const raw = await fs.readFile(
        path.join(RUNS_DIR, ent.name, 'meta.json'),
        'utf8'
      )
      metas.push(JSON.parse(raw) as OptiLabRunMeta)
    } catch {
      // skip broken
    }
  }
  return metas.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function loadRun(id: string): Promise<OptiLabRun | null> {
  const dir = path.join(RUNS_DIR, id)
  try {
    const meta = JSON.parse(
      await fs.readFile(path.join(dir, 'meta.json'), 'utf8')
    ) as OptiLabRunMeta
    const quotes = JSON.parse(
      await fs.readFile(path.join(dir, 'quotes.json'), 'utf8')
    ) as QuoteCompareResult[]
    return { ...meta, quotes }
  } catch {
    return null
  }
}

export async function saveRun(input: {
  label: string
  notes?: string
  baseline: OptiLabRunMeta['baseline']
  candidate: OptiLabRunMeta['candidate']
  summary: BatchSummary
  quotes: QuoteCompareResult[]
}): Promise<OptiLabRunMeta> {
  const id = slugify(input.label)
  const dir = path.join(RUNS_DIR, id)
  await ensureDir(dir)

  // Strip placements to keep files lean
  const leanQuotes: QuoteCompareResult[] = input.quotes.map((q) => ({
    ...q,
    materials: q.materials.map((m) => {
      const {
        placements_baseline: _pb,
        placements_candidate: _pc,
        debug_baseline: _db,
        debug_candidate: _dc,
        ...rest
      } = m
      return rest
    })
  }))

  const meta: OptiLabRunMeta = {
    id,
    label: input.label,
    notes: input.notes || '',
    created_at: new Date().toISOString(),
    baseline: input.baseline,
    candidate: input.candidate,
    summary: input.summary,
    quote_count: leanQuotes.length,
    material_count: leanQuotes.reduce((s, q) => s + q.materials.length, 0)
  }

  await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2))
  await fs.writeFile(
    path.join(dir, 'quotes.json'),
    JSON.stringify(leanQuotes)
  )
  return meta
}

export type RunDiffResult = {
  run_a: OptiLabRunMeta
  run_b: OptiLabRunMeta
  summary_delta: {
    win: number
    tie: number
    lose: number
    sum_delta_boards: number
    sum_boards_candidate: number
  }
  improved: Array<{
    quote_id: string
    quote_number: string
    outcome_a: string
    outcome_b: string
    delta_boards_a: number
    delta_boards_b: number
  }>
  regressed: Array<{
    quote_id: string
    quote_number: string
    outcome_a: string
    outcome_b: string
    delta_boards_a: number
    delta_boards_b: number
  }>
  only_in_a: number
  only_in_b: number
}

export async function diffRuns(
  idA: string,
  idB: string
): Promise<RunDiffResult | null> {
  const [a, b] = await Promise.all([loadRun(idA), loadRun(idB)])
  if (!a || !b) return null

  const mapA = new Map(a.quotes.map((q) => [q.quote_id, q]))
  const mapB = new Map(b.quotes.map((q) => [q.quote_id, q]))

  const improved: RunDiffResult['improved'] = []
  const regressed: RunDiffResult['regressed'] = []
  let only_in_a = 0
  let only_in_b = 0

  for (const [id, qa] of mapA) {
    const qb = mapB.get(id)
    if (!qb) {
      only_in_a++
      continue
    }
    const betterBoards = qb.totals.delta_boards < qa.totals.delta_boards
    const worseBoards = qb.totals.delta_boards > qa.totals.delta_boards
    const becameLose =
      qa.totals.outcome !== 'lose' && qb.totals.outcome === 'lose'
    const leftLose =
      qa.totals.outcome === 'lose' && qb.totals.outcome !== 'lose'

    const row = {
      quote_id: id,
      quote_number: qb.quote_number,
      outcome_a: qa.totals.outcome,
      outcome_b: qb.totals.outcome,
      delta_boards_a: qa.totals.delta_boards,
      delta_boards_b: qb.totals.delta_boards
    }

    if (becameLose || worseBoards) regressed.push(row)
    else if (leftLose || betterBoards) improved.push(row)
  }

  for (const id of mapB.keys()) {
    if (!mapA.has(id)) only_in_b++
  }

  return {
    run_a: {
      id: a.id,
      label: a.label,
      notes: a.notes,
      created_at: a.created_at,
      baseline: a.baseline,
      candidate: a.candidate,
      summary: a.summary,
      quote_count: a.quote_count,
      material_count: a.material_count
    },
    run_b: {
      id: b.id,
      label: b.label,
      notes: b.notes,
      created_at: b.created_at,
      baseline: b.baseline,
      candidate: b.candidate,
      summary: b.summary,
      quote_count: b.quote_count,
      material_count: b.material_count
    },
    summary_delta: {
      win: b.summary.win - a.summary.win,
      tie: b.summary.tie - a.summary.tie,
      lose: b.summary.lose - a.summary.lose,
      sum_delta_boards: b.summary.sum_delta_boards - a.summary.sum_delta_boards,
      sum_boards_candidate:
        b.summary.sum_boards_candidate - a.summary.sum_boards_candidate
    },
    improved: improved.sort(
      (x, y) =>
        x.delta_boards_b - x.delta_boards_a - (y.delta_boards_b - y.delta_boards_a)
    ),
    regressed: regressed.sort(
      (x, y) =>
        y.delta_boards_b -
        y.delta_boards_a -
        (x.delta_boards_b - x.delta_boards_a)
    ),
    only_in_a,
    only_in_b
  }
}

export async function exportHardFixtures(input: {
  run_id: string
  max?: number
}): Promise<{ fixtures: OptiLabFixture[]; written: string[] }> {
  const run = await loadRun(input.run_id)
  if (!run) throw new Error('Run not found')

  await ensureDir(FIXTURES_DIR)

  // Prioritize loses, then ties with highest waste, then wins with least improvement
  const ranked = [...run.quotes].sort((a, b) => {
    const rank = (o: string) => (o === 'lose' ? 0 : o === 'tie' ? 1 : 2)
    const ra = rank(a.totals.outcome)
    const rb = rank(b.totals.outcome)
    if (ra !== rb) return ra - rb
    if (a.totals.outcome === 'lose') {
      return b.totals.delta_boards - a.totals.delta_boards
    }
    // high waste ties first
    return b.totals.waste_baseline - a.totals.waste_baseline
  })

  const max = input.max ?? 50
  const selected = ranked.slice(0, max)
  const written: string[] = []
  const fixtures: OptiLabFixture[] = []

  for (const q of selected) {
    const reason =
      q.totals.outcome === 'lose'
        ? 'lose'
        : q.totals.waste_baseline >= 25
          ? 'high_waste'
          : 'hard_sample'

    const fixture: OptiLabFixture = {
      id: `${run.id}__${q.quote_number}`,
      created_at: new Date().toISOString(),
      source_run_id: run.id,
      reason,
      quote_id: q.quote_id,
      quote_number: q.quote_number,
      customer_name: q.customer_name,
      panel_count: q.panel_count,
      outcome: q.totals.outcome,
      delta_boards: q.totals.delta_boards,
      waste_baseline: q.totals.waste_baseline,
      waste_candidate: q.totals.waste_candidate,
      materials: q.materials
    }

    const file = path.join(FIXTURES_DIR, `${fixture.id}.json`)
    await fs.writeFile(file, JSON.stringify(fixture, null, 2))
    written.push(file)
    fixtures.push(fixture)
  }

  // Index
  await fs.writeFile(
    path.join(FIXTURES_DIR, `_index-${run.id}.json`),
    JSON.stringify(
      {
        run_id: run.id,
        created_at: new Date().toISOString(),
        count: fixtures.length,
        fixtures: fixtures.map((f) => ({
          id: f.id,
          quote_number: f.quote_number,
          reason: f.reason,
          outcome: f.outcome,
          delta_boards: f.delta_boards
        }))
      },
      null,
      2
    )
  )

  return { fixtures, written }
}

export async function listFixtures(): Promise<
  Array<{ id: string; quote_number: string; reason: string; outcome: string }>
> {
  await ensureDir(FIXTURES_DIR)
  const files = await fs.readdir(FIXTURES_DIR)
  const out: Array<{
    id: string
    quote_number: string
    reason: string
    outcome: string
  }> = []
  for (const f of files) {
    if (!f.endsWith('.json') || f.startsWith('_')) continue
    try {
      const raw = JSON.parse(
        await fs.readFile(path.join(FIXTURES_DIR, f), 'utf8')
      ) as OptiLabFixture
      out.push({
        id: raw.id,
        quote_number: raw.quote_number,
        reason: raw.reason,
        outcome: raw.outcome
      })
    } catch {
      // skip
    }
  }
  return out
}
