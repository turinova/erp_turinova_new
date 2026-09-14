export default function PlatformSegmentLoading() {
  return (
    <div className="space-y-4 px-4 pt-4 md:px-6" aria-busy="true">
      <div className="h-7 w-40 animate-pulse rounded bg-subtle" />
      <div className="h-4 w-64 max-w-full animate-pulse rounded bg-subtle" />
      <div className="mt-4 h-64 animate-pulse rounded-md border border-border bg-subtle" />
    </div>
  )
}
