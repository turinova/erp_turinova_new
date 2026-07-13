/** 1-based oszlop → Excel betű (1 = A). */
export function colToLetter(col: number): string {
  let n = col
  let s = ""
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export function cellRef(col: number, row: number): string {
  return `${colToLetter(col)}${row}`
}
