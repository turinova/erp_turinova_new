"use client"

import { useEffect, useRef } from "react"
import {
  CandlestickSeries,
  ColorType,
  createChart,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts"
import { etOffsetSeconds } from "@/lib/et-time"
import type { Bar } from "@/lib/backtest/types"

interface Props {
  bars: Bar[]
  vwapSeries: { t: number; v: number }[]
  orbHigh: number | null
  orbLow: number | null
}

/**
 * 1 perces gyertyachart ORB szintekkel és VWAP vonallal.
 * A timestampeket ET-re toljuk, hogy a tengely New York-i időt mutasson.
 */
export function LiveChart({ bars, vwapSeries, orbHigh, orbLow }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const vwapRef = useRef<ISeriesApi<"Line"> | null>(null)
  const priceLinesRef = useRef<ReturnType<ISeriesApi<"Candlestick">["createPriceLine"]>[]>([])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, {
      height: 380,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(226, 232, 240, 0.55)",
        fontFamily: "var(--font-geist-mono)",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.07)" },
        horzLines: { color: "rgba(148, 163, 184, 0.07)" },
      },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: "rgba(148,163,184,0.14)" },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.14)" },
      crosshair: { mode: 0 },
    })

    const candle = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    })
    const vwapLine = chart.addSeries(LineSeries, {
      color: "#38bdf8",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    })

    chartRef.current = chart
    candleRef.current = candle
    vwapRef.current = vwapLine

    const resize = () => chart.applyOptions({ width: el.clientWidth })
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(el)

    return () => {
      observer.disconnect()
      chart.remove()
      chartRef.current = null
      candleRef.current = null
      vwapRef.current = null
      priceLinesRef.current = []
    }
  }, [])

  useEffect(() => {
    const candle = candleRef.current
    const vwapLine = vwapRef.current
    if (!candle || !vwapLine) return

    if (bars.length > 0) {
      const offset = etOffsetSeconds(bars[bars.length - 1].t)
      candle.setData(
        bars.map((b) => ({
          time: (b.t + offset) as UTCTimestamp,
          open: b.o,
          high: b.h,
          low: b.l,
          close: b.c,
        }))
      )
      vwapLine.setData(
        vwapSeries.map((p) => ({
          time: (p.t + offset) as UTCTimestamp,
          value: p.v,
        }))
      )
      chartRef.current?.timeScale().fitContent()
    }

    // ORB szintek frissítése
    for (const line of priceLinesRef.current) candle.removePriceLine(line)
    priceLinesRef.current = []
    if (orbHigh != null) {
      priceLinesRef.current.push(
        candle.createPriceLine({
          price: orbHigh,
          color: "#f59e0b",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          title: "ORB H",
        })
      )
    }
    if (orbLow != null) {
      priceLinesRef.current.push(
        candle.createPriceLine({
          price: orbLow,
          color: "#f59e0b",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          title: "ORB L",
        })
      )
    }
  }, [bars, vwapSeries, orbHigh, orbLow])

  return <div ref={containerRef} className="w-full" />
}
