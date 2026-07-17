'use client'

import React, { useMemo } from 'react'

import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
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
import InomatFinishBadge from './InomatFinishBadge'
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
  onSave?: () => void
  saveLoading?: boolean
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

/** Opti-style VÉGÖSSZEG chip chain: Nettó + ÁFA = Bruttó [- Kedvezmény = Végösszeg] */
function OptiVegosszegChips({
  net,
  vat,
  gross,
  discountPercent,
  discountAmount,
  finalGross,
  currency = 'HUF'
}: {
  net: number
  vat: number
  gross: number
  discountPercent: number
  discountAmount: number
  finalGross: number
  currency?: string
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        alignItems: 'center',
        flexWrap: 'wrap',
        justifyContent: 'flex-end'
      }}
    >
      <Typography component="span" variant="body1" sx={{ fontWeight: 'bold', mr: { xs: 0, sm: 1 } }}>
        VÉGÖSSZEG
      </Typography>
      <Chip
        component="div"
        label={
          <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
            <Typography component="span" variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
              Nettó
            </Typography>
            <Typography component="span" variant="body1" sx={{ fontWeight: 'bold' }}>
              {formatPrice(net, currency)}
            </Typography>
          </Box>
        }
        sx={{ height: 'auto', bgcolor: 'info.100', color: 'info.dark', px: 2 }}
      />
      <Typography component="span" variant="h6" sx={{ mx: 0.25 }}>
        +
      </Typography>
      <Chip
        component="div"
        label={
          <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
            <Typography component="span" variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
              ÁFA
            </Typography>
            <Typography component="span" variant="body1" sx={{ fontWeight: 'bold' }}>
              {formatPrice(vat, currency)}
            </Typography>
          </Box>
        }
        sx={{ height: 'auto', bgcolor: 'warning.100', color: 'warning.dark', px: 2 }}
      />
      <Typography component="span" variant="h6" sx={{ mx: 0.25 }}>
        =
      </Typography>
      <Chip
        component="div"
        label={
          <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
            <Typography component="span" variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.9 }}>
              Bruttó
            </Typography>
            <Typography component="span" variant="body1" sx={{ fontWeight: 'bold' }}>
              {formatPrice(gross, currency)}
            </Typography>
          </Box>
        }
        sx={{ height: 'auto', bgcolor: 'grey.300', color: 'text.primary', px: 2 }}
      />
      {discountPercent > 0 ? (
        <>
          <Typography component="span" variant="h6" sx={{ mx: 0.25 }}>
            -
          </Typography>
          <Chip
            component="div"
            label={
              <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                <Typography component="span" variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
                  Kedvezmény ({discountPercent}%)
                </Typography>
                <Typography component="span" variant="body1" sx={{ fontWeight: 'bold' }}>
                  {formatPrice(discountAmount, currency)}
                </Typography>
              </Box>
            }
            sx={{ height: 'auto', bgcolor: 'error.100', color: 'error.dark', px: 2 }}
          />
          <Typography component="span" variant="h6" sx={{ mx: 0.25 }}>
            =
          </Typography>
          <Chip
            component="div"
            label={
              <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                <Typography component="span" variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.9 }}>
                  Végösszeg
                </Typography>
                <Typography component="span" variant="h6" sx={{ fontWeight: 'bold' }}>
                  {formatPrice(finalGross, currency)}
                </Typography>
              </Box>
            }
            sx={{ height: 'auto', bgcolor: 'success.main', color: 'white', px: 2 }}
          />
        </>
      ) : (
        <Chip
          component="div"
          label={
            <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
              <Typography component="span" variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.9 }}>
                Végösszeg
              </Typography>
              <Typography component="span" variant="h6" sx={{ fontWeight: 'bold' }}>
                {formatPrice(gross, currency)}
              </Typography>
            </Box>
          }
          sx={{ height: 'auto', bgcolor: 'success.main', color: 'white', px: 2, ml: 1 }}
        />
      )}
    </Box>
  )
}

const accordionSummarySx = {
  bgcolor: 'grey.50',
  borderBottom: '2px solid',
  borderColor: 'success.main',
  '&:hover': { bgcolor: 'grey.100' }
} as const

