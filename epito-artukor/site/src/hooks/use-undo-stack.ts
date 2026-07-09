"use client"

import { useCallback, useRef, useState } from "react"
import type { CostItem } from "@/types"

const MAX_HISTORY = 30

export function useUndoStack(initial: CostItem[]) {
  const [items, setItemsState] = useState<CostItem[]>(initial)
  const [canUndo, setCanUndo] = useState(false)
  const pendingUndoRef = useRef<CostItem[][]>([])

  const setItems = useCallback((next: CostItem[] | ((prev: CostItem[]) => CostItem[])) => {
    setItemsState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next
      if (resolved !== prev) {
        pendingUndoRef.current = [
          ...pendingUndoRef.current.slice(-(MAX_HISTORY - 1)),
          prev,
        ]
        setCanUndo(true)
      }
      return resolved
    })
  }, [])

  const undo = useCallback(() => {
    const stack = pendingUndoRef.current
    if (stack.length === 0) return
    const previous = stack[stack.length - 1]
    pendingUndoRef.current = stack.slice(0, -1)
    setCanUndo(pendingUndoRef.current.length > 0)
    setItemsState(previous)
  }, [])

  const resetStack = useCallback((next: CostItem[]) => {
    pendingUndoRef.current = []
    setCanUndo(false)
    setItemsState(next)
  }, [])

  return { items, setItems, undo, canUndo, resetStack }
}
