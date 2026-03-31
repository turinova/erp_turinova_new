'use client'

const highlights = [
  { icon: '⚡', text: 'Shoprenter & Számlázz.hu integráció' },
  { icon: '🤖', text: 'AI termékleírás generálás' },
  { icon: '📦', text: 'Rendelés + készlet egy helyen' },
]

export default function Hero() {
  return (
    <section
      id="home"
      className="relative w-full overflow-hidden bg-white pt-14 pb-16 sm:pt-16 sm:pb-20"
    >
      {/* Subtle grid background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, #e2e8f0 1px, transparent 0)',
          backgroundSize: '32px 32px',
          opacity: 0.5,
        }}
      />

      {/* Pastel blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full"
            style={{
          background:
            'radial-gradient(circle, rgba(251,146,60,0.13) 0%, transparent 70%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-24 h-[400px] w-[400px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(125,211,252,0.12) 0%, transparent 70%)',
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:gap-16">

          {/* Left — text content */}
          <div className="flex-1 flex flex-col items-start gap-6">

            {/* Badge pills */}
            <div className="flex flex-wrap gap-2">
              {highlights.map(h => (
                <span
                  key={h.text}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-100"
                >
                  <span>{h.icon}</span>
                  {h.text}
                </span>
              ))}
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-bold leading-[1.1] tracking-tight text-slate-900">
              Webshop ERP{' '}
              <span
                className="relative inline-block"
                style={{
                  background: 'linear-gradient(135deg, #ea580c 0%, #f59e0b 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                ami automatizálja
              </span>{' '}
              a munkádat
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-slate-500 leading-relaxed max-w-xl">
              Készletkezelés, automatikus számlázás, kiszállítás és AI termékleírások — egy helyen,
              webshop tulajdonosoknak tervezve.
            </p>

            {/* Feature bullets */}
            <ul className="flex flex-col gap-2.5">
              {[
                'Automatikus Számlázz.hu számlakiállítás',
                'Versenytárs árigyelés és riportok',
                'AI termékleírás & SEO URL generálás',
                'ExpressOne, GLS, Foxpost csomagfeladás',
              ].map(item => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-slate-600">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            {/* CTA row */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <a
                href="#demo"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-orange-600 rounded-xl hover:bg-orange-700 active:bg-orange-800 transition-colors duration-150 shadow-sm shadow-orange-200"
              >
                Demo foglalása
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </a>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-1.5 px-6 py-3 text-sm font-semibold text-slate-700 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors duration-150"
              >
                Megnézem a funkciókat
              </a>
            </div>

            {/* Trust line */}
            <p className="text-xs text-slate-400 mt-1">
              Nincs kötöttség · Bevezethető 1 héten belül · Magyar támogatás
            </p>
          </div>

          {/* Right — screenshot placeholder */}
          <div className="flex-1 mt-12 lg:mt-0 flex justify-center lg:justify-end">
            <div className="w-full max-w-[580px]">
              {/* Browser chrome */}
              <div className="rounded-2xl overflow-hidden shadow-2xl shadow-slate-200/80 border border-slate-200">
                {/* Browser bar */}
                <div className="flex items-center gap-1.5 px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <span className="w-3 h-3 rounded-full bg-red-300" />
                  <span className="w-3 h-3 rounded-full bg-yellow-300" />
                  <span className="w-3 h-3 rounded-full bg-green-300" />
                  <div className="ml-3 flex-1 h-5 rounded-md bg-slate-200/70 max-w-[240px]" />
                </div>

                {/* Screenshot area — placeholder */}
                <div
                  className="relative bg-slate-50 flex flex-col items-center justify-center gap-4 text-center"
                  style={{ minHeight: 380 }}
                >
                  {/* Placeholder grid lines */}
                  <div className="absolute inset-0 opacity-30"
                    style={{
                      backgroundImage: 'linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)',
                      backgroundSize: '40px 40px',
                    }}
                  />

                  {/* Placeholder content */}
                  <div className="relative z-10 flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center">
                      <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-slate-500">Képernyőkép hamarosan</p>
                    <p className="text-xs text-slate-400">Dashboard · Rendelések · Készlet</p>
                  </div>

                  {/* Floating stat cards */}
                  <div className="absolute top-6 right-4 bg-white rounded-xl border border-slate-200 shadow-sm px-3 py-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-xs">✅</span>
                    <div>
                      <p className="text-xs font-semibold text-slate-800 leading-none">Számla kiállítva</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">automatikusan</p>
                    </div>
                  </div>

                  <div className="absolute bottom-6 left-4 bg-white rounded-xl border border-slate-200 shadow-sm px-3 py-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-sky-100 flex items-center justify-center text-xs">📦</span>
                    <div>
                      <p className="text-xs font-semibold text-slate-800 leading-none">12 rendelés</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">feldolgozásra vár</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}
