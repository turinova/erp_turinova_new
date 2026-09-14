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
 * Idle: szomszédos csempék enyhe szürke fade; hover: sötétebb gray.
 */
export function SquaresMosaic({
  squareSize = 40,
  borderColor = '#a1a1aa'
}: {
  squareSize?: number
  borderColor?: string
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

    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncMotion = () => {
      const wasReduced = reducedMotion
      reducedMotion = media.matches
      if (reducedMotion) {
        animating.clear()
        drawGrid()
        cancelAnimationFrame(raf)
        raf = 0
      } else if (wasReduced && !raf) {
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
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      let hovered = -1
      if (mouseRef.current) {
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
        if (reducedMotion) drawGrid()
        return
      }
      const now = Date.now()
      if (
        animating.size === 0 &&
        now - lastAnimAt > 800 + Math.random() * 400 &&
        rectanglesRef.current.length > 0
      ) {
        lastAnimAt = now
        const start = Math.floor(Math.random() * rectanglesRef.current.length)
        const set = new Set<number>([start])
        const neighbors = findNeighbors(start)
        const n = Math.min(2 + Math.floor(Math.random() * 3), neighbors.length)
        const shuffled = [...neighbors].sort(() => Math.random() - 0.5)
        for (let i = 0; i < n; i++) set.add(shuffled[i])
        set.forEach((index) => {
          animating.set(index, {
            brightness: 0,
            direction: 1,
            targetBrightness: 80 + Math.random() * 100
          })
        })
      }

      const done: number[] = []
      animating.forEach((anim, index) => {
        if (anim.direction === 1) {
          anim.brightness += 1.5
          if (anim.brightness >= anim.targetBrightness) anim.direction = -1
        } else {
          anim.brightness -= 1.5
          if (anim.brightness <= 0) done.push(index)
        }
      })
      done.forEach((i) => animating.delete(i))
      drawGrid()
      raf = requestAnimationFrame(tick)
    }

    function resize() {
      if (!canvas) return
      canvas.width = Math.max(1, canvas.offsetWidth)
      canvas.height = Math.max(1, canvas.offsetHeight)
      generate()
      drawGrid()
    }

    function onMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect()
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }
    }

    function onLeave() {
      mouseRef.current = null
      tileColors.clear()
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

    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVisibility)
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)
    resize()
    raf = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
      media.removeEventListener('change', syncMotion)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onLeave)
      cancelAnimationFrame(raf)
    }
  }, [borderColor, squareSize])

  return (
    <canvas
      ref={canvasRef}
      className="block size-full border-0"
      aria-hidden
    />
  )
}
