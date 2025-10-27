/**
 * Unit conversion utilities for corpus viewer
 * Scene works in meters, UI in millimeters
 */

export const mm = (n: number): number => n / 1000

export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value))
}

export const validateDimension = (
  value: number,
  min: number = 250,
  max: number = 2000
): number => {
  const clamped = clamp(value, min, max)
  return Math.round(clamped) // Snap to integer mm
}

export const validateThickness = (value: number): number => {
  return clamp(Math.round(value), 12, 25)
}

