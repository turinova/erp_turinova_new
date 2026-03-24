'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import DownloadIcon from '@mui/icons-material/Download'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import TaskAltIcon from '@mui/icons-material/TaskAlt'
import { toast } from 'react-toastify'
import * as XLSX from 'xlsx'

type ActionType = 'import' | 'export'
type EntityType = 'suppliers' | 'products'

type PreviewRow = {
  rowNumber: number
  values: Record<string, string>
  normalized: Record<string, unknown>
  errors: string[]
  warnings: string[]
}

type Connection = {
  id: string
  name: string
  connection_name?: string
}

type SyncCandidate = {
  productId: string
  sku: string
  isNew: boolean
  changedFields: string[]
}

const stepsByAction: Record<ActionType, string[]> = {
  import: ['Fájl feltöltése', 'Ellenőrzés', 'Futtatás'],
  export: ['Szűrés', 'Előkészítés', 'Letöltés']
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

const PRODUCT_SYNCABLE_FIELDS = new Set([
  'name',
  'erp_manufacturer_id',
  'gtin',
  'model_number',
  'unit_id',
  'length',
  'width',
  'height',
  'weight',
  'erp_weight_unit_id',
  'cost',
  'multiplier',
  'vat_id',
  'price',
  'gross_price',
  'status'
])

const PRODUCT_FIELD_LABELS: Record<string, string> = {
  name: 'Termék neve',
  erp_manufacturer_id: 'Gyártó',
  gtin: 'Vonalkód',
  internal_barcode: 'Belső vonalkód',
  model_number: 'Gyártói cikkszám',
  unit_id: 'Mértékegység',
  length: 'Hosszúság',
  width: 'Szélesség',
  height: 'Magasság',
  weight: 'Súly',
  erp_weight_unit_id: 'Súlymértékegység',
  cost: 'Beszerzési ár',
  multiplier: 'Árazási szorzó',
  vat_id: 'ÁFA',
  price: 'Nettó ár (számolt)',
  gross_price: 'Bruttó ár (számolt)',
  status: 'Státusz'
}

export default function DataOperationsClient() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [entity, setEntity] = useState<EntityType>('suppliers')
  const [action, setAction] = useState<ActionType>('import')
  const [stepIndex, setStepIndex] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [filename, setFilename] = useState<string | null>(null)
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedConnectionId, setSelectedConnectionId] = useState('')

  const [resultSummary, setResultSummary] = useState<{
    total: number
    created: number
    updated: number
    skipped: number
    failed: number
  } | null>(null)

  const [failedRows, setFailedRows] = useState<Array<{ rowNumber: number; sku?: string | null; name?: string | null; reason: string }>>([])
  const [exporting, setExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [syncCandidates, setSyncCandidates] = useState<SyncCandidate[]>([])
  const [syncDialogOpen, setSyncDialogOpen] = useState(false)
  const [syncingNow, setSyncingNow] = useState(false)

  const steps = stepsByAction[action]
  const errorCount = useMemo(() => previewRows.reduce((sum, row) => sum + row.errors.length, 0), [previewRows])
  const warningCount = useMemo(() => previewRows.reduce((sum, row) => sum + row.warnings.length, 0), [previewRows])
  const syncableProductIds = useMemo(
    () => syncCandidates.filter((item) => item.changedFields.some((field) => PRODUCT_SYNCABLE_FIELDS.has(field))).map((item) => item.productId),
    [syncCandidates]
  )
  const syncableChangedFieldLabels = useMemo(() => {
    const fields = new Set<string>()
    syncCandidates.forEach((item) => {
      item.changedFields.forEach((field) => {
        if (PRODUCT_SYNCABLE_FIELDS.has(field)) fields.add(field)
      })
    })
    return [...fields].map((field) => PRODUCT_FIELD_LABELS[field] || field)
  }, [syncCandidates])

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const response = await fetch('/api/connections')
        if (!response.ok) return
        const data = await response.json()
        const items = (data.connections || []).filter((c: any) => c.connection_type === 'shoprenter' && c.is_active)
        setConnections(items)
        if (items.length > 0 && !selectedConnectionId) {
          setSelectedConnectionId(items[0].id)
        }
      } catch (error) {
        console.error('Failed to load connections for data operations:', error)
      }
    }
    fetchConnections()
  }, [selectedConnectionId])

  const resetImportState = () => {
    setStepIndex(0)
    setPreviewRows([])
    setResultSummary(null)
    setFailedRows([])
    setFilename(null)
    setSyncCandidates([])
    setSyncDialogOpen(false)
  }

  const handleActionChange = (_: unknown, value: ActionType | null) => {
    if (!value) return
    setAction(value)
    resetImportState()
  }

  const handleEntityChange = (_: unknown, value: EntityType | null) => {
    if (!value) return
    setEntity(value)
    setAction('import')
    resetImportState()
  }

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(`/api/data-operations/${entity}/template`)
      if (!response.ok) throw new Error('Nem sikerült letölteni a sablont.')
      const blob = await response.blob()
      const prefix = entity === 'suppliers' ? 'beszallitok' : 'termekek'
      downloadBlob(blob, `${prefix}_sablon_${new Date().toISOString().split('T')[0]}.xlsx`)
    } catch (error: any) {
      toast.error(error?.message || 'Sablon letöltési hiba')
    }
  }

  const handleUploadClick = () => fileInputRef.current?.click()

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      toast.error('Csak .xlsx fájl tölthető fel.')
      return
    }
    if (entity === 'products' && !selectedConnectionId) {
      toast.error('Termék importhoz válassz webshop kapcsolatot.')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(`/api/data-operations/${entity}/import/preview`, { method: 'POST', body: formData })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Import előnézet sikertelen')
      setFilename(data.filename || file.name)
      setPreviewRows(data.rows || [])
      setStepIndex(1)
      toast.success('Előnézet elkészült')
    } catch (error: any) {
      toast.error(error?.message || 'Feltöltési hiba')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleExecuteImport = async () => {
    if (entity === 'products' && !selectedConnectionId) {
      toast.error('Termék importhoz webshop kapcsolat szükséges.')
      return
    }

    setExecuting(true)
    try {
      const response = await fetch(`/api/data-operations/${entity}/import/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection_id: entity === 'products' ? selectedConnectionId : undefined,
          rows: previewRows
        })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Import futtatás sikertelen')
      setResultSummary(data.summary || null)
      setFailedRows(data.failedRows || [])
      setSyncCandidates(data.syncCandidates || [])
      setStepIndex(2)
      if (entity === 'products' && (data.syncCandidates || []).length > 0) {
        setSyncDialogOpen(true)
      }
      toast.success('Import futtatás kész')
    } catch (error: any) {
      toast.error(error?.message || 'Import futtatási hiba')
    } finally {
      setExecuting(false)
    }
  }

  const handleSyncImportedProducts = async () => {
    if (syncableProductIds.length === 0) {
      toast.info('Nincs azonnal szinkronizálható termék.')
      setSyncDialogOpen(false)
      return
    }
    setSyncingNow(true)
    try {
      const response = await fetch('/api/data-operations/products/sync-to-webshop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: syncableProductIds })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Webshop szinkron indítás sikertelen')
      toast.success('Webshop ár/adat szinkron elindult a módosított termékekre.')
      setSyncDialogOpen(false)
    } catch (error: any) {
      toast.error(error?.message || 'Webshop szinkron hiba')
    } finally {
      setSyncingNow(false)
    }
  }

  const handleDownloadFailedRows = () => {
    if (failedRows.length === 0) return
    const rows = failedRows.map((row) => ({
      rowNumber: row.rowNumber,
      identifier: row.sku || row.name || '',
      reason: row.reason
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Hibas_sorok')
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    const prefix = entity === 'suppliers' ? 'beszallitok' : 'termekek'
    downloadBlob(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `${prefix}_hibas_sorok_${new Date().toISOString().split('T')[0]}.xlsx`
    )
  }

  const handleExport = async () => {
    if (entity === 'products' && !selectedConnectionId) {
      toast.error('Termék exporthoz webshop kapcsolat kiválasztása kötelező.')
      return
    }

    setExporting(true)
    try {
      const body =
        entity === 'suppliers'
          ? { status: exportStatus, hasEmail: 'all', hasTaxNumber: 'all' }
          : { status: exportStatus, connection_id: selectedConnectionId, includeCalculated: true }

      const response = await fetch(`/api/data-operations/${entity}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!response.ok) {
        const bodyData = await response.json().catch(() => ({}))
        throw new Error(bodyData?.error || 'Export sikertelen')
      }
      const blob = await response.blob()
      const prefix = entity === 'suppliers' ? 'beszallitok' : 'termekek'
      downloadBlob(blob, `${prefix}_export_${new Date().toISOString().split('T')[0]}.xlsx`)
      setStepIndex(2)
      toast.success('Export elkészült')
    } catch (error: any) {
      toast.error(error?.message || 'Export hiba')
    } finally {
      setExporting(false)
    }
  }

  const previewNameField = entity === 'suppliers' ? 'nev' : 'termek_neve'

  return (
    <Stack spacing={3}>
      <Card
        sx={{
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          background: (theme) =>
            `linear-gradient(120deg, ${theme.palette.background.paper} 0%, ${theme.palette.action.hover} 100%)`
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                Adatműveletek
              </Typography>
              <Typography variant="body2" color="text.secondary">
                XLSX alapú import/export workflow, előnézettel, hibalistával és biztonságos futtatással.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleDownloadTemplate}>
                Sablon letöltése
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <Stack spacing={2}>
          <ToggleButtonGroup value={entity} exclusive onChange={handleEntityChange} size="small">
            <ToggleButton value="suppliers">Beszállítók</ToggleButton>
            <ToggleButton value="products">Termékek</ToggleButton>
          </ToggleButtonGroup>

          <ToggleButtonGroup value={action} exclusive onChange={handleActionChange} size="small">
            <ToggleButton value="import">Importálás</ToggleButton>
            <ToggleButton value="export">Exportálás</ToggleButton>
          </ToggleButtonGroup>

          {entity === 'products' ? (
            <FormControl size="small" sx={{ maxWidth: 420 }}>
              <InputLabel>Webshop kapcsolat</InputLabel>
              <Select
                label="Webshop kapcsolat"
                value={selectedConnectionId}
                onChange={(e) => setSelectedConnectionId(String(e.target.value))}
              >
                {connections.map((conn) => (
                  <MenuItem key={conn.id} value={conn.id}>
                    {conn.connection_name || conn.name || conn.id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : null}

          <Stack direction="row" spacing={1} flexWrap="wrap">
            {steps.map((step, idx) => (
              <Chip
                key={step}
                label={`${idx + 1}. ${step}`}
                color={idx === stepIndex ? 'primary' : idx < stepIndex ? 'success' : 'default'}
                variant={idx === stepIndex ? 'filled' : 'outlined'}
              />
            ))}
          </Stack>

          <LinearProgress variant="determinate" value={((stepIndex + 1) / steps.length) * 100} />
        </Stack>
      </Paper>

      {action === 'import' ? (
        <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          {stepIndex === 0 ? (
            <Stack spacing={2}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                1. Fájl feltöltése
              </Typography>
              <Alert severity="info">
                {entity === 'suppliers'
                  ? 'Egyedi kulcs: azonosito (Beszállító kód).'
                  : 'Egyedi kulcs: azonosito (SKU). Ár importnál kötelező együtt: beszerzesi_ar + arazasi_szorzo + afa.'}
              </Alert>
              {entity === 'products' ? (
                <Alert severity="warning">
                  Azonnali webshop szinkron ebben a folyamatban csak az importálható termék mezőkre indul. Készlet módosítás nincs.
                </Alert>
              ) : null}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button
                  variant="contained"
                  startIcon={uploading ? <CircularProgress size={16} /> : <UploadFileIcon />}
                  onClick={handleUploadClick}
                  disabled={uploading}
                >
                  {uploading ? 'Feltöltés...' : 'XLSX feltöltése'}
                </Button>
                <Button variant="text" onClick={handleDownloadTemplate}>
                  Minta sablon
                </Button>
              </Stack>
              <input ref={fileInputRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleFileSelected} />
            </Stack>
          ) : null}

          {stepIndex === 1 ? (
            <Stack spacing={2}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                2. Ellenőrzés
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Fájl: {filename || '-'}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip label={`Sorok: ${previewRows.length}`} />
                <Chip color={errorCount > 0 ? 'error' : 'success'} label={`Hibák: ${errorCount}`} />
                <Chip color={warningCount > 0 ? 'warning' : 'success'} label={`Figyelmeztetés: ${warningCount}`} />
              </Stack>

              <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, maxHeight: 420 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Sor</TableCell>
                      <TableCell>Azonosító</TableCell>
                      <TableCell>Név</TableCell>
                      <TableCell>Hiba / állapot</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {previewRows.slice(0, 120).map((row) => (
                      <TableRow key={row.rowNumber}>
                        <TableCell>{row.rowNumber}</TableCell>
                        <TableCell>{row.values.azonosito || '-'}</TableCell>
                        <TableCell>{row.values[previewNameField] || '-'}</TableCell>
                        <TableCell>
                          {row.errors.length > 0 ? (
                            <Typography variant="caption" color="error.main">{row.errors.join(' | ')}</Typography>
                          ) : row.warnings.length > 0 ? (
                            <Typography variant="caption" color="warning.main">{row.warnings.join(' | ')}</Typography>
                          ) : (
                            <Chip size="small" color="success" label="OK" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button variant="outlined" onClick={resetImportState}>Új fájl</Button>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={executing ? <CircularProgress size={16} /> : <AutoFixHighIcon />}
                  onClick={handleExecuteImport}
                  disabled={executing || previewRows.length === 0}
                >
                  {executing ? 'Futtatás...' : 'Import futtatása'}
                </Button>
              </Stack>
            </Stack>
          ) : null}

          {stepIndex === 2 ? (
            <Stack spacing={2}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                3. Futtatás eredménye
              </Typography>
              {resultSummary ? (
                <Grid container spacing={1.5}>
                  <Grid item xs={6} md={2}><Chip color="primary" label={`Összes: ${resultSummary.total}`} /></Grid>
                  <Grid item xs={6} md={2}><Chip color="success" label={`Új: ${resultSummary.created}`} /></Grid>
                  <Grid item xs={6} md={2}><Chip color="success" label={`Frissítve: ${resultSummary.updated}`} /></Grid>
                  <Grid item xs={6} md={2}><Chip color="warning" label={`Kihagyva: ${resultSummary.skipped}`} /></Grid>
                  <Grid item xs={6} md={2}><Chip color={resultSummary.failed > 0 ? 'error' : 'success'} label={`Hibás: ${resultSummary.failed}`} /></Grid>
                </Grid>
              ) : null}

              {failedRows.length > 0 ? (
                <Alert
                  severity="warning"
                  action={
                    <Button color="inherit" size="small" onClick={handleDownloadFailedRows}>
                      Hibás sorok letöltése
                    </Button>
                  }
                >
                  Vannak sikertelen sorok. Letöltheted és javítás után újra importálhatod.
                </Alert>
              ) : (
                <Alert severity="success" icon={<TaskAltIcon />}>
                  Az import sikeresen lefutott.
                </Alert>
              )}

              <Button variant="outlined" onClick={resetImportState}>Új import indítása</Button>
            </Stack>
          ) : null}
        </Paper>
      ) : (
        <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <Stack spacing={2}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {stepIndex + 1}. {entity === 'suppliers' ? 'Beszállító export' : 'Termék export'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Az exportált XLSX szerkezete megegyezik az import sablonnal.
            </Typography>
            <ToggleButtonGroup value={exportStatus} exclusive onChange={(_, v) => v && setExportStatus(v)} size="small">
              <ToggleButton value="all">Összes</ToggleButton>
              <ToggleButton value="active">Aktív</ToggleButton>
              <ToggleButton value="inactive">Inaktív</ToggleButton>
            </ToggleButtonGroup>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button variant="outlined" onClick={() => setStepIndex(0)}>Vissza</Button>
              <Button
                variant="contained"
                startIcon={exporting ? <CircularProgress size={16} /> : <DownloadIcon />}
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? 'Export...' : 'Export letöltése (XLSX)'}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      <Dialog open={syncDialogOpen} onClose={() => (syncingNow ? null : setSyncDialogOpen(false))} maxWidth="sm" fullWidth>
        <DialogTitle>Webshop szinkron megerősítése</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <Alert severity="info">
              Az import lefutott. Most eldöntheted, hogy a módosított import mezők azonnal menjenek-e a webshopba.
            </Alert>
            <Typography variant="body2">
              Új termékek: <strong>{syncCandidates.filter((item) => item.isNew).length}</strong>
            </Typography>
            <Typography variant="body2">
              Frissített termékek: <strong>{syncCandidates.filter((item) => !item.isNew).length}</strong>
            </Typography>
            <Typography variant="body2">
              Azonnal szinkronizálható (nem készlet): <strong>{syncableProductIds.length}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Szinkronizálható mezők: {syncableChangedFieldLabels.length > 0 ? syncableChangedFieldLabels.join(', ') : 'nincs'}
            </Typography>
            <Alert severity="warning">
              Készlet módosítás ebben a folyamatban nincs. Csak az importálható termék adatok mennek.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSyncDialogOpen(false)} disabled={syncingNow}>Később</Button>
          <Button onClick={handleSyncImportedProducts} variant="contained" disabled={syncingNow}>
            {syncingNow ? 'Indítás...' : 'Szinkron indítása'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
