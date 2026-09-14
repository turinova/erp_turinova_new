import { cn } from '@/lib/utils'

type FormFieldProps = {
  label: string
  htmlFor: string
  required?: boolean
  optionalLabel?: boolean
  hint?: string
  error?: string
  children: React.ReactNode
  className?: string
}

export function FormField({
  label,
  htmlFor,
  required,
  optionalLabel,
  hint,
  error,
  children,
  className
}: FormFieldProps) {
  const descriptionId = error
    ? `${htmlFor}-error`
    : hint
      ? `${htmlFor}-hint`
      : undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-label text-ink">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
        {optionalLabel ? (
          <span className="font-normal text-ink-secondary"> (opcionális)</span>
        ) : null}
      </label>
      <div
        className={cn(
          error &&
            '[&_input]:border-danger [&_input]:focus-visible:ring-danger'
        )}
      >
        {children}
      </div>
      {error ? (
        <p id={descriptionId} className="text-hint text-danger-ink" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={descriptionId} className="text-hint text-ink-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
