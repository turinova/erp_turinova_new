import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * Custom fontSize tokenek (text-body, text-hint, …) ne ütközzenek
 * a szövegszín utilitykkel (text-white, text-ink, …) — különben
 * pl. a primary gomb sm méreténél eltűnik a fehér szöveg.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['body', 'h1', 'h2', 'h3', 'label', 'hint']
    }
  }
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
