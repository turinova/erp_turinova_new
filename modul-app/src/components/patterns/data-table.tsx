import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

export function DataTable({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-border bg-surface',
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-left text-body">
          {children}
        </table>
      </div>
    </div>
  )
}

export function DataTableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 border-b border-border bg-subtle">
      {children}
    </thead>
  )
}

export function DataTableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>
}

export function DataTableRow({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn('bg-surface', className)} {...props}>
      {children}
    </tr>
  )
}

export function DataTableHeaderCell({
  children,
  className,
  align = 'left'
}: {
  children: React.ReactNode
  className?: string
  align?: 'left' | 'right'
}) {
  return (
    <th
      className={cn(
        'h-8 px-3 text-[12px] font-medium text-ink-secondary',
        align === 'right' && 'text-right',
        className
      )}
      scope="col"
    >
      {children}
    </th>
  )
}

export function DataTableCell({
  children,
  className,
  align = 'left',
  colSpan
}: {
  children: React.ReactNode
  className?: string
  align?: 'left' | 'right'
  colSpan?: number
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        'h-10 px-3 text-ink align-middle',
        align === 'right' && 'text-right tabular-nums',
        className
      )}
    >
      {children}
    </td>
  )
}
