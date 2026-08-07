import Link from "next/link"
import { buildBreadcrumbJsonLd } from "@/lib/seo"
import Script from "next/script"

export type BreadcrumbItem = { name: string; path: string }

export function Breadcrumbs({ items }: { items: readonly BreadcrumbItem[] }) {
  if (items.length <= 1) return null

  const jsonLd = buildBreadcrumbJsonLd([...items])

  return (
    <nav aria-label="Morzsa" className="mb-6">
      <Script
        id={`jsonld-breadcrumb-${items[items.length - 1]?.path.replace(/\//g, "-")}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-black/55">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={item.path} className="flex items-center gap-1.5">
              {index > 0 && (
                <span aria-hidden className="text-black/30">
                  /
                </span>
              )}
              {isLast ? (
                <span className="font-medium text-black/75" aria-current="page">
                  {item.name}
                </span>
              ) : (
                <Link
                  href={item.path}
                  className="hover:text-[var(--color-brand)] hover:underline underline-offset-4"
                >
                  {item.name}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
