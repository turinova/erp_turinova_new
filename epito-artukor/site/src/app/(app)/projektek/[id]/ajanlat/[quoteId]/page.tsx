import type { Metadata } from "next"
import dynamic from "next/dynamic"

const QuoteEditorClient = dynamic(
  () =>
    import("@/components/projektek/quote-editor-client").then((m) => m.QuoteEditorClient),
  {
    loading: () => (
      <div className="flex min-h-[calc(100dvh)] items-center justify-center">
        <div className="h-64 w-full max-w-4xl animate-pulse rounded-lg bg-[var(--muted)]" />
      </div>
    ),
  }
)

export const metadata: Metadata = {
  title: "Árajánlat",
}

type Props = {
  params: Promise<{ id: string; quoteId: string }>
}

export default async function QuoteEditorPage({ params }: Props) {
  const { id, quoteId } = await params
  return (
    <div className="-my-6 flex min-h-[calc(100dvh)] flex-col">
      <QuoteEditorClient projectId={id} quoteId={quoteId} />
    </div>
  )
}
