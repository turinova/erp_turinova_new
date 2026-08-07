import { PRESS_FAQ } from "@/lib/press-appearances"

export function PressFaqSection() {
  return (
    <section
      aria-labelledby="press-faq-heading"
      className="mt-12 border-t border-black/10 pt-10 md:mt-14 md:pt-12"
    >
      <h2
        id="press-faq-heading"
        className="font-display text-xl font-semibold tracking-tight text-black/90 md:text-2xl"
      >
        Gyakori kérdések
      </h2>
      <div className="mt-4 max-w-2xl divide-y divide-black/8 border-y border-black/8">
        {PRESS_FAQ.map((item) => (
          <details key={item.id} className="group py-3">
            <summary className="cursor-pointer list-none text-sm font-semibold text-black/88 marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-3">
                {item.q}
                <span
                  aria-hidden
                  className="shrink-0 text-black/40 transition group-open:rotate-45"
                >
                  +
                </span>
              </span>
            </summary>
            <div className="mt-2 grid gap-3 pr-2 text-sm leading-relaxed text-black/60">
              {item.a.split("\n\n").map((para) => (
                <p key={para.slice(0, 40)}>{para}</p>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
