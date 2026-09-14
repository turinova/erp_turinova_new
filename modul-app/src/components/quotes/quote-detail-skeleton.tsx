export function QuoteDetailSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Betöltés">
      <div className="h-8 w-48 rounded-md bg-subtle" />
      <div className="h-4 w-72 rounded-md bg-subtle" />
      <div className="grid gap-3 md:grid-cols-3">
        <div className="h-28 rounded-md border border-border bg-subtle/60" />
        <div className="h-28 rounded-md border border-border bg-subtle/60" />
        <div className="h-28 rounded-md border border-border bg-subtle/60" />
      </div>
      <div className="h-64 rounded-md border border-border bg-subtle/40" />
    </div>
  )
}
