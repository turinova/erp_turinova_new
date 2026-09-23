'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  Link as MuiLink,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import ScienceIcon from '@mui/icons-material/Science'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import DownloadIcon from '@mui/icons-material/Download'
import SaveIcon from '@mui/icons-material/Save'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'
import DatasetIcon from '@mui/icons-material/Dataset'
import { usePermissions } from '@/contexts/PermissionContext'
import type { OptimizationAlgorithm } from '@/lib/optimization/runOptimize'
import type {
  BatchSummary,
  CompareOutcome,
  QuoteCompareResult,
  SanityFlag
} from '@/lib/optimization/compareScores'
import { summarizeBatch } from '@/lib/optimization/compareScores'
import type { Placement } from '@/types/optimization'

type QuoteListItem = {
  id: string
  quote_number: string
  customer_name: string | null
  created_at: string | null
  panel_rows: number
}

type CompareResponse = {
  baseline: { algorithm: string; sortStrategy: string }
  candidate: { algorithm: string; sortStrategy: string }
  quotes: QuoteCompareResult[]
  summary: BatchSummary
  error?: string
}

type RunMeta = {
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

type RunDiff = {
  run_a: RunMeta
  run_b: RunMeta
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

const CANDIDATE_OPTIONS: { value: OptimizationAlgorithm; label: string }[] = [
  { value: 'ensemble', label: 'Ensemble (sort × multipanel/enhanced)' },
  { value: 'enhanced', label: 'Enhanced (best-fit + two-phase)' },
  { value: 'multipanel', label: 'Multipanel (ugyanaz mint baseline)' },
  { value: 'lookahead', label: 'Lookahead' },
  { value: 'original', label: 'Original guillotine' }
]

function outcomeColor(o: CompareOutcome): 'success' | 'default' | 'error' {
  if (o === 'win') return 'success'
  if (o === 'lose') return 'error'
  return 'default'
}

function outcomeLabel(o: CompareOutcome): string {
  if (o === 'win') return 'WIN'
  if (o === 'lose') return 'LOSE'
  return 'TIE'
}

function pct(n: number, total: number): string {
  if (!total) return '0'
  return ((n / total) * 100).toFixed(0)
}

function buildSummary(allQuotes: QuoteCompareResult[]): BatchSummary {
  return summarizeBatch(allQuotes)
}

function sanityLabel(flags: SanityFlag[]): string {
  if (!flags.length) return ''
  return flags
    .map((f) => {
      if (f === 'high_waste') return 'waste≥95%'
      if (f === 'boards_gt_panels') return 'tábla>panel'
      if (f === 'unplaced') return 'unplaced'
      return 'üres'
    })
    .join(',')
}

function BoardPreview({
  title,
  placements,
  boardW,
  boardH,
  boards
}: {
  title: string
  placements: Placement[]
  boardW: number
  boardH: number
  boards: number
}) {
  const maxBoard = Math.max(boards, 1)
  const svgW = 280
  const svgH = 200

  return (
    <Box>
      <Typography variant='subtitle2' sx={{ mb: 1 }}>
        {title} ({boards} tábla)
      </Typography>
      <Stack spacing={1}>
        {Array.from({ length: Math.min(maxBoard, 4) }, (_, i) => {
          const boardId = i + 1
          const rects = placements.filter((p) => p.board_id === boardId)
          const scaleX = boardW > 0 ? svgW / boardW : 1
          const scaleY = boardH > 0 ? svgH / boardH : 1
          return (
            <Box
              key={boardId}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 0.5
              }}
            >
              <Typography variant='caption' color='text.secondary'>
                Tábla {boardId}
              </Typography>
              <svg
                width={svgW}
                height={svgH}
                style={{ display: 'block', background: '#f5f5f5' }}
              >
                <rect
                  x={0}
                  y={0}
                  width={svgW}
                  height={svgH}
                  fill='#eee'
                  stroke='#bbb'
                />
                {rects.map((p) => (
                  <rect
                    key={p.id}
                    x={p.x_mm * scaleX}
                    y={p.y_mm * scaleY}
                    width={Math.max(p.w_mm * scaleX, 1)}
                    height={Math.max(p.h_mm * scaleY, 1)}
                    fill='rgba(103, 58, 183, 0.45)'
                    stroke='#5e35b1'
                    strokeWidth={1}
                  />
                ))}
              </svg>
            </Box>
          )
        })}
      </Stack>
    </Box>
  )
}

