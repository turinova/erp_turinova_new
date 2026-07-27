'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography
} from '@mui/material'

import {
  MAX_PORTAL_SOURCES,
  buildStudioSourcesUrl,
  formatFt,
  sourceKey,
  type QuoteSourceType,
  type RecentSavedQuote,
  type StudioSourceRef
} from './customerFacingPdfShared'

type Filter = 'all' | 'draft' | 'ordered'

type Props = {
  open: boolean
  onClose: () => void
  quotes: RecentSavedQuote[]
  currentSources: StudioSourceRef[]
  /** Ha meg van adva: csak ezt a forrást cseréli. Egyébként hozzáadás. */
  replaceKey?: string | null
  /** Mentett ügyfélajánlat id — URL-ben megmarad forráscsere után is. */
  customerQuoteId?: string | null
}

export default function CustomerQuoteSourcePicker({
  open,
  onClose,
  quotes,
  currentSources,
  replaceKey = null,
  customerQuoteId = null
}: Props) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = useMemo(() => {
    if (filter === 'all') return quotes
    return quotes.filter(q => q.origin === filter)
  }, [filter, quotes])

  const draftCount = quotes.filter(q => q.origin === 'draft').length
  const orderedCount = quotes.filter(q => q.origin === 'ordered').length
  const currentIds = new Set(currentSources.map(s => s.id))
  const atLimit = !replaceKey && currentSources.length >= MAX_PORTAL_SOURCES
  const isReplace = Boolean(replaceKey)

  const handleSelect = (q: RecentSavedQuote) => {
    const type: QuoteSourceType = q.type === 'nettfront' ? 'nettfront' : 'lapszabaszat'
    const key = sourceKey({ type, id: q.id })

    if (isReplace && replaceKey) {
      if (currentSources.some(s => sourceKey(s) === key && sourceKey(s) !== replaceKey)) {
        onClose()
        return
      }
      const next = currentSources.map(s =>
        sourceKey(s) === replaceKey ? { type, id: q.id } : s
      )
      onClose()
      router.push(buildStudioSourcesUrl(next, { customerQuoteId }))
      return
    }

    if (currentIds.has(q.id)) {
      onClose()
      return
    }

    if (currentSources.length >= MAX_PORTAL_SOURCES) {
      onClose()
      return
    }

    const next = [...currentSources, { type, id: q.id }]
    onClose()
    router.push(buildStudioSourcesUrl(next, { customerQuoteId }))
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>
        {isReplace ? 'Forrás cseréje' : 'Forrás hozzáadása'}
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {isReplace
            ? 'Válassz másik mentett vagy megrendelt ajánlatot erre a helyre.'
            : `Bármennyi lapszabászat és Nettfront (max. ${MAX_PORTAL_SOURCES}). Ugyanaz az ajánlat kétszer nem adható hozzá.`}
        </Typography>

        {atLimit ? (
          <Typography variant="body2" color="warning.main" sx={{ mb: 1.5 }}>
            Elérted a {MAX_PORTAL_SOURCES} forrás limitet. Törölj egyet, vagy cserélj.
          </Typography>
        ) : null}

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
          <Chip
            size="small"
            label={`Mind (${quotes.length})`}
            color={filter === 'all' ? 'success' : 'default'}
            variant={filter === 'all' ? 'filled' : 'outlined'}
            onClick={() => setFilter('all')}
            clickable
          />
          <Chip
            size="small"
            label={`Mentett (${draftCount})`}
            color={filter === 'draft' ? 'success' : 'default'}
            variant={filter === 'draft' ? 'filled' : 'outlined'}
            onClick={() => setFilter('draft')}
            clickable
          />
          <Chip
            size="small"
            label={`Megrendelt (${orderedCount})`}
            color={filter === 'ordered' ? 'success' : 'default'}
            variant={filter === 'ordered' ? 'filled' : 'outlined'}
            onClick={() => setFilter('ordered')}
            clickable
          />
        </Stack>

        {filtered.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nincs ajánlat ebben a szűrésben.
          </Typography>
        ) : (
          <List disablePadding>
            {filtered.map(q => {
              const selected = currentIds.has(q.id)
              const disabled = atLimit || (selected && !isReplace)
              return (
                <ListItemButton
                  key={`${q.origin}-${q.type}-${q.id}`}
                  selected={selected}
                  disabled={disabled}
                  onClick={() => handleSelect(q)}
                  sx={{ borderRadius: 1, mb: 0.5 }}
                >
                  <ListItemText
                    primary={q.quote_number}
                    secondary={`${
                      q.type === 'nettfront' ? 'Nettfront' : 'Lapszabászat'
                    } · ${q.origin === 'ordered' ? 'Megrendelt' : 'Mentett'} · ${formatFt(
                      q.final_total_after_discount
                    )}${selected ? ' · csatolva' : ''}`}
                    primaryTypographyProps={{ fontWeight: 600 }}
                  />
                </ListItemButton>
              )
            })}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Mégse</Button>
      </DialogActions>
    </Dialog>
  )
}