function OptiQuoteAccordion({
  title,
  expanded,
  onExpanded,
  net,
  vat,
  gross,
  discountPercent,
  discountAmount,
  finalGross,
  currency = 'HUF',
  children
}: {
  title: string
  expanded: boolean
  onExpanded: (v: boolean) => void
  net: number
  vat: number
  gross: number
  discountPercent: number
  discountAmount: number
  finalGross: number
  currency?: string
  children: React.ReactNode
}) {
  return (
    <Accordion expanded={expanded} onChange={(_e, exp) => onExpanded(exp)}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={accordionSummarySx}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            pr: 2,
            gap: 2,
            flexWrap: 'wrap'
          }}
        >
          <Typography component="div" variant="h5" sx={{ fontWeight: 'bold' }}>
            {title}
          </Typography>
          <OptiVegosszegChips
            net={net}
            vat={vat}
            gross={gross}
            discountPercent={discountPercent}
            discountAmount={discountAmount}
            finalGross={finalGross}
            currency={currency}
          />
        </Box>
      </AccordionSummary>
      <AccordionDetails>{children}</AccordionDetails>
    </Accordion>
  )
}

type MoneyRow = {
  key: string
  label: React.ReactNode
  detail?: React.ReactNode
  net: number
  vat: number
  gross: number
  emphasize?: boolean
}

