export function ListPageSkeleton({
  title = 'Betöltés'
}: {
  title?: string
}) {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label={title}>
      <div className="h-8 w-40 rounded-md bg-subtle" />
      <div className="h-4 w-64 rounded-md bg-subtle" />
      <div className="flex gap-2">
        <div className="h-8 w-48 rounded-md bg-subtle" />
        <div className="h-8 w-28 rounded-md bg-subtle" />
      </div>
      <div className="space-y-2 rounded-md border border-border p-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-9 rounded-md bg-subtle/70" />
        ))}
      </div>
    </div>
  )
}
