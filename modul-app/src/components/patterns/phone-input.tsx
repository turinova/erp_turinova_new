'use client'

import * as React from 'react'

import { Input } from '@/components/ui/input'
import {
  formatPhoneNumber,
  HU_PHONE_EXAMPLE
} from '@/lib/customers/parse'
import { cn } from '@/lib/utils'

type PhoneInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'inputMode' | 'onChange' | 'value'
> & {
  value: string
  /** Formázott érték (`+36 …`). */
  onValueChange: (formatted: string) => void
}

/**
 * HU telefonszám mező: élő `+36` maszkolás (`formatPhoneNumber`).
 */
export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      value,
      onValueChange,
      placeholder = HU_PHONE_EXAMPLE,
      autoComplete = 'tel',
      className,
      ...props
    },
    ref
  ) => {
    return (
      <Input
        ref={ref}
        type="tel"
        inputMode="tel"
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        className={cn(className)}
        onChange={(e) => onValueChange(formatPhoneNumber(e.target.value))}
        {...props}
      />
    )
  }
)
PhoneInput.displayName = 'PhoneInput'