function OptiMoneyTable({
  headers,
  rows,
  totalLabel,
  totalNet,
  totalVat,
  totalGross,
  currency = 'HUF'
}: {
  headers: [string, ...string[]]
  rows: MoneyRow[]
  totalLabel: string
  totalNet: number
  totalVat: number
  totalGross: number
  currency?: string
}) {
  const descColSpan = headers.length

  return (
    <TableContainer component={Paper} sx={{ mb: 1 }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'grey.100' }}>
            {headers.map((h, i) => (
              <TableCell
                key={h}
                align={i === 0 ? 'left' : 'right'}
                sx={{ fontWeight: 'bold' }}
              >
                {h}
              </TableCell>
            ))}
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
          {rows.map(row => (
            <TableRow key={row.key} sx={row.emphasize ? { bgcolor: 'grey.50' } : undefined}>
              <TableCell colSpan={descColSpan}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography component="span" sx={{ fontWeight: row.emphasize ? 'bold' : 700 }}>
                    {row.label}
                  </Typography>
                  {row.detail}
                </Box>
              </TableCell>
              <TableCell align="right">{formatPrice(row.net, currency)}</TableCell>
              <TableCell align="right">{formatPrice(row.vat, currency)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'medium' }}>
                {formatPrice(row.gross, currency)}
              </TableCell>
            </TableRow>
          ))}
          <TableRow sx={{ bgcolor: 'grey.50' }}>
            <TableCell colSpan={descColSpan} sx={{ fontWeight: 'bold' }}>
              {totalLabel}
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
              {formatPrice(totalNet, currency)}
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
              {formatPrice(totalVat, currency)}
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
              {formatPrice(totalGross, currency)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default function FronttervezoGlobalQuotes({
  quoteAnchorRef,
  hasAnyLines,
  loading,
  onGenerate,
  onSave,
  saveLoading = false,
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
  const discount = customerDiscountPercent || 0

  const butorlapDiscountAmount = butorlapQuote ? (butorlapQuote.grand_total_gross * discount) / 100 : 0
  const butorlapFinal = butorlapQuote ? butorlapQuote.grand_total_gross - butorlapDiscountAmount : null

  const combined = useMemo(() => {
    let net = 0
    let vat = 0
    let gross = 0
    let discountGross = 0
    let final = 0
    let count = 0

    if (butorlapQuote && butorlapFinal !== null) {
      net += butorlapQuote.grand_total_net
      vat += butorlapQuote.grand_total_vat
      gross += butorlapQuote.grand_total_gross
      discountGross += butorlapDiscountAmount
      final += butorlapFinal
      count++
    }

    if (inomatQuote) {
      net += inomatQuote.totals.net
      vat += inomatQuote.totals.vat
      gross += inomatQuote.totals.gross
      discountGross += inomatQuote.totals.discountGross
      final += inomatQuote.totals.finalGross
      count++
    }

    if (aluQuote) {
      net += aluQuote.totals.net
      vat += aluQuote.totals.vat
      gross += aluQuote.totals.gross
      discountGross += aluQuote.totals.discountGross
      final += aluQuote.totals.finalGross
      count++
    }

    if (festettQuote) {
      net += festettQuote.totals.net
      vat += festettQuote.totals.vat
      gross += festettQuote.totals.gross
      discountGross += festettQuote.totals.discountGross
      final += festettQuote.totals.finalGross
      count++
    }

    if (foliasQuote) {
      net += foliasQuote.totals.net
      vat += foliasQuote.totals.vat
      gross += foliasQuote.totals.gross
      discountGross += foliasQuote.totals.discountGross
      final += foliasQuote.totals.finalGross
      count++
    }

    if (count < 2) return null

    return { net, vat, gross, discountGross, final }
  }, [
    aluQuote,
    butorlapDiscountAmount,
    butorlapFinal,
    butorlapQuote,
    festettQuote,
    foliasQuote,
    inomatQuote
  ])

  const currency = butorlapQuote?.currency ?? 'HUF'
  const hasQuote =
    !!butorlapQuote || !!inomatQuote || !!aluQuote || !!festettQuote || !!foliasQuote

  return (
    <Box ref={quoteAnchorRef} sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Button
          type="button"
          variant="contained"
          color="warning"
          size="large"
          disabled={loading || !hasAnyLines}
          onClick={onGenerate}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
          sx={{
            minWidth: 200,
            py: 1.5,
            px: 4,
            fontWeight: 800
          }}
        >
          {loading ? 'Számítás…' : hasQuote ? 'Ajánlat újraszámolása' : 'Ajánlat generálás'}
        </Button>

        {hasQuote ? (
          <Button
            type="button"
            variant="contained"
            color="primary"
            size="large"
            disabled={saveLoading || loading || !onSave}
            onClick={onSave}
            startIcon={saveLoading ? <CircularProgress size={18} color="inherit" /> : undefined}
            sx={{
              minWidth: 200,
              py: 1.5,
              px: 4,
              fontWeight: 800
            }}
          >
            {saveLoading ? 'Mentés…' : 'Árajánlat mentése'}
          </Button>
        ) : null}
      </Box>

      {combined ? (
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            borderWidth: 2,
            borderColor: 'success.main',
            bgcolor: 'grey.50'
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1.5 }}>
            Árajánlat összesen
          </Typography>
          <OptiVegosszegChips
            net={combined.net}
            vat={combined.vat}
            gross={combined.gross}
            discountPercent={discount}
            discountAmount={combined.discountGross}
            finalGross={combined.final}
            currency={currency}
          />
        </Paper>
      ) : null}

      {butorlapQuote && butorlapFinal !== null
        ? (() => {
            const panthely = butorlapQuote.materials.reduce(
              (acc, m) => {
                const p = m.additional_services?.panthelyfuras

                if (!p) return acc
                acc.net += p.net_price
                acc.vat += p.vat_amount
                acc.gross += p.gross_price

                return acc
              },
              { net: 0, vat: 0, gross: 0 }
            )

            const totalPantHoles = butorlapLines.reduce(
              (sum, r) => sum + (r.panthely ? r.panthely.mennyiseg * r.mennyiseg : 0),
              0
            )

            const rows: MoneyRow[] = butorlapQuote.materials.map(m => {
              const chargedSqm = m.boards.reduce((sum, b) => sum + b.charged_area_m2, 0)
              const pant = m.additional_services?.panthelyfuras
              const pantNet = pant?.net_price ?? 0
              const pantVat = pant?.vat_amount ?? 0
              const pantGross = pant?.gross_price ?? 0
              const panelsForMaterial = butorlapLines
                .filter(r => r.material.id === m.material_id)
                .reduce((sum, r) => sum + r.mennyiseg, 0)

              return {
                key: m.material_id,
                label: m.material_name,
                detail: (
                  <Typography component="span" variant="caption" color="text.secondary">
                    {panelsForMaterial} db · {chargedSqm.toFixed(2)} m² (anyag + él + vágás)
                  </Typography>
                ),
                net: m.total_net - pantNet,
                vat: m.total_vat - pantVat,
                gross: m.total_gross - pantGross
              }
            })

            if (panthely.gross > 0) {
              rows.push({
                key: 'pant',
                emphasize: true,
                label: 'Pánthelyfúrás',
                detail: (
                  <Typography component="span" variant="caption" color="text.secondary">
                    {totalPantHoles} db
                  </Typography>
                ),
                net: panthely.net,
                vat: panthely.vat,
                gross: panthely.gross
              })
            }

            return (
              <OptiQuoteAccordion
                title="Árajánlat — Bútorlap"
                expanded={butorlapExpanded}
                onExpanded={onButorlapExpanded}
                net={butorlapQuote.grand_total_net}
                vat={butorlapQuote.grand_total_vat}
                gross={butorlapQuote.grand_total_gross}
                discountPercent={discount}
                discountAmount={butorlapDiscountAmount}
                finalGross={butorlapFinal}
                currency={butorlapQuote.currency}
              >
                <OptiMoneyTable
                  headers={['Tétel']}
                  rows={rows}
                  totalLabel="Bútorlap összesen:"
                  totalNet={butorlapQuote.grand_total_net}
                  totalVat={butorlapQuote.grand_total_vat}
                  totalGross={butorlapQuote.grand_total_gross}
                  currency={butorlapQuote.currency}
                />
              </OptiQuoteAccordion>
            )
          })()
        : null}

      {inomatQuote ? (
        <OptiQuoteAccordion
          title="Árajánlat — INOMAT"
          expanded={inomatExpanded}
          onExpanded={onInomatExpanded}
          net={inomatQuote.totals.net}
          vat={inomatQuote.totals.vat}
          gross={inomatQuote.totals.gross}
          discountPercent={inomatQuote.totals.discountPercent}
          discountAmount={inomatQuote.totals.discountGross}
          finalGross={inomatQuote.totals.finalGross}
        >
          <OptiMoneyTable
            headers={['Szín / tétel']}
            rows={[
              ...inomatQuote.rows.map(r => ({
                key: r.szin,
                label: r.szin,
                detail: (
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <InomatFinishBadge szin={r.szin} />
                    <Typography component="span" variant="caption" color="text.secondary">
                      {r.panelsDb} db · {r.sqm.toFixed(2)} m² · {formatPrice(r.grossPerSqm, 'HUF')}/m²
                    </Typography>
                  </Box>
                ),
                net: r.net,
                vat: r.vat,
                gross: r.gross
              })),
              ...(inomatQuote.panthely.holesDb > 0
                ? [
                    {
                      key: 'pant',
                      emphasize: true,
                      label: 'Pánthelyfúrás',
                      detail: (
                        <Typography component="span" variant="caption" color="text.secondary">
                          {inomatQuote.panthely.holesDb} db
                        </Typography>
                      ),
                      net: inomatQuote.panthely.net,
                      vat: inomatQuote.panthely.vat,
                      gross: inomatQuote.panthely.gross
                    } satisfies MoneyRow
                  ]
                : [])
            ]}
            totalLabel="INOMAT összesen:"
            totalNet={inomatQuote.totals.net}
            totalVat={inomatQuote.totals.vat}
            totalGross={inomatQuote.totals.gross}
          />
        </OptiQuoteAccordion>
      ) : null}

      {aluQuote ? (
        <OptiQuoteAccordion
          title="Árajánlat — ALU"
          expanded={aluExpanded}
          onExpanded={onAluExpanded}
          net={aluQuote.totals.net}
          vat={aluQuote.totals.vat}
          gross={aluQuote.totals.gross}
          discountPercent={aluQuote.totals.discountPercent}
          discountAmount={aluQuote.totals.discountGross}
          finalGross={aluQuote.totals.finalGross}
        >
          <OptiMoneyTable
            headers={['Profil / szín']}
            rows={aluQuote.rows.map(r => ({
              key: `${r.profil}-${r.szin}`,
              label: `${r.profil} · ${r.szin}`,
              detail: (
                <Typography component="span" variant="caption" color="text.secondary">
                  {r.panelsDb} db · {r.sqm.toFixed(2)} m² · {formatPrice(r.grossPerSqm, 'HUF')}/m²
                </Typography>
              ),
              net: r.net,
              vat: r.vat,
              gross: r.gross
            }))}
            totalLabel="ALU összesen:"
            totalNet={aluQuote.totals.net}
            totalVat={aluQuote.totals.vat}
            totalGross={aluQuote.totals.gross}
          />
        </OptiQuoteAccordion>
      ) : null}

      {festettQuote ? (
        <OptiQuoteAccordion
          title="Árajánlat — Festett"
          expanded={festettExpanded}
          onExpanded={onFestettExpanded}
          net={festettQuote.totals.net}
          vat={festettQuote.totals.vat}
          gross={festettQuote.totals.gross}
          discountPercent={festettQuote.totals.discountPercent}
          discountAmount={festettQuote.totals.discountGross}
          finalGross={festettQuote.totals.finalGross}
        >
          <OptiMoneyTable
            headers={['Tétel']}
            rows={[
              ...festettQuote.rows.map(r => ({
                key: `${r.marasMinta}-${r.szin}-${r.fenyseg}`,
                label: `${r.marasMinta} · ${r.szin}`,
                detail: (
                  <Typography component="span" variant="caption" color="text.secondary">
                    {r.fenyseg} · {r.panelsDb} db · {r.sqm.toFixed(2)} m² · {formatPrice(r.grossPerSqm, 'HUF')}/m²
                  </Typography>
                ),
                net: r.net,
                vat: r.vat,
                gross: r.gross
              })),
              ...(festettQuote.panthely.holesDb > 0
                ? [
                    {
                      key: 'pant',
                      emphasize: true,
                      label: 'Pánthelyfúrás',
                      detail: (
                        <Typography component="span" variant="caption" color="text.secondary">
                          {festettQuote.panthely.holesDb} db
                        </Typography>
                      ),
                      net: festettQuote.panthely.net,
                      vat: festettQuote.panthely.vat,
                      gross: festettQuote.panthely.gross
                    } satisfies MoneyRow
                  ]
                : [])
            ]}
            totalLabel="Festett összesen:"
            totalNet={festettQuote.totals.net}
            totalVat={festettQuote.totals.vat}
            totalGross={festettQuote.totals.gross}
          />
        </OptiQuoteAccordion>
      ) : null}

      {foliasQuote ? (
        <OptiQuoteAccordion
          title="Árajánlat — Fóliás"
          expanded={foliasExpanded}
          onExpanded={onFoliasExpanded}
          net={foliasQuote.totals.net}
          vat={foliasQuote.totals.vat}
          gross={foliasQuote.totals.gross}
          discountPercent={foliasQuote.totals.discountPercent}
          discountAmount={foliasQuote.totals.discountGross}
          finalGross={foliasQuote.totals.finalGross}
        >
          <OptiMoneyTable
            headers={['Tétel']}
            rows={[
              ...foliasQuote.rows.map(r => ({
                key: `${r.marasMinta}-${r.szin}`,
                label: `${r.marasMinta} · ${r.szin}`,
                detail: (
                  <Typography component="span" variant="caption" color="text.secondary">
                    {r.panelsDb} db · {r.sqm.toFixed(2)} m² · {formatPrice(r.grossPerSqm, 'HUF')}/m²
                  </Typography>
                ),
                net: r.net,
                vat: r.vat,
                gross: r.gross
              })),
              ...(foliasQuote.panthely.holesDb > 0
                ? [
                    {
                      key: 'pant',
                      emphasize: true,
                      label: 'Pánthelyfúrás',
                      detail: (
                        <Typography component="span" variant="caption" color="text.secondary">
                          {foliasQuote.panthely.holesDb} db
                        </Typography>
                      ),
                      net: foliasQuote.panthely.net,
                      vat: foliasQuote.panthely.vat,
                      gross: foliasQuote.panthely.gross
                    } satisfies MoneyRow
                  ]
                : [])
            ]}
            totalLabel="Fóliás összesen:"
            totalNet={foliasQuote.totals.net}
            totalVat={foliasQuote.totals.vat}
            totalGross={foliasQuote.totals.gross}
          />
        </OptiQuoteAccordion>
      ) : null}
    </Box>
  )
}
