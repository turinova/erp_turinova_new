export default function AIFeatures() {
  return (
    <section id="ai-seo" className="bg-white py-14 scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-gradient-to-br from-white via-emerald-50/35 to-orange-50/35 px-6 py-12 sm:px-10">
          {/* Decorative blobs */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-28 -right-28 h-72 w-72 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.18) 0%, transparent 70%)' }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-28 -left-28 h-72 w-72 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, rgba(251,146,60,0.15) 0%, transparent 70%)' }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.28]"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(148,163,184,0.35) 1px, transparent 0)',
              backgroundSize: '28px 28px',
            }}
          />

          <div className="relative">
            {/* Header */}
            <div className="text-center mb-12">
              {/* Eyebrow badge */}
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/60 bg-white/90 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-700 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Automatikus növekedés · Organikus forgalom · AI
              </span>

              {/* Headline */}
              <h2 className="mt-5 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-tight">
                Miközben te a vevőkkel foglalkozol,
                <br className="hidden sm:block" />
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: 'linear-gradient(90deg, #059669 0%, #ea580c 100%)' }}
                >
                  {' '}a Turinova gondoskodik a többiről.
                </span>
              </h2>

              {/* Subtext */}
              <p className="mt-4 text-slate-500 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
                A legtöbb webshop tulajdonos órákat tölt termékoldalak írásával és versenytársak figyelésével.
                A Turinova elvégzi ezt helyetted —{' '}
                <strong className="text-slate-700">automatikusan, naponta, hibátlanul.</strong>
              </p>

              {/* 3 stat pills */}
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {[
                  { icon: '⏱', text: 'Órákat spórolsz hetente' },
                  { icon: '📈', text: 'Több organikus látogató' },
                  { icon: '🏆', text: 'Versenytársak előtt maradsz' },
                ].map(s => (
                  <span key={s.text} className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 px-4 py-1.5 text-[12px] font-medium text-slate-700 shadow-sm">
                    <span>{s.icon}</span>
                    {s.text}
                  </span>
                ))}
              </div>
            </div>

            {/* Bento grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Big: Product SEO */}
              <div className="lg:col-span-7 overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 shadow-sm">
                <div className="p-6 sm:p-8">
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold bg-orange-600 text-white shadow-sm shadow-orange-200">
                      AI Tartalom &amp; SEO Motor
                    </span>
                    <span className="text-[12px] text-slate-400">
                      Több látogató a Google-ból · Kevesebb kézi munka · Automatikusan
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
                    Megírja helyetted — pontosan úgy, ahogy a Google, az AI motorok és a vásárló szereti.
                  </h3>
                  <p className="mt-3 text-slate-500 text-sm leading-relaxed">
                    Elég volt az üres termékleírásokból és az elveszett vevőkből. A Turinova mezőnként generálja
                    a tartalmat — a leírást, a kulcsszavakat, az URL-t, a meta adatokat, a kép feliratát —
                    mindegyiket egyetlen kattintással, pontosan oda, ahol szükség van rá. Minden kitöltött mező
                    egy lépéssel közelebb visz ahhoz, hogy a Google előrébb sorolja az oldalad — és{' '}
                    <strong className="text-slate-700">több organikus látogató érkezzen fizetett hirdetés nélkül.</strong>{' '}
                    Ami korábban órákat vett igénybe, most percek alatt kész van.
                  </p>

                  {/* Real screenshot */}
                  <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden shadow-sm">
                    <div className="flex items-center gap-1.5 px-4 py-3 bg-white/70 border-b border-slate-200">
                      <span className="w-3 h-3 rounded-full bg-red-300" />
                      <span className="w-3 h-3 rounded-full bg-yellow-300" />
                      <span className="w-3 h-3 rounded-full bg-green-300" />
                      <div className="ml-3 flex-1 h-5 rounded-md bg-slate-200/70 max-w-[280px]" />
                    </div>
                    <img
                      src="/banner/aigen.png"
                      alt="Turinova ERP AI tartalom és SEO generátor – automatikus termékleírás, meta adatok, kulcsszavak, slug generálás webshopokhoz"
                      className="w-full h-auto object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </div>
              </div>

              {/* Right: Google + AI search visibility */}
              <div className="lg:col-span-5 overflow-hidden rounded-3xl border border-emerald-100/80 bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/20 shadow-sm">
                <div className="p-6 sm:p-8">
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-sm shadow-emerald-200">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                      </svg>
                      Google &amp; AI Keresők
                    </span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
                    Ne hagyd, hogy a konkurensed legyen az első találat — te legyél az.
                  </h3>
                  <p className="mt-3 text-slate-500 text-sm leading-relaxed">
                    A vásárlók 90%-a az első oldalon dönt. Az AI keresők (ChatGPT, Perplexity) is csak azokat
                    az oldalakat ajánlják, amelyek adatai rendezettek. A Turinova gondoskodik arról, hogy{' '}
                    <strong className="text-slate-700">mindkét helyen ott legyél</strong> — automatikusan.
                  </p>

                  {/* Before / After SERP comparison */}
                  <div className="mt-6 rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    {/* Google search bar mock */}
                    <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      <div className="flex-1 h-4 rounded-full bg-slate-200/70" />
                    </div>

                    <div className="p-4 grid grid-cols-2 gap-3">
                      {/* Without Turinova */}
                      <div className="rounded-xl border border-red-100 bg-red-50/40 p-3">
                        <div className="flex items-center gap-1 mb-2">
                          <span className="w-3.5 h-3.5 rounded-full bg-red-200 flex items-center justify-center flex-shrink-0">
                            <svg className="w-2 h-2 text-red-500" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                          </span>
                          <span className="text-[9px] font-bold text-red-500 uppercase tracking-wide">Nélkülünk</span>
                        </div>
                        <p className="text-[9px] text-slate-400 leading-tight mb-1">webshop.hu › p › product-4521</p>
                        <p className="text-[10px] text-slate-500 leading-snug">Játékmackó</p>
                        <p className="text-[9px] text-slate-400 mt-1 leading-tight">Termékek. Vásárolj online…</p>
                        <div className="mt-2 flex items-center gap-1">
                          <span className="text-[9px] text-slate-400">Nincs értékelés · Nincs ár</span>
                        </div>
                        {/* Position badge */}
                        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5">
                          <span className="text-[9px] font-bold text-red-600">#8–12. hely</span>
                        </div>
                      </div>

                      {/* With Turinova */}
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
                        <div className="flex items-center gap-1 mb-2">
                          <span className="w-3.5 h-3.5 rounded-full bg-emerald-200 flex items-center justify-center flex-shrink-0">
                            <svg className="w-2 h-2 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                          </span>
                          <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wide">Turinova-val</span>
                        </div>
                        <p className="text-[9px] text-emerald-700 leading-tight mb-1">webshop.hu › puha-jatékmacko-gyerekeknek</p>
                        <p className="text-[10px] font-semibold text-blue-600 leading-snug">Puha Játékmackó — Gyors szállítás · Raktáron</p>
                        <p className="text-[9px] text-slate-500 mt-1 leading-tight">Prémium minőségű mackó, tökéletes ajándék…</p>
                        <div className="mt-1.5 flex items-center gap-0.5">
                          {[1,2,3,4,5].map(i => (
                            <svg key={i} className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                          ))}
                          <span className="text-[9px] text-slate-500 ml-0.5">4.9 · 14 900 Ft</span>
                        </div>
                        {/* Position badge */}
                        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5">
                          <svg className="w-2.5 h-2.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" /></svg>
                          <span className="text-[9px] font-bold text-emerald-700">#1–3. hely</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Proof chips */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      { dot: 'bg-emerald-400', label: 'Google Rich Result' },
                      { dot: 'bg-orange-400', label: 'AI Search Ready' },
                      { dot: 'bg-sky-400', label: 'Automatikus' },
                    ].map(c => (
                      <span key={c.label} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                        <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                        {c.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom: Competitor */}
              <div className="lg:col-span-12 overflow-hidden rounded-3xl border border-sky-100/80 bg-gradient-to-br from-white via-sky-50/40 to-cyan-50/30 shadow-sm">
                <div className="p-6 sm:p-8">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-8">

                    {/* Left: copy + workflow */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3 mb-4">
                        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-sky-600 text-white shadow-sm shadow-sky-200">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          </svg>
                          Versenytárs Ár &amp; Piac Radar
                        </span>
                        <span className="text-[12px] text-slate-400">Manuális vagy ütemezett · Azonnal alkalmazható</span>
                      </div>

                      <h3 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
                        Illeszd be a konkurens linkjét —<br className="hidden sm:block" /> mi megmondjuk az árat, amit érdemes kérned.
                      </h3>
                      <p className="mt-3 text-slate-500 text-sm leading-relaxed max-w-lg">
                        Nem kell órákat tölteni a versenytársak böngészésével. Adj meg egy termékük linkjét,
                        a Turinova automatikusan elemzi az árat és az adatokat, majd konkrét javaslatot ad:{' '}
                        <strong className="text-slate-700">mennyit kérj te</strong> — és azt azonnal alkalmazhatod is.
                        Futtathatod manuálisan, amikor szükséged van rá, vagy ütemezetten, hogy mindig naprakész legyél.
                      </p>

                      {/* Workflow pipeline */}
                      <div className="mt-8 relative">
                        {/* Connecting gradient line (desktop only) */}
                        <div
                          aria-hidden
                          className="hidden sm:block absolute top-[22px] left-[22px] right-[22px] h-[2px] rounded-full"
                          style={{ background: 'linear-gradient(to right, #0ea5e9, #8b5cf6, #f59e0b, #10b981)' }}
                        />
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 relative">
                          {[
                            {
                              num: '01', color: 'bg-sky-500', shadow: 'shadow-sky-200',
                              icon: (
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                                </svg>
                              ),
                              label: 'Versenyárs URL', sub: 'Te adod meg',
                            },
                            {
                              num: '02', color: 'bg-indigo-500', shadow: 'shadow-indigo-200',
                              icon: (
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                                </svg>
                              ),
                              label: 'AI elemzés', sub: 'Automatikus scrapelés',
                            },
                            {
                              num: '03', color: 'bg-amber-500', shadow: 'shadow-amber-200',
                              icon: (
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                                </svg>
                              ),
                              label: 'Árjavaslat', sub: 'Azonnal látod',
                            },
                            {
                              num: '04', color: 'bg-emerald-500', shadow: 'shadow-emerald-200',
                              icon: (
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                              ),
                              label: 'Alkalmazás', sub: '1 kattintással',
                            },
                          ].map(step => (
                            <div key={step.num} className="flex flex-col items-center text-center gap-3">
                              {/* Circle */}
                              <div className={`relative flex items-center justify-center w-11 h-11 rounded-full ${step.color} shadow-md ${step.shadow} z-10`}>
                                {step.icon}
                                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-white border border-slate-200 text-[9px] font-black text-slate-600 leading-none">
                                  {step.num}
                                </span>
                              </div>
                              {/* Text */}
                              <div>
                                <p className="text-[12px] font-bold text-slate-800 leading-tight">{step.label}</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">{step.sub}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right: real screenshot */}
                    <div className="flex-1 min-w-0">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden shadow-sm">
                        <div className="flex items-center gap-1.5 px-4 py-3 bg-white/70 border-b border-slate-200">
                          <span className="w-3 h-3 rounded-full bg-red-300" />
                          <span className="w-3 h-3 rounded-full bg-yellow-300" />
                          <span className="w-3 h-3 rounded-full bg-green-300" />
                          <div className="ml-3 flex-1 h-5 rounded-md bg-slate-200/70 max-w-[240px]" />
                        </div>
                        <img
                          src="/banner/comeptitor2.png"
                          alt="Turinova ERP versenytárs termék árelemzés és árjavaslat funkció – webshop ár összehasonlítás automatikusan"
                          className="w-full h-auto object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="mt-10 text-center">
              <p className="text-sm text-slate-500">
                Ha fontosak a növekedési számok, ezt látni kell.
              </p>
              <a
                href="#demo"
                className="mt-4 inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-orange-600 rounded-xl hover:bg-orange-700 active:bg-orange-800 transition-colors duration-150 shadow-sm shadow-orange-200"
              >
                Kérek személyes bemutatót
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
