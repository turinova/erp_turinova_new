'use client'

import { useEffect, useRef } from 'react'

type Rectangle = {
  x: number
  y: number
  width: number
  height: number
}

type AnimState = {
  brightness: number
  direction: 1 | -1
  targetBrightness: number
}

/**
 * Monochrome BSP mosaic — legacy main-app Squares mintája (saját újraírás).
 * Idle: random csempék + szomszédok fade; hover opcionális.
 * prefers-reduced-motion: idle OFF (unless respectReducedMotion=false).
 */
export function SquaresMosaic({
  squareSize = 40,
  borderColor = '#a1a1aa',
  enableHover = true,
  /** Base wait between starting idle waves (ms). */
  idleIntervalMs = 800,
  /** Extra idle darkness (0–80). Login default 0. */
  idleBrightnessBoost = 0,
  /** Cap on idle darkness (higher = darker). Login default 220. */
  idleMaxBrightness = 220,
  /** Fade speed per frame (lower = slower). Login default 1.5. */
  idleStep = 1.5,
  /**
   * Max tiles animating at once.
   * `0` = login parity: next wave only when current wave finished.
   */
  maxAnimatingTiles = 0,
  /** When false, idle keeps running even if OS asks for reduced motion. */
  respectReducedMotion = true
}: {
  squareSize?: number
  borderColor?: string
  enableHover?: boolean
  idleIntervalMs?: number
  idleBrightnessBoost?: number
  idleMaxBrightness?: number
  idleStep?: number
  maxAnimatingTiles?: number
  respectReducedMotion?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rectanglesRef: { current: Rectangle[] } = { current: [] }
    const mouseRef: { current: { x: number; y: number } | null } = {
      current: null
    }
    const tileColors = new Map<number, string>()
    const animating = new Map<number, AnimState>()
    let raf = 0
    let lastAnimAt = 0
    let reducedMotion = false
    let paused = false
    let lastW = 0
    let lastH = 0

    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncMotion = () => {
      const wasReduced = reducedMotion
      reducedMotion = respectReducedMotion && media.matches
      if (reducedMotion) {
        animating.clear()
        drawGrid()
        cancelAnimationFrame(raf)
        raf = 0
      } else if (wasReduced && !raf && !paused) {
        raf = requestAnimationFrame(tick)
      }
    }
    syncMotion()
    media.addEventListener('change', syncMotion)

    function splitSpace(
      x: number,
      y: number,
      width: number,
      height: number,
      depth: number
    ): Rectangle[] {
      const minSize = squareSize * 0.8
      if (depth <= 0 || (width < minSize * 2 && height < minSize * 2)) {
        return [{ x, y, width, height }]
      }

      const canH = height >= minSize * 2
      const canV = width >= minSize * 2
      if (!canH && !canV) return [{ x, y, width, height }]

      const splitH = canH && (!canV || Math.random() > 0.5)
      if (splitH) {
        const splitY = minSize + Math.random() * (height - minSize * 2)
        return [
          ...splitSpace(x, y, width, splitY, depth - 1),
          ...splitSpace(x, y + splitY, width, height - splitY, depth - 1)
        ]
      }
      const splitX = minSize + Math.random() * (width - minSize * 2)
      return [
        ...splitSpace(x, y, splitX, height, depth - 1),
        ...splitSpace(x + splitX, y, width - splitX, height, depth - 1)
      ]
    }

    function generate() {
      rectanglesRef.current = splitSpace(0, 0, canvas!.width, canvas!.height, 7)
      tileColors.clear()
      animating.clear()
    }

    function findNeighbors(index: number): number[] {
      const rect = rectanglesRef.current[index]
      const neighbors: number[] = []
      const tol = 2
      rectanglesRef.current.forEach((other, otherIndex) => {
        if (index === otherIndex) return
        const sharesV =
          Math.abs(rect.x + rect.width - other.x) < tol ||
          Math.abs(other.x + other.width - rect.x) < tol
        const sharesH =
          Math.abs(rect.y + rect.height - other.y) < tol ||
          Math.abs(other.y + other.height - rect.y) < tol
        const overlapX = !(
          rect.x + rect.width < other.x ||
          other.x + other.width < rect.x
        )
        const overlapY = !(
          rect.y + rect.height < other.y ||
          other.y + other.height < rect.y
        )
        if ((sharesV && overlapY) || (sharesH && overlapX)) {
          neighbors.push(otherIndex)
        }
      })
      return neighbors
    }

    function drawGrid() {
      if (!ctx || !canvas) return
      if (canvas.width < 2 || canvas.height < 2) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      let hovered = -1
      if (enableHover && mouseRef.current) {
        const { x, y } = mouseRef.current
        for (let i = 0; i < rectanglesRef.current.length; i++) {
          const r = rectanglesRef.current[i]
          if (
            x >= r.x &&
            x <= r.x + r.width &&
            y >= r.y &&
            y <= r.y + r.height
          ) {
            hovered = i
            break
          }
        }
      }

      rectanglesRef.current.forEach((rect, index) => {
        let fill = 'rgb(255, 255, 255)'
        if (hovered === index) {
          if (!tileColors.has(index)) {
            const gray = Math.floor(30 + Math.random() * 90)
            tileColors.set(index, `rgb(${gray}, ${gray}, ${gray})`)
          }
          fill = tileColors.get(index)!
        } else if (animating.has(index)) {
          const anim = animating.get(index)!
          const gray = Math.floor(255 - anim.brightness)
          fill = `rgb(${gray}, ${gray}, ${gray})`
        }
        ctx.fillStyle = fill
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
        ctx.strokeStyle = borderColor
        ctx.lineWidth = 1
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
      })
    }

    function tick() {
      if (reducedMotion || paused) {
        raf = 0
        return
      }
      const now = Date.now()
      const gap = idleIntervalMs + Math.random() * idleIntervalMs * 0.5
      const canStart =
        maxAnimatingTiles <= 0
          ? animating.size === 0
          : animating.size < maxAnimatingTiles
      if (canStart && now - lastAnimAt > gap && rectanglesRef.current.length > 0) {
        lastAnimAt = now
        const start = Math.floor(Math.random() * rectanglesRef.current.length)
        const set = new Set<number>([start])
        const neighbors = findNeighbors(start)
        const n = Math.min(2 + Math.floor(Math.random() * 3), neighbors.length)
        const shuffled = [...neighbors].sort(() => Math.random() - 0.5)
        for (let i = 0; i < n; i++) set.add(shuffled[i])
        set.forEach((index) => {
          if (animating.has(index)) return
          if (maxAnimatingTiles > 0 && animating.size >= maxAnimatingTiles) return
          animating.set(index, {
            brightness: 0,
            direction: 1,
            targetBrightness: Math.min(
              idleMaxBrightness,
              80 + Math.random() * 100 + idleBrightnessBoost
            )
          })
        })
      }

      const done: number[] = []
      animating.forEach((anim, index) => {
        if (anim.direction === 1) {
          anim.brightness += idleStep
          if (anim.brightness >= anim.targetBrightness) anim.direction = -1
        } else {
          anim.brightness -= idleStep
          if (anim.brightness <= 0) done.push(index)
        }
      })
      done.forEach((i) => animating.delete(i))
      drawGrid()
      raf = requestAnimationFrame(tick)
    }

    function resize() {
      if (!canvas) return
      const parent = canvas.parentElement
      const w = Math.floor(
        parent?.clientWidth || canvas.offsetWidth || canvas.clientWidth
      )
      const h = Math.floor(
        parent?.clientHeight || canvas.offsetHeight || canvas.clientHeight
      )
      if (w < 2 || h < 2) return
      if (w === lastW && h === lastH) return
      lastW = w
      lastH = h
      canvas.width = w
      canvas.height = h
      generate()
      drawGrid()
      if (!reducedMotion && !paused && !raf) {
        raf = requestAnimationFrame(tick)
      }
    }

    function onMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect()
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }
      if (reducedMotion || !raf) drawGrid()
    }

    function onLeave() {
      mouseRef.current = null
      tileColors.clear()
      if (reducedMotion || !raf) drawGrid()
    }

    function onVisibility() {
      paused = document.hidden
      if (paused) {
        cancelAnimationFrame(raf)
        raf = 0
      } else if (!reducedMotion && !raf) {
        raf = requestAnimationFrame(tick)
      }
    }

    const ro = new ResizeObserver(() => resize())
    const observeTarget = canvas.parentElement ?? canvas
    ro.observe(observeTarget)

    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVisibility)
    if (enableHover) {
      canvas.addEventListener('mousemove', onMove)
      canvas.addEventListener('mouseleave', onLeave)
    }

    resize()
    const settleRaf = requestAnimationFrame(() => {
      resize()
      if (!reducedMotion && !paused && !raf) {
        raf = requestAnimationFrame(tick)
      }
    })

    return () => {
      cancelAnimationFrame(settleRaf)
      ro.disconnect()
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
      media.removeEventListener('change', syncMotion)
      if (enableHover) {
        canvas.removeEventListener('mousemove', onMove)
        canvas.removeEventListener('mouseleave', onLeave)
      }
      cancelAnimationFrame(raf)
    }
  }, [
    borderColor,
    squareSize,
    enableHover,
    idleIntervalMs,
    idleBrightnessBoost,
    idleMaxBrightness,
    idleStep,
    maxAnimatingTiles,
    respectReducedMotion
  ])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 block size-full border-0"
      aria-hidden
    />
  )
}
