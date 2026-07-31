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
import type { Bar } from "@/lib/backtest/types"

interface Level {
  price: number
  title: string
  color: string
  style?: LineStyle
  width?: number
}

interface Props {
  bars: Bar[]
  vwapSeries: { t: number; v: number }[]
  levels: Level[]
  height?: number
}

/**
 * Crypto 1 perces gyertyachart UTC idővel, VWAP vonallal és
 * szint-jelölőkkel (prev day H/L, US-open range, entry/stop/target).
 */
export function CryptoChart({ bars, vwapSeries, levels, height = 520 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const vwapRef = useRef<ISeriesApi<"Line"> | null>(null)
  const priceLinesRef = useRef<ReturnType<ISeriesApi<"Candlestick">["createPriceLine"]>[]>([])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(15, 23, 42, 0.55)",
        fontFamily: "var(--font-geist-mono)",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(15, 23, 42, 0.06)" },
        horzLines: { color: "rgba(15, 23, 42, 0.06)" },
      },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: "rgba(15,23,42,0.12)" },
      rightPriceScale: { borderColor: "rgba(15,23,42,0.12)" },
      crosshair: { mode: 0 },
    })

    const candle = chart.addSeries(CandlestickSeries, {
      upColor: "#15803d",
      downColor: "#b91c1c",
      borderUpColor: "#15803d",
      borderDownColor: "#b91c1c",
      wickUpColor: "#15803d",
      wickDownColor: "#b91c1c",
    })
    const vwapLine = chart.addSeries(LineSeries, {
      color: "#0284c7",
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
  }, [height])

  useEffect(() => {
    const candle = candleRef.current
    const vwapLine = vwapRef.current
    if (!candle || !vwapLine) return

    if (bars.length > 0) {
      candle.setData(
        bars.map((b) => ({
          time: b.t as UTCTimestamp,
          open: b.o,
          high: b.h,
          low: b.l,
          close: b.c,
        }))
      )
      vwapLine.setData(
        vwapSeries.map((p) => ({
          time: p.t as UTCTimestamp,
          value: p.v,
        }))
      )
      chartRef.current?.timeScale().fitContent()
    }

    for (const line of priceLinesRef.current) candle.removePriceLine(line)
    priceLinesRef.current = []
    for (const lvl of levels) {
      priceLinesRef.current.push(
        candle.createPriceLine({
          price: lvl.price,
          color: lvl.color,
          lineWidth: (lvl.width ?? 1) as 1 | 2 | 3 | 4,
          lineStyle: lvl.style ?? LineStyle.Dashed,
          title: lvl.title,
        })
      )
    }
  }, [bars, vwapSeries, levels])

  return <div ref={containerRef} className="w-full" />
}
