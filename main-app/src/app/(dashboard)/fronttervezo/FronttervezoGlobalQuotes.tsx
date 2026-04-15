'use client'

import React, { useMemo } from 'react'

import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material'

import type { ButorlapLineItem } from './FronttervezoButorlapSection'
import type { FronttervezoAluQuoteResult } from '@/lib/pricing/fronttervezoAluQuote'
import type { FronttervezoFestettQuoteResult } from '@/lib/pricing/fronttervezoFestettQuote'
import type { FronttervezoFoliasQuoteResult } from '@/lib/pricing/fronttervezoFoliasQuote'
import type { FronttervezoInomatQuoteResult } from '@/lib/pricing/fronttervezoInomatQuote'
import { formatPrice, type QuoteResult } from '@/lib/pricing/quoteCalculations'

type FronttervezoGlobalQuotesProps = {
  quoteAnchorRef: React.RefObject<HTMLDivElement | null>
  hasAnyLines: boolean
  loading: boolean
  onGenerate: () => void
  customerDiscountPercent: number

  butorlapQuote: QuoteResult | null
  butorlapLines: ButorlapLineItem[]
  butorlapExpanded: boolean
  onButorlapExpanded: (expanded: boolean) => void

  inomatQuote: FronttervezoInomatQuoteResult | null
  inomatExpanded: boolean
  onInomatExpanded: (expanded: boolean) => void

  aluQuote: FronttervezoAluQuoteResult | null
  aluExpanded: boolean
  onAluExpanded: (expanded: boolean) => void

  festettQuote: FronttervezoFestettQuoteResult | null
  festettExpanded: boolean
  onFestettExpanded: (expanded: boolean) => void

  foliasQuote: FronttervezoFoliasQuoteResult | null
  foliasExpanded: boolean
  onFoliasExpanded: (expanded: boolean) => void
}

