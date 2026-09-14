import * as React from 'react'

import { cn } from '@/lib/utils'

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'flex min-h-[5.5rem] w-full rounded-md border border-border bg-surface px-2.5 py-2 text-body text-ink shadow-none transition-colors duration-fast',
        'placeholder:text-ink-disabled',
        'hover:border-border-strong',
        'disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-disabled',
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = 'Textarea'

export { Textarea }
