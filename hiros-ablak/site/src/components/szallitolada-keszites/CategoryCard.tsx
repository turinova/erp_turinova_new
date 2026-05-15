import Image from "next/image"

type CategoryCardProps = {
  title: string
  desc: string
  bullets: string[]
  imageSrc?: string
  imageAlt?: string
  icon?: React.ReactNode
}

export default function CategoryCard({
  title,
  desc,
  bullets,
  imageSrc,
  imageAlt,
  icon,
}: CategoryCardProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-black/10 bg-white">
      {imageSrc ? (
        <div className="relative aspect-[4/3] w-full bg-stone-50">
          <Image
            src={imageSrc}
            alt={imageAlt ?? title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>
      ) : (
        <div className="flex items-center gap-4 border-b border-black/10 bg-stone-50/60 px-6 py-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
            {icon}
          </div>
          <div className="text-lg font-semibold tracking-tight text-slate-900">
            {title}
          </div>
        </div>
      )}
      <div className="flex flex-1 flex-col p-6 md:p-7">
        {imageSrc && (
          <div className="text-lg font-semibold tracking-tight text-slate-900">
            {title}
          </div>
        )}
        <p className={imageSrc ? "mt-2 text-sm text-black/70 leading-snug" : "text-sm text-black/70 leading-snug"}>
          {desc}
        </p>
        <ul className="mt-4 grid gap-1.5 text-sm text-black/75">
          {bullets.map((b) => (
            <li key={b} className="flex gap-2">
              <span aria-hidden className="text-[var(--color-brand)]">
                •
              </span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
