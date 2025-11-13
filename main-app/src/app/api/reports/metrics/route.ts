import { NextRequest, NextResponse } from 'next/server'

import { supabaseServer } from '@/lib/supabase-server'

interface MonthRange {
  start: Date
  end: Date
  year: number
  month: number
  iso: string
  label: string
}

interface QuoteRecord {
  id: string
  ready_at: string | null
  created_at: string | null
  final_total_after_discount: number | null
  production_machine_id: string | null
  production_machines: {
    machine_name: string | null
  } | null
}

interface MaterialPricingRow {
  quote_id: string
  charged_sqm: number | null
  cutting_length_m: number | null
  material_net: number | null
  material_gross: number | null
  cutting_gross: number | null
  edge_materials_net: number | null
  materials: {
    multiplier: number | null
    vat?: {
      kulcs: number | null
    } | null
  } | null
}

interface CuttingFeeRow {
  fee_per_meter: number | null
  vat?: {
    kulcs: number | null
  } | null
}

function getMonthRange(monthParam?: string | null): MonthRange {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  let targetYear = now.getUTCFullYear()
  let targetMonth = now.getUTCMonth() + 1

  if (monthParam) {
    const [yearStr, monthStr] = monthParam.split('-')
    const parsedYear = Number(yearStr)
    const parsedMonth = Number(monthStr)
    if (
      !Number.isNaN(parsedYear) &&
      !Number.isNaN(parsedMonth) &&
      parsedMonth >= 1 &&
      parsedMonth <= 12
    ) {
      targetYear = parsedYear
      targetMonth = parsedMonth
    }
  }

  const start = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999))

  const iso = `${targetYear}-${String(targetMonth).padStart(2, '0')}`
  const label = new Date(Date.UTC(targetYear, targetMonth - 1, 1)).toLocaleDateString('hu-HU', {
    year: 'numeric',
    month: 'long'
  })

  return {
    start,
    end,
    year: targetYear,
    month: targetMonth,
    iso,
    label
  }
}

function getPreviousMonth(range: MonthRange): MonthRange {
  const prevMonth = range.month === 1 ? 12 : range.month - 1
  const prevYear = range.month === 1 ? range.year - 1 : range.year
  return getMonthRange(`${prevYear}-${String(prevMonth).padStart(2, '0')}`)
}