export default function FronttervezoGlobalQuotes({
  quoteAnchorRef,
  hasAnyLines,
  loading,
  onGenerate,
  customerDiscountPercent,
  butorlapQuote,
  butorlapLines,
  butorlapExpanded,
  onButorlapExpanded,
  inomatQuote,
  inomatExpanded,
  onInomatExpanded,
  aluQuote,
  aluExpanded,
  onAluExpanded,
  festettQuote,
  festettExpanded,
  onFestettExpanded,
  foliasQuote,
  foliasExpanded,
  onFoliasExpanded
}: FronttervezoGlobalQuotesProps) {
  const multiTypeCombinedGross = useMemo(() => {
    const d = customerDiscountPercent || 0
    const parts: number[] = []

    if (butorlapQuote) {
      parts.push(
        d > 0 ? butorlapQuote.grand_total_gross - (butorlapQuote.grand_total_gross * d) / 100 : butorlapQuote.grand_total_gross
      )
    }

    if (inomatQuote) parts.push(inomatQuote.totals.finalGross)
    if (aluQuote) parts.push(aluQuote.totals.finalGross)
    if (festettQuote) parts.push(festettQuote.totals.finalGross)
    if (foliasQuote) parts.push(foliasQuote.totals.finalGross)

    if (parts.length < 2) return null

    return parts.reduce((a, b) => a + b, 0)
  }, [aluQuote, butorlapQuote, customerDiscountPercent, festettQuote, foliasQuote, inomatQuote])

  const multiTypeSummaryLabel = useMemo(() => {
    const labels: string[] = []

    if (butorlapQuote) labels.push('Bútorlap')
    if (inomatQuote) labels.push('INOMAT')
    if (aluQuote) labels.push('ALU')
    if (festettQuote) labels.push('Festett')
    if (foliasQuote) labels.push('Fóliás')

    return labels.length >= 2 ? `Összesen (${labels.join(' + ')})` : ''
  }, [aluQuote, butorlapQuote, festettQuote, foliasQuote, inomatQuote])

  return (
    <Box ref={quoteAnchorRef} sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Button
          type="button"
          variant="contained"
          color="warning"
          size="large"
          disabled={loading || !hasAnyLines}
          onClick={onGenerate}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
        >
          {loading ? 'Számítás…' : 'Ajánlat generálás'}
        </Button>
      </Box>

      {multiTypeCombinedGross !== null ? (
        <Card
          variant="outlined"
          sx={{
            borderColor: 'success.main',
            borderWidth: 2,
            bgcolor: theme => (theme.palette.mode === 'dark' ? 'success.dark' : 'success.50')
          }}
        >
          <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
              {multiTypeSummaryLabel}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'success.dark' }}>
              {formatPrice(multiTypeCombinedGross, butorlapQuote?.currency ?? 'HUF')}
            </Typography>
          </CardContent>
        </Card>
      ) : null}

      {butorlapQuote ? (
        <Accordion expanded={butorlapExpanded} onChange={(_e, exp) => onButorlapExpanded(exp)}>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              bgcolor: 'grey.50',
              borderBottom: '2px solid',
              borderColor: 'success.main',
              '&:hover': { bgcolor: 'grey.100' }
            }}
          >
            {(() => {
              const discountPercent = customerDiscountPercent || 0
              const discountAmount = (butorlapQuote.grand_total_gross * discountPercent) / 100
              const finalTotal = butorlapQuote.grand_total_gross - discountAmount

              return (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 2 }}>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    Árajánlat — Bútorlap
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', mr: 1.5 }}>
                      VÉGÖSSZEG
                    </Typography>
                    <Chip
                      label={
                        <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
                            Nettó
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {formatPrice(butorlapQuote.grand_total_net, butorlapQuote.currency)}
                          </Typography>
                        </Box>
                      }
                      sx={{ height: 'auto', bgcolor: 'info.100', color: 'info.dark', px: 2 }}
                    />
                    <Typography variant="h6" sx={{ mx: 0.25 }}>
                      +
                    </Typography>
                    <Chip
                      label={
                        <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
                            ÁFA
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {formatPrice(butorlapQuote.grand_total_vat, butorlapQuote.currency)}
                          </Typography>
                        </Box>
                      }
                      sx={{ height: 'auto', bgcolor: 'warning.100', color: 'warning.dark', px: 2 }}
                    />
                    <Typography variant="h6" sx={{ mx: 0.25 }}>
                      =
                    </Typography>
                    <Chip
                      label={
                        <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.9 }}>
                            Bruttó
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {formatPrice(butorlapQuote.grand_total_gross, butorlapQuote.currency)}
                          </Typography>
                        </Box>
                      }
                      sx={{ height: 'auto', bgcolor: 'grey.300', color: 'text.primary', px: 2 }}
                    />
                    {discountPercent > 0 ? (
                      <>
                        <Typography variant="h6" sx={{ mx: 0.25 }}>
                          -
                        </Typography>
                        <Chip
                          label={
                            <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                              <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
                                Kedvezmény ({discountPercent}%)
                              </Typography>
                              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                {formatPrice(discountAmount, butorlapQuote.currency)}
                              </Typography>
                            </Box>
                          }
                          sx={{ height: 'auto', bgcolor: 'error.100', color: 'error.dark', px: 2 }}
                        />
                        <Typography variant="h6" sx={{ mx: 0.25 }}>
                          =
                        </Typography>
                        <Chip
                          label={
                            <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                              <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.9 }}>
                                Végösszeg
                              </Typography>
                              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                                {formatPrice(finalTotal, butorlapQuote.currency)}
                              </Typography>
                            </Box>
                          }
                          sx={{ height: 'auto', bgcolor: 'success.main', color: 'white', px: 2 }}
                        />
                      </>
                    ) : (
                      <Chip
                        label={
                          <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                            <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.9 }}>
                              Végösszeg
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                              {formatPrice(butorlapQuote.grand_total_gross, butorlapQuote.currency)}
                            </Typography>
                          </Box>
                        }
                        sx={{ height: 'auto', bgcolor: 'success.main', color: 'white', px: 2, ml: 1 }}
                      />
                    )}
                  </Box>
                </Box>
              )
            })()}
          </AccordionSummary>
          <AccordionDetails>
            {(() => {
              const panthely = butorlapQuote.materials.reduce(
                (acc, m) => {
                  const p = m.additional_services?.panthelyfuras

                  if (!p) {
                    return acc
                  }

                  acc.net += p.net_price
                  acc.vat += p.vat_amount
                  acc.gross += p.gross_price

                  return acc
                },
                { net: 0, vat: 0, gross: 0 }
              )

              const totalPanels = butorlapLines.reduce((sum, r) => sum + r.mennyiseg, 0)

              const totalPantHoles = butorlapLines.reduce(
                (sum, r) => sum + (r.panthely ? r.panthely.mennyiseg * r.mennyiseg : 0),
                0
              )

              return (
                <>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: 'grey.100' }}>
                          <TableCell sx={{ fontWeight: 'bold' }}>Anyag</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                            Mennyiség
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                            m²
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                            Nettó
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                            ÁFA
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                            Bruttó
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {butorlapQuote.materials.map(m => {
                          const chargedSqm = m.boards.reduce((sum, b) => sum + b.charged_area_m2, 0)
                          const pant = m.additional_services?.panthelyfuras
                          const pantNet = pant?.net_price ?? 0
                          const pantVat = pant?.vat_amount ?? 0
                          const pantGross = pant?.gross_price ?? 0

                          const productNet = m.total_net - pantNet
                          const productVat = m.total_vat - pantVat
                          const productGross = m.total_gross - pantGross

                          const panelsForMaterial = butorlapLines
                            .filter(r => r.material.id === m.material_id)
                            .reduce((sum, r) => sum + r.mennyiseg, 0)

                          return (
                            <TableRow key={m.material_id}>
                              <TableCell sx={{ fontWeight: 700 }}>{m.material_name}</TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {panelsForMaterial} db
                                </Typography>
                              </TableCell>
                              <TableCell align="right">{chargedSqm.toFixed(2)}</TableCell>
                              <TableCell align="right">{formatPrice(productNet, m.currency)}</TableCell>
                              <TableCell align="right">{formatPrice(productVat, m.currency)}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>
                                {formatPrice(productGross, m.currency)}
                              </TableCell>
                            </TableRow>
                          )
                        })}

                        {panthely.gross > 0 ? (
                          <TableRow sx={{ bgcolor: 'grey.50' }}>
                            <TableCell sx={{ fontWeight: 700 }}>Pánthelyfúrás</TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {totalPanels} db
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Pánt: {totalPantHoles} db
                              </Typography>
                            </TableCell>
                            <TableCell align="right">—</TableCell>
                            <TableCell align="right">{formatPrice(panthely.net, butorlapQuote.currency)}</TableCell>
                            <TableCell align="right">{formatPrice(panthely.vat, butorlapQuote.currency)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                              {formatPrice(panthely.gross, butorlapQuote.currency)}
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )
            })()}
          </AccordionDetails>
        </Accordion>
      ) : null}

      {inomatQuote ? (
        <Accordion expanded={inomatExpanded} onChange={(_e, exp) => onInomatExpanded(exp)}>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              bgcolor: 'grey.50',
              borderBottom: '2px solid',
              borderColor: 'success.main',
              '&:hover': { bgcolor: 'grey.100' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 2 }}>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                Árajánlat — INOMAT
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Typography variant="body1" sx={{ fontWeight: 'bold', mr: 1.5 }}>
                  VÉGÖSSZEG
                </Typography>
                <Chip
                  label={
                    <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
                        Nettó
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        {formatPrice(inomatQuote.totals.net, 'HUF')}
                      </Typography>
                    </Box>
                  }
                  sx={{ height: 'auto', bgcolor: 'info.100', color: 'info.dark', px: 2 }}
                />
                <Typography variant="h6" sx={{ mx: 0.25 }}>
                  +
                </Typography>
                <Chip
                  label={
                    <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
                        ÁFA
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        {formatPrice(inomatQuote.totals.vat, 'HUF')}
                      </Typography>
                    </Box>
                  }
                  sx={{ height: 'auto', bgcolor: 'warning.100', color: 'warning.dark', px: 2 }}
                />
                <Typography variant="h6" sx={{ mx: 0.25 }}>
                  =
                </Typography>
                <Chip
                  label={
                    <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.9 }}>
                        Bruttó
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        {formatPrice(inomatQuote.totals.gross, 'HUF')}
                      </Typography>
                    </Box>
                  }
                  sx={{ height: 'auto', bgcolor: 'grey.300', color: 'text.primary', px: 2 }}
                />
                {inomatQuote.totals.discountPercent > 0 ? (
                  <>
                    <Typography variant="h6" sx={{ mx: 0.25 }}>
                      -
                    </Typography>
                    <Chip
                      label={
                        <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
                            Kedvezmény ({inomatQuote.totals.discountPercent}%)
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {formatPrice(inomatQuote.totals.discountGross, 'HUF')}
                          </Typography>
                        </Box>
                      }
                      sx={{ height: 'auto', bgcolor: 'error.100', color: 'error.dark', px: 2 }}
                    />
                    <Typography variant="h6" sx={{ mx: 0.25 }}>
                      =
                    </Typography>
                    <Chip
                      label={
                        <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.9 }}>
                            Végösszeg
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            {formatPrice(inomatQuote.totals.finalGross, 'HUF')}
                          </Typography>
                        </Box>
                      }
                      sx={{ height: 'auto', bgcolor: 'success.main', color: 'white', px: 2 }}
                    />
                  </>
                ) : (
                  <Chip
                    label={
                      <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.9 }}>
                          Végösszeg
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                          {formatPrice(inomatQuote.totals.gross, 'HUF')}
                        </Typography>
                      </Box>
                    }
                    sx={{ height: 'auto', bgcolor: 'success.main', color: 'white', px: 2, ml: 1 }}
                  />
                )}
              </Box>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Szín</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      Mennyiség
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      m²
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      Nettó
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      ÁFA
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      Bruttó
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {inomatQuote.rows.map(r => (
                    <TableRow key={r.szin}>
                      <TableCell sx={{ fontWeight: 700 }}>{r.szin}</TableCell>
                      <TableCell align="right">{r.panelsDb} db</TableCell>
                      <TableCell align="right">{r.sqm.toFixed(2)}</TableCell>
                      <TableCell align="right">{formatPrice(r.net, 'HUF')}</TableCell>
                      <TableCell align="right">{formatPrice(r.vat, 'HUF')}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatPrice(r.gross, 'HUF')}
                      </TableCell>
                    </TableRow>
                  ))}
                  {inomatQuote.panthely.holesDb > 0 ? (
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell sx={{ fontWeight: 700 }}>Pánthelyfúrás</TableCell>
                      <TableCell align="right">{inomatQuote.panthely.panelsDb} db</TableCell>
                      <TableCell align="right">—</TableCell>
                      <TableCell align="right">{formatPrice(inomatQuote.panthely.net, 'HUF')}</TableCell>
                      <TableCell align="right">{formatPrice(inomatQuote.panthely.vat, 'HUF')}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatPrice(inomatQuote.panthely.gross, 'HUF')}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      ) : null}

      {aluQuote ? (
        <Accordion expanded={aluExpanded} onChange={(_e, exp) => onAluExpanded(exp)}>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              bgcolor: 'grey.50',
              borderBottom: '2px solid',
              borderColor: 'success.main',
              '&:hover': { bgcolor: 'grey.100' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 2 }}>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                Árajánlat — ALU
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Typography variant="body1" sx={{ fontWeight: 'bold', mr: 1.5 }}>
                  VÉGÖSSZEG
                </Typography>
                <Chip
                  label={
                    <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
                        Nettó
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        {formatPrice(aluQuote.totals.net, 'HUF')}
                      </Typography>
                    </Box>
                  }
                  sx={{ height: 'auto', bgcolor: 'info.100', color: 'info.dark', px: 2 }}
                />
                <Typography variant="h6" sx={{ mx: 0.25 }}>
                  +
                </Typography>
                <Chip
                  label={
                    <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
                        ÁFA
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        {formatPrice(aluQuote.totals.vat, 'HUF')}
                      </Typography>
                    </Box>
                  }
                  sx={{ height: 'auto', bgcolor: 'warning.100', color: 'warning.dark', px: 2 }}
                />
                <Typography variant="h6" sx={{ mx: 0.25 }}>
                  =
                </Typography>
                <Chip
                  label={
                    <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.9 }}>
                        Bruttó
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        {formatPrice(aluQuote.totals.gross, 'HUF')}
                      </Typography>
                    </Box>
                  }
                  sx={{ height: 'auto', bgcolor: 'grey.300', color: 'text.primary', px: 2 }}
                />
                {aluQuote.totals.discountPercent > 0 ? (
                  <>
                    <Typography variant="h6" sx={{ mx: 0.25 }}>
                      -
                    </Typography>
                    <Chip
                      label={
                        <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
                            Kedvezmény ({aluQuote.totals.discountPercent}%)
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {formatPrice(aluQuote.totals.discountGross, 'HUF')}
                          </Typography>
                        </Box>
                      }
                      sx={{ height: 'auto', bgcolor: 'error.100', color: 'error.dark', px: 2 }}
                    />
                    <Typography variant="h6" sx={{ mx: 0.25 }}>
                      =
                    </Typography>
                    <Chip
                      label={
                        <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.9 }}>
                            Végösszeg
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            {formatPrice(aluQuote.totals.finalGross, 'HUF')}
                          </Typography>
                        </Box>
                      }
                      sx={{ height: 'auto', bgcolor: 'success.main', color: 'white', px: 2 }}
                    />
                  </>
                ) : (
                  <Chip
                    label={
                      <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.9 }}>
                          Végösszeg
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                          {formatPrice(aluQuote.totals.gross, 'HUF')}
                        </Typography>
                      </Box>
                    }
                    sx={{ height: 'auto', bgcolor: 'success.main', color: 'white', px: 2, ml: 1 }}
                  />
                )}
              </Box>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Aluprofil</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Szín</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      Mennyiség
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      m²
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      Nettó
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      ÁFA
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      Bruttó
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {aluQuote.rows.map(r => (
                    <TableRow key={`${r.profil}-${r.szin}`}>
                      <TableCell sx={{ fontWeight: 700 }}>{r.profil}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{r.szin}</TableCell>
                      <TableCell align="right">{r.panelsDb} db</TableCell>
                      <TableCell align="right">{r.sqm.toFixed(2)}</TableCell>
                      <TableCell align="right">{formatPrice(r.net, 'HUF')}</TableCell>
                      <TableCell align="right">{formatPrice(r.vat, 'HUF')}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatPrice(r.gross, 'HUF')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      ) : null}

      {festettQuote ? (
        <Accordion expanded={festettExpanded} onChange={(_e, exp) => onFestettExpanded(exp)}>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              bgcolor: 'grey.50',
              borderBottom: '2px solid',
              borderColor: 'success.main',
              '&:hover': { bgcolor: 'grey.100' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 2 }}>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                Árajánlat — FESTETT
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Typography variant="body1" sx={{ fontWeight: 'bold', mr: 1.5 }}>
                  VÉGÖSSZEG
                </Typography>
                <Chip
                  label={
                    <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
                        Nettó
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        {formatPrice(festettQuote.totals.net, 'HUF')}
                      </Typography>
                    </Box>
                  }
                  sx={{ height: 'auto', bgcolor: 'info.100', color: 'info.dark', px: 2 }}
                />
                <Typography variant="h6" sx={{ mx: 0.25 }}>
                  +
                </Typography>
                <Chip
                  label={
                    <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
                        ÁFA
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        {formatPrice(festettQuote.totals.vat, 'HUF')}
                      </Typography>
                    </Box>
                  }
                  sx={{ height: 'auto', bgcolor: 'warning.100', color: 'warning.dark', px: 2 }}
                />
                <Typography variant="h6" sx={{ mx: 0.25 }}>
                  =
                </Typography>
                <Chip
                  label={
                    <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.9 }}>
                        Bruttó
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        {formatPrice(festettQuote.totals.gross, 'HUF')}
                      </Typography>
                    </Box>
                  }
                  sx={{ height: 'auto', bgcolor: 'grey.300', color: 'text.primary', px: 2 }}
                />
                {festettQuote.totals.discountPercent > 0 ? (
                  <>
                    <Typography variant="h6" sx={{ mx: 0.25 }}>
                      -
                    </Typography>
                    <Chip
                      label={
                        <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
                            Kedvezmény ({festettQuote.totals.discountPercent}%)
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {formatPrice(festettQuote.totals.discountGross, 'HUF')}
                          </Typography>
                        </Box>
                      }
                      sx={{ height: 'auto', bgcolor: 'error.100', color: 'error.dark', px: 2 }}
                    />
                    <Typography variant="h6" sx={{ mx: 0.25 }}>
                      =
                    </Typography>
                    <Chip
                      label={
                        <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.9 }}>
                            Végösszeg
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            {formatPrice(festettQuote.totals.finalGross, 'HUF')}
                          </Typography>
                        </Box>
                      }
                      sx={{ height: 'auto', bgcolor: 'success.main', color: 'white', px: 2 }}
                    />
                  </>
                ) : (
                  <Chip
                    label={
                      <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.9 }}>
                          Végösszeg
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                          {formatPrice(festettQuote.totals.gross, 'HUF')}
                        </Typography>
                      </Box>
                    }
                    sx={{ height: 'auto', bgcolor: 'success.main', color: 'white', px: 2, ml: 1 }}
                  />
                )}
              </Box>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Marás minta</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Szín</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Fényesség</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      Mennyiség
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      m²
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      Nettó
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      ÁFA
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      Bruttó
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {festettQuote.rows.map(r => (
                    <TableRow key={`${r.marasMinta}-${r.szin}-${r.fenyseg}`}>
                      <TableCell sx={{ fontWeight: 700 }}>{r.marasMinta}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{r.szin}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{r.fenyseg}</TableCell>
                      <TableCell align="right">{r.panelsDb} db</TableCell>
                      <TableCell align="right">{r.sqm.toFixed(2)}</TableCell>
                      <TableCell align="right">{formatPrice(r.net, 'HUF')}</TableCell>
                      <TableCell align="right">{formatPrice(r.vat, 'HUF')}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatPrice(r.gross, 'HUF')}
                      </TableCell>
                    </TableRow>
                  ))}
                  {festettQuote.panthely.holesDb > 0 ? (
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell colSpan={3} sx={{ fontWeight: 700 }}>
                        Pánthelyfúrás
                      </TableCell>
                      <TableCell align="right">{festettQuote.panthely.panelsDb} db</TableCell>
                      <TableCell align="right">—</TableCell>
                      <TableCell align="right">{formatPrice(festettQuote.panthely.net, 'HUF')}</TableCell>
                      <TableCell align="right">{formatPrice(festettQuote.panthely.vat, 'HUF')}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatPrice(festettQuote.panthely.gross, 'HUF')}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      ) : null}

      {foliasQuote ? (
        <Accordion expanded={foliasExpanded} onChange={(_e, exp) => onFoliasExpanded(exp)}>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              bgcolor: 'grey.50',
              borderBottom: '2px solid',
              borderColor: 'success.main',
              '&:hover': { bgcolor: 'grey.100' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 2 }}>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                Árajánlat — FÓLIÁS
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Typography variant="body1" sx={{ fontWeight: 'bold', mr: 1.5 }}>
                  VÉGÖSSZEG
                </Typography>
                <Chip
                  label={
                    <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
                        Nettó
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        {formatPrice(foliasQuote.totals.net, 'HUF')}
                      </Typography>
                    </Box>
                  }
                  sx={{ height: 'auto', bgcolor: 'info.100', color: 'info.dark', px: 2 }}
                />
                <Typography variant="h6" sx={{ mx: 0.25 }}>
                  +
                </Typography>
                <Chip
                  label={
                    <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
                        ÁFA
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        {formatPrice(foliasQuote.totals.vat, 'HUF')}
                      </Typography>
                    </Box>
                  }
                  sx={{ height: 'auto', bgcolor: 'warning.100', color: 'warning.dark', px: 2 }}
                />
                <Typography variant="h6" sx={{ mx: 0.25 }}>
                  =
                </Typography>
                <Chip
                  label={
                    <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.9 }}>
                        Bruttó
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        {formatPrice(foliasQuote.totals.gross, 'HUF')}
                      </Typography>
                    </Box>
                  }
                  sx={{ height: 'auto', bgcolor: 'grey.300', color: 'text.primary', px: 2 }}
                />
                {foliasQuote.totals.discountPercent > 0 ? (
                  <>
                    <Typography variant="h6" sx={{ mx: 0.25 }}>
                      -
                    </Typography>
                    <Chip
                      label={
                        <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
                            Kedvezmény ({foliasQuote.totals.discountPercent}%)
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {formatPrice(foliasQuote.totals.discountGross, 'HUF')}
                          </Typography>
                        </Box>
                      }
                      sx={{ height: 'auto', bgcolor: 'error.100', color: 'error.dark', px: 2 }}
                    />
                    <Typography variant="h6" sx={{ mx: 0.25 }}>
                      =
                    </Typography>
                    <Chip
                      label={
                        <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.9 }}>
                            Végösszeg
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            {formatPrice(foliasQuote.totals.finalGross, 'HUF')}
                          </Typography>
                        </Box>
                      }
                      sx={{ height: 'auto', bgcolor: 'success.main', color: 'white', px: 2 }}
                    />
                  </>
                ) : (
                  <Chip
                    label={
                      <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.9 }}>
                          Végösszeg
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                          {formatPrice(foliasQuote.totals.gross, 'HUF')}
                        </Typography>
                      </Box>
                    }
                    sx={{ height: 'auto', bgcolor: 'success.main', color: 'white', px: 2, ml: 1 }}
                  />
                )}
              </Box>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Marás minta</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Szín</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      Mennyiség
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      m²
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      Nettó
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      ÁFA
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      Bruttó
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {foliasQuote.rows.map(r => (
                    <TableRow key={`${r.marasMinta}-${r.szin}`}>
                      <TableCell sx={{ fontWeight: 700 }}>{r.marasMinta}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{r.szin}</TableCell>
                      <TableCell align="right">{r.panelsDb} db</TableCell>
                      <TableCell align="right">{r.sqm.toFixed(2)}</TableCell>
                      <TableCell align="right">{formatPrice(r.net, 'HUF')}</TableCell>
                      <TableCell align="right">{formatPrice(r.vat, 'HUF')}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatPrice(r.gross, 'HUF')}
                      </TableCell>
                    </TableRow>
                  ))}
                  {foliasQuote.panthely.holesDb > 0 ? (
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell colSpan={2} sx={{ fontWeight: 700 }}>
                        Pánthelyfúrás
                      </TableCell>
                      <TableCell align="right">{foliasQuote.panthely.panelsDb} db</TableCell>
                      <TableCell align="right">—</TableCell>
                      <TableCell align="right">{formatPrice(foliasQuote.panthely.net, 'HUF')}</TableCell>
                      <TableCell align="right">{formatPrice(foliasQuote.panthely.vat, 'HUF')}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatPrice(foliasQuote.panthely.gross, 'HUF')}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      ) : null}
    </Box>
  )
}
