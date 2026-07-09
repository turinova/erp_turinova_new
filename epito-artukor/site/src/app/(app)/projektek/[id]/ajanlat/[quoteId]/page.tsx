import type { Metadata } from "next"
import { QuoteEditorClient } from "@/components/projektek/quote-editor-client"

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
