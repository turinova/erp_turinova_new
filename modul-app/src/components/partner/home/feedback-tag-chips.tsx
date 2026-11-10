'use client'

import { FEEDBACK_TAGS, type FeedbackTagId } from '@/lib/partner/feedback-copy'
import { cn } from '@/lib/utils'

export function FeedbackTagChips({
  value,
  onChange,
  disabled,
  labelledBy
}: {
  value: FeedbackTagId[]
  onChange: (next: FeedbackTagId[]) => void
  disabled?: boolean
  labelledBy?: string
}) {
  function toggle(id: FeedbackTagId) {
    onChange(value.includes(id) ? value.filter((t) => t !== id) : [...value, id])
  }

  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-1.5">
      {FEEDBACK_TAGS.map((tag) => {
        const active = value.includes(tag.id)
        return (
          <button
            key={tag.id}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => toggle(tag.id)}
            className={cn(
              'inline-flex h-8 items-center rounded-full border px-3 text-[13px] font-medium transition-colors disabled:opacity-60',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink',
              active
                ? 'border-ink bg-ink text-white'
                : 'border-border bg-surface text-ink-secondary hover:border-border-strong hover:text-ink'
            )}
          >
            {tag.label}
          </button>
        )
      })}
    </div>
  )
}
