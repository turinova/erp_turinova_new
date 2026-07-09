import type { TextPolishChange } from "@/lib/polish-item-text"

/**
 * A magyar Hunspell szótár suggest() hívása Node-ban memóriahibát okoz
 * (nspell + dictionary-hu). Ezért csak helyesírás-ellenőrzésre használjuk —
 * javítást a helyi építőipari szabályok + katalógus illesztés végzi.
 */
export function applyHunspellCorrections(text: string): {
  text: string
  changes: TextPolishChange[]
} {
  void text
  return { text, changes: [] }
}
