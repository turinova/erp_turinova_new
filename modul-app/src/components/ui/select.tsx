import * as React from 'react'

import { cn } from '@/lib/utils'

const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => {
  return (
    <select
      className={cn(
        'flex h-8 w-full rounded-md border border-border bg-surface px-2.5 text-body text-ink shadow-none transition-colors duration-fast',
        'hover:border-border-strong',
        'disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-disabled',
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
    </select>
  )
})
Select.displayName = 'Select'

export { Select }
