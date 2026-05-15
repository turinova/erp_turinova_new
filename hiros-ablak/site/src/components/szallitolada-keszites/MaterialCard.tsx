type MaterialCardProps = {
  name: string
  desc: string
  useCases: string[]
  icon?: React.ReactNode
}

export default function MaterialCard({
  name,
  desc,
  useCases,
  icon,
}: MaterialCardProps) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5 md:p-6 hover:border-[var(--color-brand)]/40 transition">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand)]/8 text-[var(--color-brand)]">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-base font-semibold tracking-tight text-slate-900">
            {name}
          </div>
          <p className="mt-1 text-sm text-black/65 leading-snug">{desc}</p>
        </div>
      </div>
      <ul className="mt-3 grid gap-1.5 text-sm text-black/75">
        {useCases.map((u) => (
          <li key={u} className="flex gap-2">
            <span aria-hidden className="text-[var(--color-brand)]">
              •
            </span>
            <span>{u}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
