import Link from "next/link"
import { formatPressDateHu, pressDetailPath, type PressAppearance } from "@/lib/press-appearances"

type PressAppearancesListProps = {
  items: readonly PressAppearance[]
}

export function PressAppearancesList({ items }: PressAppearancesListProps) {
  return (
    <ul className="mt-6 grid gap-4 sm:gap-5 md:mt-8 md:grid-cols-2 md:gap-6">
      {items.map((item) => {
        const detailHref = pressDetailPath(item.slug)
        return (
          <li key={item.slug} className="min-w-0">
            <article className="flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-black/10 bg-white shadow-[var(--shadow-soft)]">
              <Link
                href={detailHref}
                className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
              >
                <div
                  className="relative aspect-[16/10] w-full overflow-hidden"
                  style={
                    item.imageSrc
                      ? undefined
                      : { background: item.placeholderGradient }
                  }
                  role={item.imageSrc ? undefined : "img"}
                  aria-label={
                    item.imageSrc
                      ? undefined
                      : `${item.title}, képhelyőrző`
                  }
                >
                  {item.imageSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageSrc}
                      alt={item.imageAlt ?? item.title}
                      className="absolute inset-0 h-full w-full object-cover object-center"
                      loading="lazy"
                    />
                  ) : null}
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-3.5 md:p-4">
                    <p className="text-[0.65rem] font-medium uppercase tracking-[0.1em] text-white/70 md:text-xs">
                      {item.publisher}
                      <span className="mx-1.5 text-white/35">·</span>
                      {formatPressDateHu(item.publishedAt)}
                    </p>
                    <h2 className="mt-1 line-clamp-2 text-balance font-display text-base font-semibold leading-snug tracking-tight text-white md:text-lg">
                      {item.title}
                    </h2>
                  </div>
                </div>
              </Link>

              <div className="flex flex-1 flex-col gap-3 p-3.5 md:p-4">
                <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-black/65">
                  {item.summary}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="truncate text-xs text-black/45">{item.place}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-black/50 underline-offset-2 hover:text-black/75 hover:underline"
                    >
                      Eredeti forrás
                    </a>
                    <Link
                      href={detailHref}
                      className="btn-primary inline-flex px-3.5 py-2 text-xs font-semibold"
                    >
                      Részletek
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          </li>
        )
      })}
    </ul>
  )
}
