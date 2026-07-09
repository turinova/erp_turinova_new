import { tokenizeHighlight } from "@/lib/cost-item-search"

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function HighlightText({ text, query }: { text: string; query: string }) {
  const tokens = tokenizeHighlight(query)
  if (!tokens.length) return <>{text}</>

  const pattern = new RegExp(`(${tokens.map(escapeRegex).join("|")})`, "gi")
  const parts = text.split(pattern)

  return (
    <>
      {parts.map((part, i) =>
        tokens.some((t) => part.toLowerCase().includes(t)) ? (
          <mark key={i} className="rounded bg-amber-200 px-0.5 text-inherit">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}