export default function OptiLabClient() {
  const { canAccess, loading: permissionsLoading } = usePermissions()
  const hasAccess = canAccess('/opti')

  const [search, setSearch] = useState('')
  const [quoteList, setQuoteList] = useState<QuoteListItem[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [candidateAlgo, setCandidateAlgo] =
    useState<OptimizationAlgorithm>('ensemble')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [result, setResult] = useState<CompareResponse | null>(null)
  const [detailIndex, setDetailIndex] = useState(0)
  const [progress, setProgress] = useState<string | null>(null)
  /** How often to flush cumulative results to the UI (100 or 1000 quotes). */
  const [reportBatchSize, setReportBatchSize] = useState<100 | 1000>(100)
  const [batchLog, setBatchLog] = useState<string[]>([])

  const [runLabel, setRunLabel] = useState('')
  const [runNotes, setRunNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [runs, setRuns] = useState<RunMeta[]>([])
  const [diffA, setDiffA] = useState('')
  const [diffB, setDiffB] = useState('')
  const [diff, setDiff] = useState<RunDiff | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [lastSavedRunId, setLastSavedRunId] = useState<string | null>(null)

  const refreshRuns = useCallback(async () => {
    try {
      const res = await fetch('/api/opti-lab/runs')
      const data = await res.json()
      if (res.ok) setRuns(data.runs || [])
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    refreshRuns()
  }, [refreshRuns])

  const loadQuotes = useCallback(async (mode?: string, q?: string) => {
    setListLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      else {
        params.set('mode', mode || 'recent')
        params.set('limit', '50')
      }
      const res = await fetch(`/api/opti-lab/quotes?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lista hiba')
      setQuoteList(data.quotes || [])
      setSelectedIds((data.quotes || []).map((x: QuoteListItem) => x.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lista hiba')
    } finally {
      setListLoading(false)
    }
  }, [])

  /**
   * Run compare in API chunks; every `reportBatchSize` quotes flush cumulative
   * results to the UI so the table/summary updates live.
   */
  const runCompareBatched = useCallback(
    async (
      ids: string[],
      opts: { withPlacements: boolean; labelPrefix: string }
    ) => {
      if (ids.length === 0) {
        setError('Válassz legalább egy ajánlatot.')
        return
      }

      const apiChunk = 50
      const flushEvery = reportBatchSize
      const allQuotes: QuoteCompareResult[] = []
      const logs: string[] = []
      let baselineMeta: CompareResponse['baseline'] = {
        algorithm: 'multipanel',
        sortStrategy: 'height'
      }
      let candidateMeta: CompareResponse['candidate'] = {
        algorithm: candidateAlgo,
        sortStrategy: 'height'
      }
      let lastFlushed = 0
      let batchNo = 0

      const flushUi = (force: boolean) => {
        const done = allQuotes.length
        const shouldFlush =
          force ||
          done - lastFlushed >= flushEvery ||
          (done > 0 && done === ids.length)
        if (!shouldFlush && !force) return
        if (done === lastFlushed && !force) return

        const from = lastFlushed
        const slice = allQuotes.slice(from)
        if (slice.length === 0) return
        lastFlushed = done

        batchNo += 1
        const batchSummary = buildSummary(slice)
        const totalSummary = buildSummary(allQuotes)
        const line = `Batch #${batchNo} (quote ${from + 1}–${done}/${ids.length}): W${batchSummary.win}/T${batchSummary.tie}/L${batchSummary.lose} ΣΔ${batchSummary.sum_delta_boards} · összesen W${totalSummary.win}/T${totalSummary.tie}/L${totalSummary.lose} ΣΔ${totalSummary.sum_delta_boards}`
        logs.push(line)
        setBatchLog([...logs])
        setInfo(line)
        setResult({
          baseline: baselineMeta,
          candidate: candidateMeta,
          quotes: [...allQuotes],
          summary: totalSummary
        })
        setDetailIndex(0)
      }

      for (let i = 0; i < ids.length; i += apiChunk) {
        const chunk = ids.slice(i, i + apiChunk)
        setProgress(
          `Futtatás ${Math.min(i + chunk.length, ids.length)} / ${ids.length} (batch ${flushEvery})…`
        )
        const res = await fetch('/api/opti-lab/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quote_ids: chunk,
            baseline: { algorithm: 'multipanel', sortStrategy: 'height' },
            candidate: {
              algorithm: candidateAlgo,
              sortStrategy: 'height'
            },
            include_placements: opts.withPlacements && ids.length === 1
          })
        })
        const data = (await res.json()) as CompareResponse
        if (!res.ok) throw new Error(data.error || 'Compare hiba')
        baselineMeta = data.baseline
        candidateMeta = data.candidate
        allQuotes.push(...data.quotes)
        flushUi(false)
      }

      flushUi(true)
      const summary = buildSummary(allQuotes)
      setRunLabel(
        `${opts.labelPrefix}${candidateAlgo}-${ids.length}q-${new Date().toISOString().slice(0, 10)}`
      )
      setInfo(
        `Kész: ${summary.quotes} quote — WIN ${summary.win} / TIE ${summary.tie} / LOSE ${summary.lose}, ΣΔ ${summary.sum_delta_boards}. Mentés ajánlott.`
      )
    },
    [candidateAlgo, reportBatchSize]
  )

  const runCompare = useCallback(
    async (ids: string[], withPlacements: boolean) => {
      setRunning(true)
      setError(null)
      setInfo(null)
      setResult(null)
      setBatchLog([])
      setProgress(null)
      try {
        await runCompareBatched(ids, {
          withPlacements,
          labelPrefix: ''
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Compare hiba')
      } finally {
        setRunning(false)
        setProgress(null)
      }
    },
    [runCompareBatched]
  )

  const runFullSet = useCallback(async () => {
    setRunning(true)
    setError(null)
    setInfo(null)
    setResult(null)
    setBatchLog([])
    setProgress('Quote ID-k betöltése…')

    try {
      const allIds: string[] = []
      let page = 0
      let total = 0
      let hasMore = true

      while (hasMore) {
        const res = await fetch(
          `/api/opti-lab/quote-ids?page=${page}&page_size=200`
        )
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'quote-ids hiba')
        total = data.total || total
        for (const row of data.ids || []) allIds.push(row.id)
        hasMore = Boolean(data.has_more)
        page += 1
        setProgress(`ID-k: ${allIds.length} / ${total || '?'}…`)
        if (page > 100) break // safety
      }

      if (allIds.length === 0) {
        setError('Nincs paneles ajánlat a full runhoz.')
        return
      }

      setInfo(
        `Full run indul: ${allIds.length} ajánlat · eredmény minden ${reportBatchSize} után`
      )
      setSelectedIds(allIds)
      setQuoteList([])

      await runCompareBatched(allIds, {
        withPlacements: false,
        labelPrefix: 'full-'
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Full run hiba')
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }, [reportBatchSize, runCompareBatched])

  const saveCurrentRun = useCallback(async () => {
    if (!result) return
    const label = runLabel.trim()
    if (!label) {
      setError('Adj meg egy run labelt a mentéshez.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/opti-lab/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label,
          notes: runNotes,
          baseline: result.baseline,
          candidate: result.candidate,
          summary: result.summary,
          quotes: result.quotes
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Mentés hiba')
      setLastSavedRunId(data.run.id)
      setInfo(`Run elmentve: ${data.run.id} → opti-lab-runs/`)
      await refreshRuns()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mentés hiba')
    } finally {
      setSaving(false)
    }
  }, [result, runLabel, runNotes, refreshRuns])

  const loadRunIntoResult = useCallback(async (runId: string) => {
    setError(null)
    try {
      const res = await fetch(`/api/opti-lab/runs/${encodeURIComponent(runId)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Run betöltés hiba')
      const run = data.run
      setResult({
        baseline: run.baseline,
        candidate: run.candidate,
        quotes: run.quotes,
        summary: run.summary
      })
      setRunLabel(run.label)
      setRunNotes(run.notes || '')
      setLastSavedRunId(run.id)
      setDetailIndex(0)
      setInfo(`Betöltve: ${run.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Run betöltés hiba')
    }
  }, [])

  const runDiff = useCallback(async () => {
    if (!diffA || !diffB) {
      setError('Válassz két run-t a diffhez.')
      return
    }
    setDiffLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/opti-lab/runs/diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run_a: diffA, run_b: diffB })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Diff hiba')
      setDiff(data.diff)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Diff hiba')
    } finally {
      setDiffLoading(false)
    }
  }, [diffA, diffB])

  const exportFixtures = useCallback(async () => {
    const runId = lastSavedRunId || diffB || runs[0]?.id
    if (!runId) {
      setError('Előbb ments egy run-t, aztán exportálj fixture-t.')
      return
    }
    setError(null)
    try {
      const res = await fetch('/api/opti-lab/fixtures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run_id: runId, max: 50 })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Fixture export hiba')
      setInfo(
        `Hard fixtures: ${data.count} db → opti-lab-fixtures/ (run: ${runId})`
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fixture export hiba')
    }
  }, [lastSavedRunId, diffB, runs])

  const selectedQuote = useMemo(() => {
    if (!result?.quotes.length) return null
    return result.quotes[Math.min(detailIndex, result.quotes.length - 1)]
  }, [result, detailIndex])

  const topLoses = useMemo(() => {
    if (!result) return []
    return [...result.quotes]
      .filter((q) => q.totals.outcome === 'lose' && !q.suspicious)
      .sort((a, b) => b.totals.delta_boards - a.totals.delta_boards)
      .slice(0, 15)
  }, [result])

  const wasteBuckets = useMemo(() => {
    if (!result) return null
    const buckets = { low: 0, mid: 0, high: 0 }
    for (const q of result.quotes) {
      const w = q.totals.waste_baseline
      if (w < 15) buckets.low++
      else if (w < 30) buckets.mid++
      else buckets.high++
    }
    return buckets
  }, [result])

  const downloadCsv = () => {
    if (!result) return
    const lines = [
      'quote_number,customer,panel_count,suspicious,sanity_flags,boards_stored,boards_baseline,boards_candidate,delta_boards,waste_baseline,waste_candidate,outcome'
    ]
    for (const q of result.quotes) {
      const flags = [
        ...new Set(q.materials.flatMap((m) => m.sanity_flags || []))
      ].join('|')
      lines.push(
        [
          q.quote_number,
          JSON.stringify(q.customer_name || ''),
          q.panel_count,
          q.suspicious ? 1 : 0,
          flags,
          q.totals.boards_stored,
          q.totals.boards_baseline,
          q.totals.boards_candidate,
          q.totals.delta_boards,
          q.totals.waste_baseline,
          q.totals.waste_candidate,
          q.totals.outcome
        ].join(',')
      )
    }
    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `opti-lab-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (permissionsLoading) {
    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!hasAccess) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity='error'>Nincs jogosultságod az Opti Labhoz.</Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <MuiLink
          component={Link}
          href='/home'
          underline='hover'
          color='inherit'
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize='small' /> Kezdőlap
        </MuiLink>
        <MuiLink component={Link} href='/opti' underline='hover' color='inherit'>
          Opti
        </MuiLink>
        <Typography color='text.primary'>Lab</Typography>
      </Breadcrumbs>

      <Stack direction='row' alignItems='center' spacing={1} sx={{ mb: 1 }}>
        <ScienceIcon color='secondary' />
        <Typography variant='h5' fontWeight={700}>
          Opti Lab
        </Typography>
      </Stack>
      <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
        Mérőpad: futtasd a ~5000 ajánlaton → ments run-ként → fejleszd a
        motort → diffeld az új runnal. Nem ment ajánlatot / nem ír éles Optit.
      </Typography>

      {error && (
        <Alert severity='error' sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {info && (
        <Alert severity='info' sx={{ mb: 2 }} onClose={() => setInfo(null)}>
          {info}
        </Alert>
      )}

      {/* Input */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ md: 'center' }}
        >
          <TextField
            size='small'
            label='Ajánlatszám / ügyfél'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') loadQuotes(undefined, search.trim())
            }}
            sx={{ minWidth: 220 }}
          />
          <Button
            variant='outlined'
            disabled={listLoading}
            onClick={() => loadQuotes(undefined, search.trim())}
          >
            Keresés
          </Button>
          <Button
            variant='outlined'
            disabled={listLoading || running}
            onClick={() => loadQuotes('recent')}
          >
            Utolsó 50
          </Button>
          <Button
            variant='outlined'
            disabled={listLoading || running}
            onClick={() => loadQuotes('random')}
          >
            Random 50
          </Button>
          <Button
            variant='outlined'
            disabled={listLoading || running}
            onClick={() => loadQuotes('hard')}
          >
            Hard 50
          </Button>
          <FormControl size='small' sx={{ minWidth: 280 }}>
            <InputLabel>Új algoritmus</InputLabel>
            <Select
              label='Új algoritmus'
              value={candidateAlgo}
              onChange={(e) =>
                setCandidateAlgo(e.target.value as OptimizationAlgorithm)
              }
            >
              {CANDIDATE_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size='small' sx={{ minWidth: 200 }}>
            <InputLabel>Eredmény batch</InputLabel>
            <Select
              label='Eredmény batch'
              value={reportBatchSize}
              disabled={running}
              onChange={(e) =>
                setReportBatchSize(Number(e.target.value) as 100 | 1000)
              }
            >
              <MenuItem value={100}>100-anként kiír</MenuItem>
              <MenuItem value={1000}>1000-anként kiír</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        <Stack
          direction='row'
          spacing={1}
          sx={{ mt: 2 }}
          flexWrap='wrap'
          useFlexGap
        >
          <Button
            variant='contained'
            color='secondary'
            startIcon={
              running ? <CircularProgress size={16} /> : <PlayArrowIcon />
            }
            disabled={running || selectedIds.length === 0}
            onClick={() => runCompare(selectedIds, selectedIds.length === 1)}
          >
            Összehasonlítás ({selectedIds.length})
          </Button>
          <Button
            variant='contained'
            color='warning'
            startIcon={running ? <CircularProgress size={16} /> : <DatasetIcon />}
            disabled={running}
            onClick={runFullSet}
          >
            Full run (~összes · {reportBatchSize}-as batch)
          </Button>
          {listLoading && <CircularProgress size={24} sx={{ ml: 1 }} />}
          {progress && (
            <Typography
              variant='body2'
              color='text.secondary'
              sx={{ alignSelf: 'center' }}
            >
              {progress}
            </Typography>
          )}
        </Stack>

        {batchLog.length > 0 && (
          <Box
            sx={{
              mt: 2,
              p: 1.5,
              maxHeight: 160,
              overflow: 'auto',
              bgcolor: 'action.hover',
              borderRadius: 1,
              fontFamily: 'ui-monospace, monospace',
              fontSize: 12
            }}
          >
            <Typography variant='caption' color='text.secondary' display='block' sx={{ mb: 0.5 }}>
              Batch napló (minden {reportBatchSize} után frissül a tábla is)
            </Typography>
            {batchLog.map((line, i) => (
              <Box key={`${i}-${line.slice(0, 24)}`} sx={{ mb: 0.25 }}>
                {line}
              </Box>
            ))}
          </Box>
        )}

        {quoteList.length > 0 && (
          <Box sx={{ mt: 2, maxHeight: 220, overflow: 'auto' }}>
            <Table size='small' stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding='checkbox' />
                  <TableCell>Ajánlat</TableCell>
                  <TableCell>Ügyfél</TableCell>
                  <TableCell align='right'>Panel sorok</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {quoteList.map((q) => {
                  const checked = selectedIds.includes(q.id)
                  return (
                    <TableRow
                      key={q.id}
                      hover
                      selected={checked}
                      onClick={() => {
                        setSelectedIds((prev) =>
                          checked
                            ? prev.filter((id) => id !== q.id)
                            : [...prev, q.id]
                        )
                      }}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell padding='checkbox'>
                        <input type='checkbox' readOnly checked={checked} />
                      </TableCell>
                      <TableCell>{q.quote_number}</TableCell>
                      <TableCell>{q.customer_name || '—'}</TableCell>
                      <TableCell align='right'>{q.panel_rows}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Box>
        )}
      </Paper>

      {/* Save + history + diff */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant='h6' sx={{ mb: 1 }}>
          Iterációs hurok
        </Typography>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ md: 'center' }}
          sx={{ mb: 2 }}
        >
          <TextField
            size='small'
            label='Run label'
            value={runLabel}
            onChange={(e) => setRunLabel(e.target.value)}
            sx={{ minWidth: 260 }}
            disabled={!result}
          />
          <TextField
            size='small'
            label='Megjegyzés'
            value={runNotes}
            onChange={(e) => setRunNotes(e.target.value)}
            sx={{ minWidth: 200, flex: 1 }}
            disabled={!result}
          />
          <Button
            variant='contained'
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            disabled={!result || saving}
            onClick={saveCurrentRun}
          >
            Mentés run-ként
          </Button>
          <Button
            variant='outlined'
            onClick={exportFixtures}
            disabled={runs.length === 0 && !lastSavedRunId}
          >
            Hard fixture export (50)
          </Button>
        </Stack>

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ md: 'center' }}
        >
          <FormControl size='small' sx={{ minWidth: 220 }}>
            <InputLabel>Run A (előző)</InputLabel>
            <Select
              label='Run A (előző)'
              value={diffA}
              onChange={(e) => setDiffA(e.target.value)}
            >
              {runs.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.label} ({r.quote_count}q)
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size='small' sx={{ minWidth: 220 }}>
            <InputLabel>Run B (új)</InputLabel>
            <Select
              label='Run B (új)'
              value={diffB}
              onChange={(e) => setDiffB(e.target.value)}
            >
              {runs.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.label} ({r.quote_count}q)
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant='outlined'
            startIcon={
              diffLoading ? (
                <CircularProgress size={16} />
              ) : (
                <CompareArrowsIcon />
              )
            }
            disabled={diffLoading || !diffA || !diffB}
            onClick={runDiff}
          >
            Run diff
          </Button>
          <Button size='small' onClick={refreshRuns}>
            Frissítés
          </Button>
        </Stack>

        {runs.length > 0 && (
          <Box sx={{ mt: 2, maxHeight: 160, overflow: 'auto' }}>
            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell>Label</TableCell>
                  <TableCell>Candidate</TableCell>
                  <TableCell align='right'>Quotes</TableCell>
                  <TableCell align='right'>W/T/L</TableCell>
                  <TableCell align='right'>ΣΔ</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Typography variant='body2' fontWeight={600}>
                        {r.label}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {r.id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {r.candidate.algorithm}/{r.candidate.sortStrategy}
                    </TableCell>
                    <TableCell align='right'>{r.quote_count}</TableCell>
                    <TableCell align='right'>
                      {r.summary.win}/{r.summary.tie}/{r.summary.lose}
                    </TableCell>
                    <TableCell align='right'>
                      {r.summary.sum_delta_boards}
                    </TableCell>
                    <TableCell>
                      <Button size='small' onClick={() => loadRunIntoResult(r.id)}>
                        Betölt
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {diff && (
          <Box sx={{ mt: 2 }}>
            <Typography variant='subtitle1' fontWeight={600} sx={{ mb: 1 }}>
              Diff: {diff.run_a.label} → {diff.run_b.label}
            </Typography>
            <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
              <Chip
                color={diff.summary_delta.win >= 0 ? 'success' : 'error'}
                label={`Δ WIN ${diff.summary_delta.win >= 0 ? '+' : ''}${diff.summary_delta.win}`}
              />
              <Chip label={`Δ TIE ${diff.summary_delta.tie}`} />
              <Chip
                color={diff.summary_delta.lose <= 0 ? 'success' : 'error'}
                label={`Δ LOSE ${diff.summary_delta.lose >= 0 ? '+' : ''}${diff.summary_delta.lose}`}
              />
              <Chip
                color={
                  diff.summary_delta.sum_delta_boards <= 0 ? 'success' : 'error'
                }
                label={`Δ (ΣΔ tábla) ${diff.summary_delta.sum_delta_boards}`}
              />
              <Chip
                color={
                  diff.summary_delta.sum_boards_candidate <= 0
                    ? 'success'
                    : 'error'
                }
                label={`Δ candidate tábla ${diff.summary_delta.sum_boards_candidate}`}
              />
              <Chip
                variant='outlined'
                label={`csak A: ${diff.only_in_a} / csak B: ${diff.only_in_b}`}
              />
            </Stack>
            {diff.regressed.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant='subtitle2' color='error'>
                  Regresszió ({diff.regressed.length})
                </Typography>
                <Typography variant='caption' component='div'>
                  {diff.regressed
                    .slice(0, 10)
                    .map(
                      (r) =>
                        `${r.quote_number}: ${r.outcome_a}→${r.outcome_b} (Δ ${r.delta_boards_a}→${r.delta_boards_b})`
                    )
                    .join(' · ')}
                </Typography>
              </Box>
            )}
            {diff.improved.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant='subtitle2' color='success.main'>
                  Javulás ({diff.improved.length})
                </Typography>
                <Typography variant='caption' component='div'>
                  {diff.improved
                    .slice(0, 10)
                    .map(
                      (r) =>
                        `${r.quote_number}: ${r.outcome_a}→${r.outcome_b} (Δ ${r.delta_boards_a}→${r.delta_boards_b})`
                    )
                    .join(' · ')}
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Paper>

      {result && (
        <>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent='space-between'
              alignItems={{ sm: 'center' }}
              spacing={1}
              sx={{ mb: 2 }}
            >
              <Typography variant='h6'>Összesítő</Typography>
              <Button
                size='small'
                startIcon={<DownloadIcon />}
                onClick={downloadCsv}
              >
                CSV
              </Button>
            </Stack>
            <Typography
              variant='caption'
              color='text.secondary'
              display='block'
              sx={{ mb: 1 }}
            >
              Baseline: {result.baseline.algorithm}/{result.baseline.sortStrategy}{' '}
              · Új: {result.candidate.algorithm}/{result.candidate.sortStrategy}
            </Typography>
            <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
              <Chip label={`${result.summary.quotes} ajánlat`} />
              <Chip label={`${result.summary.materials} anyag`} />
              <Chip
                color='success'
                label={`WIN ${result.summary.win} (${pct(result.summary.win, result.summary.quotes)}%)`}
              />
              <Chip
                label={`TIE ${result.summary.tie} (${pct(result.summary.tie, result.summary.quotes)}%)`}
              />
              <Chip
                color='error'
                label={`LOSE ${result.summary.lose} (${pct(result.summary.lose, result.summary.quotes)}%)`}
              />
              <Chip
                color={
                  result.summary.sum_delta_boards < 0
                    ? 'success'
                    : result.summary.sum_delta_boards > 0
                      ? 'error'
                      : 'default'
                }
                label={`Σ Δ tábla: ${result.summary.sum_delta_boards > 0 ? '+' : ''}${result.summary.sum_delta_boards}`}
              />
              <Chip
                label={`Tábla: ${result.summary.sum_boards_baseline} → ${result.summary.sum_boards_candidate}`}
              />
              <Chip
                variant='outlined'
                label={`Mentett Σ: ${result.summary.sum_boards_stored}`}
              />
              {(result.summary.suspicious ?? 0) > 0 && (
                <Chip
                  color='warning'
                  label={`Gyanús: ${result.summary.suspicious} (kizárva fair-ből)`}
                />
              )}
              <Chip
                color={
                  (result.summary.fair_sum_delta_boards ?? 0) < 0
                    ? 'success'
                    : (result.summary.fair_sum_delta_boards ?? 0) > 0
                      ? 'error'
                      : 'default'
                }
                variant='outlined'
                label={`Fair ΣΔ: ${(result.summary.fair_sum_delta_boards ?? 0) > 0 ? '+' : ''}${result.summary.fair_sum_delta_boards ?? 0} (${result.summary.fair_quotes ?? 0} ajánlat · W${result.summary.fair_win ?? 0}/T${result.summary.fair_tie ?? 0}/L${result.summary.fair_lose ?? 0})`}
              />
              {(result.summary.fair_quotes ?? 0) > 0 && (
                <Chip
                  variant='outlined'
                  label={`Fair tábla: ${result.summary.fair_sum_boards_baseline} → ${result.summary.fair_sum_boards_candidate}`}
                />
              )}
              {wasteBuckets && (
                <Chip
                  variant='outlined'
                  label={`Hulladék (baseline): <15%: ${wasteBuckets.low} · 15–30%: ${wasteBuckets.mid} · ≥30%: ${wasteBuckets.high}`}
                />
              )}
            </Stack>
            <Typography
              variant='caption'
              color='text.secondary'
              display='block'
              sx={{ mt: 1 }}
            >
              Fair = gyanús nélkül (waste≥95%, tábla&gt;panel, unplaced). Mentett Σ ≠
              Opti táblaszám (teljes tábla eladás).
            </Typography>

            {topLoses.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant='subtitle2' color='error' sx={{ mb: 0.5 }}>
                  Top LOSE (tanuláshoz)
                </Typography>
                <Typography variant='caption' component='div'>
                  {topLoses
                    .map(
                      (q) =>
                        `${q.quote_number} (Δ+${q.totals.delta_boards}, waste ${q.totals.waste_baseline}%)`
                    )
                    .join(' · ')}
                </Typography>
              </Box>
            )}
          </Paper>

          <Paper sx={{ p: 2, mb: 2, overflow: 'auto' }}>
            <Typography variant='h6' sx={{ mb: 1 }}>
              Ajánlatonként
            </Typography>
            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell>Ajánlat</TableCell>
                  <TableCell>Ügyfél</TableCell>
                  <TableCell align='right'>Panel</TableCell>
                  <TableCell align='right'>Mentett</TableCell>
                  <TableCell align='right'>Régi</TableCell>
                  <TableCell align='right'>Új</TableCell>
                  <TableCell align='right'>Δ</TableCell>
                  <TableCell align='right'>Hulladék régi→új</TableCell>
                  <TableCell>Eredmény</TableCell>
                  <TableCell>Sanity</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {result.quotes.map((q, idx) => (
                  <TableRow
                    key={q.quote_id}
                    hover
                    selected={idx === detailIndex}
                    sx={{
                      cursor: 'pointer',
                      bgcolor: q.suspicious
                        ? 'action.hover'
                        : undefined
                    }}
                    onClick={() => setDetailIndex(idx)}
                  >
                    <TableCell>{q.quote_number}</TableCell>
                    <TableCell>{q.customer_name || '—'}</TableCell>
                    <TableCell align='right'>{q.panel_count}</TableCell>
                    <TableCell align='right'>{q.totals.boards_stored}</TableCell>
                    <TableCell align='right'>
                      {q.totals.boards_baseline}
                    </TableCell>
                    <TableCell align='right'>
                      {q.totals.boards_candidate}
                    </TableCell>
                    <TableCell align='right'>
                      <Typography
                        component='span'
                        color={
                          q.totals.delta_boards < 0
                            ? 'success.main'
                            : q.totals.delta_boards > 0
                              ? 'error.main'
                              : 'text.primary'
                        }
                        fontWeight={600}
                      >
                        {q.totals.delta_boards > 0 ? '+' : ''}
                        {q.totals.delta_boards}
                      </Typography>
                    </TableCell>
                    <TableCell align='right'>
                      {q.totals.waste_baseline}% → {q.totals.waste_candidate}%
                    </TableCell>
                    <TableCell>
                      <Chip
                        size='small'
                        color={outcomeColor(q.totals.outcome)}
                        label={outcomeLabel(q.totals.outcome)}
                      />
                    </TableCell>
                    <TableCell>
                      {q.suspicious ? (
                        <Chip
                          size='small'
                          color='warning'
                          label={
                            sanityLabel([
                              ...new Set(
                                q.materials.flatMap((m) => m.sanity_flags || [])
                              )
                            ]) || 'gyanús'
                          }
                        />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <MuiLink
                        component={Link}
                        href={`/opti?quote_id=${q.quote_id}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Opti
                      </MuiLink>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          {selectedQuote && (
            <Paper sx={{ p: 2 }}>
              <Typography variant='h6' sx={{ mb: 1 }}>
                Részlet: {selectedQuote.quote_number}
              </Typography>
              <Table size='small' sx={{ mb: 2 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Anyag</TableCell>
                    <TableCell align='right'>Mentett</TableCell>
                    <TableCell align='right'>Régi</TableCell>
                    <TableCell align='right'>Új</TableCell>
                    <TableCell align='right'>Δ</TableCell>
                    <TableCell align='right'>Hulladék</TableCell>
                    <TableCell align='right'>ms régi/új</TableCell>
                    <TableCell>Eredmény</TableCell>
                    <TableCell>Sanity</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedQuote.materials.map((m) => (
                    <TableRow key={m.material_id}>
                      <TableCell>{m.material_name}</TableCell>
                      <TableCell align='right'>
                        {m.boards_stored ?? '—'}
                      </TableCell>
                      <TableCell align='right'>{m.boards_baseline}</TableCell>
                      <TableCell align='right'>{m.boards_candidate}</TableCell>
                      <TableCell align='right'>{m.delta_boards}</TableCell>
                      <TableCell align='right'>
                        {m.waste_baseline}% → {m.waste_candidate}%
                      </TableCell>
                      <TableCell align='right'>
                        {m.ms_baseline} / {m.ms_candidate}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size='small'
                          color={outcomeColor(m.outcome)}
                          label={outcomeLabel(m.outcome)}
                        />
                      </TableCell>
                      <TableCell>
                        {m.suspicious ? (
                          <Chip
                            size='small'
                            color='warning'
                            label={sanityLabel(m.sanity_flags || []) || 'gyanús'}
                          />
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {selectedQuote.materials.some((m) => m.placements_baseline) && (
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
                  {selectedQuote.materials
                    .filter((m) => m.placements_baseline)
                    .slice(0, 1)
                    .map((m) => (
                      <React.Fragment key={m.material_id}>
                        <Box flex={1}>
                          <BoardPreview
                            title={`Régi — ${m.material_name}`}
                            placements={m.placements_baseline || []}
                            boardW={m.debug_baseline?.board_width || 1}
                            boardH={m.debug_baseline?.board_height || 1}
                            boards={m.boards_baseline}
                          />
                        </Box>
                        <Box flex={1}>
                          <BoardPreview
                            title={`Új — ${m.material_name}`}
                            placements={m.placements_candidate || []}
                            boardW={m.debug_candidate?.board_width || 1}
                            boardH={m.debug_candidate?.board_height || 1}
                            boards={m.boards_candidate}
                          />
                        </Box>
                      </React.Fragment>
                    ))}
                </Stack>
              )}
            </Paper>
          )}
        </>
      )}
    </Box>
  )
}
