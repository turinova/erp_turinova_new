export default function PlatformLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Betöltés">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded bg-subtle" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded bg-subtle" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-[72px] animate-pulse rounded-md border border-border bg-subtle"
          />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-md border border-border bg-subtle" />
    </div>
  )
}
