import Link from "next/link"
import { COMPANY } from "@/lib/company"

export default function NotFound() {
  return (
    <div className="bg-stone-wash">
      <div className="mx-auto max-w-xl px-4 py-16 md:py-24">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand)]">
          404
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-black/90 md:text-4xl">
          Ez az oldal nem található
        </h1>
        <p className="mt-4 text-base leading-relaxed text-black/65">
          A keresett cím nem létezik, vagy áthelyeztük. A {COMPANY.brand}{" "}
          honlapján ezek segíthetnek továbbjutni.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/"
            className="btn-primary inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold"
          >
            Főoldal
          </Link>
          <Link
            href="/referenciak"
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-black/12 bg-white px-5 py-2.5 text-sm font-semibold text-black/80"
          >
            Referenciák
          </Link>
          <Link
            href="/kapcsolat"
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-black/12 bg-white px-5 py-2.5 text-sm font-semibold text-black/80"
          >
            Kapcsolat
          </Link>
        </div>
      </div>
    </div>
  )
}
