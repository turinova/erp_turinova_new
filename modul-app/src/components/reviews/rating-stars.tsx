import { Star } from 'lucide-react'

import { cn } from '@/lib/utils'

/** 0–5 csillag, részleges kitöltéssel (4,6 → 4 teli + 60%). */
export function RatingStars({
  rating,
  size = 18,
  className
}: {
  rating: number
  size?: number
  className?: string
}) {
  const clamped = Math.max(0, Math.min(5, rating))
  return (
    <span
      className={cn('inline-flex items-center gap-0.5', className)}
      role="img"
      aria-label={`${clamped.toLocaleString('hu-HU')} az 5-ből`}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, clamped - i))
        return (
          <span key={i} className="relative inline-block shrink-0" style={{ width: size, height: size }}>
            <Star
              className="absolute inset-0 fill-zinc-200 text-zinc-200"
              style={{ width: size, height: size }}
              strokeWidth={1.5}
              aria-hidden
            />
            {fill > 0 ? (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star
                  className="fill-amber-400 text-amber-500"
                  style={{ width: size, height: size }}
                  strokeWidth={1.5}
                  aria-hidden
                />
              </span>
            ) : null}
          </span>
        )
      })}
    </span>
  )
}
