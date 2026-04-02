/** GYIK – rövid szekció, navigációs horgonnyal (#gyik). Bővíthető további kérdésekkel. */
export default function GyikSection() {
  const items = [
    {
      q: 'Illeszkedik a Shoprenteres webshopomhoz?',
      a: 'Igen, a Turinova úgy készült, hogy a meglévő webshop és bolti folyamatokkal együtt működjön, integrációkkal és egyedi igényekkel is.',
    },
    {
      q: 'Mennyi idő egy bevezetés?',
      a: 'A pontos idő a forgalomtól és a moduloktól függ. A demón végigmegyünk a számodra releváns részeken, és kapsz reális becslést.',
    },
    {
      q: 'Van kötelező hosszú távú szerződés?',
      a: 'A bemutató és a demó kötelezettség nélkül van, utána szabadon dönthetsz.',
    },
  ]

  return (
    <section id="gyik" className="scroll-mt-20 bg-slate-50 py-14 sm:py-16 border-y border-slate-100">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight text-center">
          Gyakori kérdések
        </h2>
        <p className="mt-2 text-center text-slate-600 text-sm sm:text-base">
          Amit a legtöbben először kérdeznek
        </p>
        <dl className="mt-10 space-y-6">
          {items.map(({ q, a }) => (
            <div key={q} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <dt className="font-semibold text-slate-900">{q}</dt>
              <dd className="mt-2 text-sm text-slate-600 leading-relaxed">{a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
