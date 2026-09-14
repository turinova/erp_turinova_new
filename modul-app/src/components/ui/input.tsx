import * as React from 'react'

import { cn } from '@/lib/utils'

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-8 w-full rounded-md border border-border bg-surface px-2.5 text-body text-ink shadow-none transition-colors duration-fast',
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
Input.displayName = 'Input'

export { Input }
