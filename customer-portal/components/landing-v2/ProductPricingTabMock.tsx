export default function ProductPricingTabMock() {
  const tabs = [
    'Alapadatok',
    'Árazás',
    'Tartalom & SEO',
    'AI Forrás',
    'Elemzés',
    'Beszállítók',
  ] as const

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-100 overflow-hidden shadow-sm text-left">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-3 sm:px-4 py-2.5 bg-white border-b border-slate-200">
        <span className="w-2.5 h-2.5 rounded-full bg-red-300 shrink-0" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-300 shrink-0" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 shrink-0" />
        <div className="ml-2 min-w-0 flex-1 flex items-center h-7 rounded-md bg-slate-100 border border-slate-200/80 px-2">
          <span className="truncate text-[10px] sm:text-[11px] text-slate-500 font-mono tabular-nums">
            mintawebshop.hu/products/pelda-termek
          </span>
        </div>
      </div>

      <div className="max-h-[min(640px,82vh)] overflow-y-auto bg-[#fafafa]">
        {/* MUI-like tab strip */}
        <div className="sticky top-0 z-[1] flex gap-0 overflow-x-auto border-b border-slate-200/90 bg-white px-1 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
          {tabs.map(label => {
            const active = label === 'Árazás'
            return (
              <button
                key={label}
                type="button"
                tabIndex={-1}
                className={`shrink-0 px-2.5 py-2.5 text-[10px] sm:text-[11px] font-semibold border-b-2 transition-colors ${
                  active
                    ? 'border-violet-600 text-violet-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div className="p-3 sm:p-4 space-y-3">
          {/* Faux “Árazás” context: thin summary strip */}
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] sm:text-[11px] text-slate-600">
            <span className="font-semibold text-slate-800">Termék szerkesztése</span>
            <span className="text-slate-400"> · </span>
            Nettó / bruttó, szorzó és csoportos árak az Árazás lapon.
          </div>

          {/* Outer purple card — ProductEditForm */}
          <div
            className="rounded-lg bg-white p-3 sm:p-4 shadow-sm"
            style={{
              border: '2px solid #9C27B0',
              boxShadow: '0 4px 14px rgba(156, 39, 176, 0.12)',
            }}
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                style={{
                  backgroundColor: '#9C27B0',
                  boxShadow: '0 4px 12px rgba(156, 39, 176, 0.35)',
                }}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="m19 9 1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7 11 1.25-2.75L17 15l-2.75-1.25L13 11l-1.25 2.75L9 15l2.75 1.25L13 20zm-8-6 1.25-2.75L9 9 6.25 7.25 5 5 3.75 7.75 1 9l2.75 1.25L5 13z" />
                </svg>
              </div>
              <h4 className="text-sm sm:text-base font-bold" style={{ color: '#7B1FA2' }}>
                AI Árazási Ajánlások
              </h4>
            </div>

            {/* Inner “AI Ajánlás” panel — AIPricingRecommendationsCard */}
            <div className="rounded-lg border border-black/[0.08] bg-white p-2.5 sm:p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/[0.04]">
                    <svg className="w-4 h-4 text-slate-600" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path d="m19 9 1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7 11 1.25-2.75L17 15l-2.75-1.25L13 11l-1.25 2.75L9 15l2.75 1.25L13 20zm-8-6 1.25-2.75L9 9 6.25 7.25 5 5 3.75 7.75 1 9l2.75 1.25L5 13z" />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-slate-900 tracking-tight">AI Ajánlás</span>
                </div>
                <span className="inline-flex items-center gap-1 rounded-md bg-black/[0.04] px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="m16 18 2.29-2.29L13 10.59 8 16.59 3.71 12.29 2.12 13.88l6 6 6-6z" />
                  </svg>
                  Ár csökkentés
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                <div className="rounded-lg border border-black/[0.08] bg-black/[0.02] p-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-black/[0.04] text-slate-600">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" />
                      </svg>
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">Jelenlegi ár</span>
                  </div>
                  <p className="text-xl font-bold text-slate-900 tracking-tight">12 990 Ft</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Nettó ár</p>
                </div>

                <div className="rounded-lg border border-black/[0.08] bg-black/[0.02] p-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-black/[0.04] text-slate-600">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                      </svg>
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">Versenyár</span>
                  </div>
                  <p className="text-[10px] font-medium text-slate-600 mb-0.5 truncate">Példa Webáruház Kft.</p>
                  <p className="text-xl font-bold text-slate-900 tracking-tight">11 890 Ft</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="rounded px-1.5 py-0 text-[10px] font-semibold bg-red-500/10 text-red-700">
                      +9,2%
                    </span>
                    <span className="text-[10px] text-slate-500">Nettó ár</span>
                  </div>
                </div>

                <div
                  className="rounded-lg p-2.5 border-2"
                  style={{
                    backgroundColor: 'rgba(33, 150, 243, 0.04)',
                    borderColor: 'rgba(33, 150, 243, 0.22)',
                    boxShadow: '0 2px 8px rgba(33, 150, 243, 0.08)',
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-md"
                      style={{ backgroundColor: 'rgba(33, 150, 243, 0.12)' }}
                    >
                      <svg className="w-3.5 h-3.5" style={{ color: '#2196F3' }} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6C7.8 12.16 7 10.63 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z" />
                      </svg>
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#1976D2' }}>
                      Ajánlott ár
                    </span>
                  </div>
                  <p className="text-2xl font-bold tracking-tight" style={{ color: '#1976D2' }}>
                    11 650 Ft
                  </p>
                  <div className="flex items-center gap-0.5 mt-1">
                    <svg className="w-4 h-4" style={{ color: '#2196F3' }} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path d="M7 10l5 5 5-5H7z" />
                    </svg>
                    <span className="text-xs font-semibold" style={{ color: '#1976D2' }}>
                      −10,3%
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">Nettó ár</p>
                </div>
              </div>

              <div className="rounded-lg border border-black/[0.08] bg-black/[0.02] px-2.5 py-2 mb-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs">
                  <span className="text-slate-600 font-medium">Árrés az ajánlott áron:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">3 420 Ft</span>
                    <span className="rounded px-1.5 py-0 text-[10px] font-semibold bg-emerald-500/10 text-emerald-800">
                      29,3%
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pt-3 border-t border-black/[0.08]">
                <p className="text-[11px] sm:text-xs leading-relaxed text-slate-600 flex-1">
                  9,2%-kal drágábbak vagyunk a legolcsóbb versenytárshoz képest — kis csökkentéssel újra
                  versenyképes lehet az ár. Az ajánlás a scrape-elt nettó árak alapján készült (példa adat).
                </p>
                <button
                  type="button"
                  tabIndex={-1}
                  className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold text-white bg-[#4CAF50] hover:bg-[#388E3C] shadow-sm"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                  Alkalmaz
                </button>
              </div>
            </div>

            {/* Versenytárs árak — expanded (accordion open), mirrors AIPricingRecommendationsCard */}
            <div className="mt-3 rounded-lg border border-black/[0.12] bg-black/[0.02] overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-2 py-2 sm:px-2.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <svg className="w-5 h-5 shrink-0 text-slate-700" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                  <span className="text-xs sm:text-sm font-semibold text-slate-900 truncate">Versenytárs árak</span>
                  <span className="shrink-0 rounded px-1.5 py-0 text-[11px] font-semibold bg-black/[0.08] text-slate-800">
                    2
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <svg className="w-[18px] h-[18px] text-red-600" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M16 6l2.29 2.29L13 10.59 8 15.59l-4.29-4.3L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6h-6z" />
                  </svg>
                  <span className="text-[11px] font-semibold text-red-600">+9,2%</span>
                  <span
                    className="ml-0.5 flex h-7 w-7 items-center justify-center rounded-full text-slate-600"
                    aria-hidden
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="m7 14 5-5 5 5H7z" />
                    </svg>
                  </span>
                </div>
              </div>

              <div className="border-t border-black/[0.08] px-2 py-2 sm:px-2.5 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center rounded border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700">
                    Frissítés
                  </span>
                  <span className="inline-flex items-center rounded border border-violet-300 bg-white px-2 py-1 text-[10px] font-semibold text-violet-800">
                    Mind ellenőrzése
                  </span>
                  <span className="inline-flex items-center rounded bg-slate-800 px-2 py-1 text-[10px] font-semibold text-white shadow-sm">
                    + Versenytárs hozzáadása
                  </span>
                </div>

                <div className="overflow-x-auto rounded-md border border-black/[0.08] bg-white">
                  <table className="w-full min-w-[280px] text-left text-[10px] sm:text-[11px]">
                    <thead>
                      <tr className="bg-black/[0.04]">
                        <th className="border-b-2 border-black/[0.12] py-1.5 pl-2 pr-1 font-semibold text-slate-900">
                          Versenytárs
                        </th>
                        <th className="border-b-2 border-black/[0.12] py-1.5 px-1 font-semibold text-slate-900 text-right whitespace-nowrap">
                          Nettó ár
                        </th>
                        <th className="border-b-2 border-black/[0.12] py-1.5 px-1 font-semibold text-slate-900 text-center whitespace-nowrap">
                          Különbség
                        </th>
                        <th className="border-b-2 border-black/[0.12] py-1.5 pr-2 pl-1 font-semibold text-slate-900 text-right whitespace-nowrap">
                          Művelet
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        {
                          initial: 'P',
                          name: 'Példa Webáruház Kft.',
                          price: '11 890 Ft',
                          diff: '+9,2%',
                          diffUp: true,
                        },
                        {
                          initial: 'M',
                          name: 'Másik Bolt Zrt.',
                          price: '12 450 Ft',
                          diff: '+14,5%',
                          diffUp: true,
                        },
                      ].map(row => (
                        <tr key={row.name} className="hover:bg-black/[0.03]">
                          <td className="border-b border-black/[0.08] py-1.5 pl-2 pr-1 align-middle">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[rgba(33,150,243,0.85)] text-[10px] font-bold text-white">
                                {row.initial}
                              </span>
                              <span className="font-medium text-slate-900 truncate">{row.name}</span>
                            </div>
                          </td>
                          <td className="border-b border-black/[0.08] py-1.5 px-1 align-middle text-right font-semibold text-slate-900 whitespace-nowrap">
                            {row.price}
                          </td>
                          <td className="border-b border-black/[0.08] py-1.5 px-1 align-middle text-center">
                            <span
                              className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                row.diffUp
                                  ? 'bg-red-500/12 text-red-700'
                                  : 'bg-emerald-500/12 text-emerald-800'
                              }`}
                            >
                              {row.diff}
                            </span>
                          </td>
                          <td className="border-b border-black/[0.08] py-1.5 pr-2 pl-1 align-middle text-right">
                            <div className="inline-flex gap-0.5 justify-end">
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-600 hover:bg-black/[0.06]">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                                  <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                                </svg>
                              </span>
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-600 hover:bg-black/[0.06]">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                </svg>
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-slate-500 px-0.5">
                  Utolsó ellenőrzés: ma 09:42 · példa adatok
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