async function fetchQuotes(range: MonthRange) {
  const { data, error } = await supabaseServer
    .from('quotes')
    .select(
      `
        id,
        ready_at,
        created_at,
        final_total_after_discount,
        production_machine_id,
        production_machines (
          machine_name
        )
      `
    )
    .not('ready_at', 'is', null)
    .gte('ready_at', range.start.toISOString())
    .lte('ready_at', range.end.toISOString())

  if (error) {
    console.error('Error fetching reports metrics quotes:', error)
    throw new Error('Failed to fetch quotes for reports metrics')
  }

  return (data || []) as QuoteRecord[]
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0
  if (percentile <= 0) return Math.min(...values)
  if (percentile >= 1) return Math.max(...values)
  const sorted = [...values].sort((a, b) => a - b)
  const index = (sorted.length - 1) * percentile
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) {
    return sorted[lower]
  }
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const monthParam = searchParams.get('month')

    const currentRange = getMonthRange(monthParam)
    const previousRange = getPreviousMonth(currentRange)

    const [currentQuotes, previousQuotes] = await Promise.all([
      fetchQuotes(currentRange),
      fetchQuotes(previousRange)
    ])

    const quoteIds = currentQuotes.map(quote => quote.id)

    let materialPricingRows: MaterialPricingRow[] = []
    let feePerMeter = 0
    let cuttingVatRate = 0

    if (quoteIds.length > 0) {
      const [{ data: pricingData, error: pricingError }, { data: cuttingFeeData, error: cuttingFeeError }] =
        await Promise.all([
          supabaseServer
            .from('quote_materials_pricing')
            .select(
              `
              quote_id,
              charged_sqm,
              cutting_length_m,
              material_gross,
              cutting_gross,
              edge_materials_net,
              material_net,
              materials (
                multiplier,
                vat:vat_id (
                  kulcs
                )
              )
            `
            )
            .in('quote_id', quoteIds),
          supabaseServer
            .from('cutting_fees')
            .select(
              `
              fee_per_meter,
              vat:vat_id (
                kulcs
              )
            `
            )
            .order('created_at', { ascending: false })
            .limit(1)
        ])

      if (pricingError) {
        console.error('Error fetching quote material pricing for reports metrics:', pricingError)
        throw new Error('Failed to fetch quote material pricing for reports metrics')
      }

      if (cuttingFeeError) {
        console.error('Error fetching cutting fees for reports metrics:', cuttingFeeError)
        throw new Error('Failed to fetch cutting fees for reports metrics')
      }

      materialPricingRows = (pricingData || []) as MaterialPricingRow[]

      const feeRow = (cuttingFeeData?.[0] || null) as CuttingFeeRow | null
      if (feeRow) {
        feePerMeter = Number(feeRow.fee_per_meter ?? 0)
        cuttingVatRate = Number(feeRow.vat?.kulcs ?? 0) / 100
      }
    }

    const materialNetByQuote = new Map<string, number>()
    const materialProfitByQuote = new Map<string, number>()
    const materialGrossByQuote = new Map<string, number>()
    const cuttingLengthByQuote = new Map<string, number>()
    const cuttingGrossByQuote = new Map<string, number>()
    const edgeNetByQuote = new Map<string, number>()

    materialPricingRows.forEach(row => {
      const quoteId = row.quote_id
      if (!quoteId) return

      const cuttingLength = Number(row.cutting_length_m ?? 0)
      if (!Number.isNaN(cuttingLength) && cuttingLength > 0) {
        cuttingLengthByQuote.set(
          quoteId,
          (cuttingLengthByQuote.get(quoteId) ?? 0) + cuttingLength
        )
      }

      const materialNetValue = Number(row.material_net ?? 0)
      if (!Number.isNaN(materialNetValue) && materialNetValue !== 0) {
        materialNetByQuote.set(
          quoteId,
          (materialNetByQuote.get(quoteId) ?? 0) + materialNetValue
        )
      }

      const materialGrossValue = Number(row.material_gross ?? 0)
      if (!Number.isNaN(materialGrossValue) && materialGrossValue !== 0) {
        materialGrossByQuote.set(
          quoteId,
          (materialGrossByQuote.get(quoteId) ?? 0) + materialGrossValue
        )
      }

      const cuttingGrossValue = Number(row.cutting_gross ?? 0)
      if (!Number.isNaN(cuttingGrossValue) && cuttingGrossValue !== 0) {
        cuttingGrossByQuote.set(
          quoteId,
          (cuttingGrossByQuote.get(quoteId) ?? 0) + cuttingGrossValue
        )
      }

      const edgeNetValue = Number(row.edge_materials_net ?? 0)
      if (!Number.isNaN(edgeNetValue) && edgeNetValue !== 0) {
        edgeNetByQuote.set(
          quoteId,
          (edgeNetByQuote.get(quoteId) ?? 0) + edgeNetValue
        )
      }

      const multiplier = Number(row.materials?.multiplier ?? 1)
      if (materialNetValue > 0 && multiplier > 0) {
        const baseCost = materialNetValue / multiplier
        const netProfit = materialNetValue - baseCost
        if (Number.isFinite(netProfit)) {
          materialProfitByQuote.set(
            quoteId,
            (materialProfitByQuote.get(quoteId) ?? 0) + netProfit
          )
        }
      }
    })

    // Machine revenue
    const machineRevenueMap = new Map<
      string,
      {
        machineId: string | null
        machineName: string
        totalRevenue: number
        quoteCount: number
        materialNet: number
        materialGross: number
        materialNetProfit: number
        cuttingNet: number
        cuttingVat: number
        cuttingGross: number
        edgeNet: number
        totalCombinedNet: number
      }
    >()

    currentQuotes.forEach(quote => {
      const revenue = Number(quote.final_total_after_discount) || 0
      const machineId = quote.production_machine_id
      const machineName = quote.production_machines?.machine_name?.trim() || 'Nincs hozzárendelve'
      const key = machineId || machineName
      const materialProfit = materialProfitByQuote.get(quote.id) ?? 0
      const materialNetTotal = materialNetByQuote.get(quote.id) ?? 0
      const materialGrossTotal = materialGrossByQuote.get(quote.id) ?? 0
      const cuttingLength = cuttingLengthByQuote.get(quote.id) ?? 0
      const cuttingGrossTotal = cuttingGrossByQuote.get(quote.id) ?? 0
      const edgeNetTotal = edgeNetByQuote.get(quote.id) ?? 0
      const cuttingNet = cuttingLength * feePerMeter
      const cuttingVat = cuttingNet * cuttingVatRate

      const existing = machineRevenueMap.get(key)
      if (existing) {
        existing.totalRevenue += revenue
        existing.quoteCount += 1
        existing.materialNet += materialNetTotal
        existing.materialGross += materialGrossTotal
        existing.materialNetProfit += materialProfit
        existing.cuttingNet += cuttingNet
        existing.cuttingVat += cuttingVat
        existing.cuttingGross += cuttingGrossTotal
        existing.edgeNet += edgeNetTotal
        existing.totalCombinedNet += materialNetTotal + edgeNetTotal + cuttingNet
      } else {
        machineRevenueMap.set(key, {
          machineId,
          machineName,
          totalRevenue: revenue,
          quoteCount: 1,
          materialNet: materialNetTotal,
          materialGross: materialGrossTotal,
          materialNetProfit: materialProfit,
          cuttingNet,
          cuttingVat,
          cuttingGross: cuttingGrossTotal,
          edgeNet: edgeNetTotal,
          totalCombinedNet: materialNetTotal + edgeNetTotal + cuttingNet
        })
      }
    })

    const machineRevenueValues = Array.from(machineRevenueMap.values())
    const machineRevenue = machineRevenueValues
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .map(item => ({
        ...item,
        totalRevenue: item.totalRevenue,
        materialNet: item.materialNet,
        materialGross: item.materialGross,
        materialNetProfit: item.materialNetProfit,
        cuttingNet: item.cuttingNet,
        cuttingVat: item.cuttingVat,
        cuttingGross: item.cuttingGross,
        edgeNet: item.edgeNet,
        totalMaterialNet: item.totalCombinedNet
      }))

    const machineTotals = machineRevenueValues.reduce(
      (acc, item) => {
        acc.totalRevenue += item.totalRevenue
        acc.materialNet += item.materialNet
        acc.materialGross += item.materialGross
        acc.materialNetProfit += item.materialNetProfit
        acc.cuttingNet += item.cuttingNet
        acc.cuttingVat += item.cuttingVat
        acc.cuttingGross += item.cuttingGross
        acc.edgeNet += item.edgeNet
        acc.totalCombinedNet += item.totalCombinedNet
        acc.quoteCount += item.quoteCount
        return acc
      },
      {
        totalRevenue: 0,
        materialNet: 0,
        materialGross: 0,
        materialNetProfit: 0,
        cuttingNet: 0,
        cuttingVat: 0,
        cuttingGross: 0,
        edgeNet: 0,
        totalCombinedNet: 0,
        quoteCount: 0
      }
    )

    // Average quote value
    const currentTotals = currentQuotes
      .map(quote => Number(quote.final_total_after_discount) || 0)
      .filter(value => value > 0)

    const previousTotals = previousQuotes
      .map(quote => Number(quote.final_total_after_discount) || 0)
      .filter(value => value > 0)

    const currentAverage =
      currentTotals.length === 0
        ? 0
        : currentTotals.reduce((acc, value) => acc + value, 0) / currentTotals.length
    const currentMedian = calculateMedian(currentTotals)

    const previousAverage =
      previousTotals.length === 0
        ? null
        : previousTotals.reduce((acc, value) => acc + value, 0) / previousTotals.length

    const averageQuote = {
      currentAverage: Math.round(currentAverage),
      currentMedian: Math.round(currentMedian),
      previousAverage: previousAverage !== null ? Math.round(previousAverage) : null,
      delta:
        previousAverage !== null
          ? Math.round(currentAverage - previousAverage)
          : null,
      totalQuotes: currentTotals.length
    }

    // Lead time
    const leadTimes = currentQuotes
      .map(quote => {
        if (!quote.ready_at || !quote.created_at) {
          return null
        }
        const readyDate = new Date(quote.ready_at)
        const createdDate = new Date(quote.created_at)
        const diffMs = readyDate.getTime() - createdDate.getTime()
        if (Number.isNaN(diffMs) || diffMs < 0) {
          return null
        }
        return diffMs / (1000 * 60 * 60 * 24)
      })
      .filter((value): value is number => value !== null)

    const leadTime = {
      averageDays:
        leadTimes.length === 0
          ? null
          : Number((leadTimes.reduce((acc, value) => acc + value, 0) / leadTimes.length).toFixed(1)),
      medianDays:
        leadTimes.length === 0 ? null : Number(calculateMedian(leadTimes).toFixed(1)),
      p90Days:
        leadTimes.length === 0 ? null : Number(calculatePercentile(leadTimes, 0.9).toFixed(1)),
      sampleSize: leadTimes.length
    }

    return NextResponse.json({
      month: currentRange,
      machineRevenue,
      machineTotals: {
        totalRevenue: machineTotals.totalRevenue,
        materialNet: machineTotals.materialNet,
        materialGross: machineTotals.materialGross,
        materialNetProfit: machineTotals.materialNetProfit,
        cuttingNet: machineTotals.cuttingNet,
        cuttingVat: machineTotals.cuttingVat,
        cuttingGross: machineTotals.cuttingGross,
        edgeNet: machineTotals.edgeNet,
        quoteCount: machineTotals.quoteCount,
        totalMaterialNet: machineTotals.totalCombinedNet
      },
      averageQuote,
      leadTime
    })
  } catch (error) {
    console.error('Error in reports metrics API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reports metrics' },
      { status: 500 }
    )
  }
}


