import type { ReactNode } from 'react'

const tabs = [
  'Alapadatok',
  'Árazás',
  'Tartalom & SEO',
  'AI Forrás',
  'Elemzés',
  'Beszállítók',
] as const

function AiPill() {
  return (
    <span
      className="shrink-0 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-600"
      aria-hidden
    >
      AI
    </span>
  )
}

function SectionHeader({
  title,
  icon,
  style,
}: {
  title: string
  icon: ReactNode
  style: { iconBg: string; titleColor: string }
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
        style={{ backgroundColor: style.iconBg }}
      >
        {icon}
      </div>
      <span className="text-[11px] sm:text-xs font-bold tracking-tight" style={{ color: style.titleColor }}>
        {title}
      </span>
      <AiPill />
    </div>
  )
}

export default function ProductContentSeoTabMock() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-100 overflow-hidden shadow-sm text-left">
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

      <div className="max-h-[min(520px,78vh)] overflow-y-auto bg-[#fafafa]">
        <div className="sticky top-0 z-[1] flex gap-0 overflow-x-auto border-b border-slate-200/90 bg-white px-1 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
          {tabs.map(label => {
            const active = label === 'Tartalom & SEO'
            return (
              <button
                key={label}
                type="button"
                tabIndex={-1}
                className={`shrink-0 px-2.5 py-2.5 text-[10px] sm:text-[11px] font-semibold border-b-2 transition-colors ${
                  active
                    ? 'border-orange-600 text-orange-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div className="p-2.5 sm:p-3 space-y-2">
          <div className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] text-slate-600">
            <span className="font-semibold text-slate-800">Tartalom &amp; SEO</span>
            <span className="text-slate-400"> · </span>
            Leírás, címkék, URL, meta mezők és termékképek — illusztráció.
          </div>

          {/* Részletes leírás — purple (ProductEditForm) */}
          <div
            className="rounded-lg bg-white p-2 shadow-sm"
            style={{ border: '2px solid #9c27b0' }}
          >
            <SectionHeader
              title="Részletes leírás"
              style={{ iconBg: '#9c27b0', titleColor: '#7b1fa2' }}
              icon={
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                </svg>
              }
            />
            <div className="rounded border border-slate-100 bg-slate-50/80 p-2 space-y-1.5">
              <div className="h-1.5 rounded bg-slate-200 w-[92%]" />
              <div className="h-1.5 rounded bg-slate-200 w-full" />
              <div className="h-1.5 rounded bg-slate-200 w-[78%]" />
              <div className="h-1.5 rounded bg-slate-200 w-[88%]" />
              <p className="text-[9px] text-slate-400 pt-0.5">… HTML / WYSIWYG előnézet (példa)</p>
            </div>
          </div>

          {/* Termék címkék — pink */}
          <div className="rounded-lg bg-white p-2 shadow-sm" style={{ border: '2px solid #e91e63' }}>
            <SectionHeader
              title="Termék címkék"
              style={{ iconBg: '#e91e63', titleColor: '#c2185b' }}
              icon={
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" />
                </svg>
              }
            />
            <div className="flex flex-wrap gap-1">
              {['játék', 'ajándék', 'plüss', 'gyerek'].map(t => (
                <span
                  key={t}
                  className="rounded-full border border-pink-200 bg-pink-50 px-2 py-0.5 text-[9px] font-semibold text-pink-900"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* SEO URL — blue */}
          <div className="rounded-lg bg-white p-2 shadow-sm" style={{ border: '2px solid #2196f3' }}>
            <SectionHeader
              title="SEO URL (slug)"
              style={{ iconBg: '#2196f3', titleColor: '#1565c0' }}
              icon={
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
                </svg>
              }
            />
            <p className="text-[9px] text-slate-500 mb-0.5">Jelenlegi URL</p>
            <p className="text-[10px] font-mono text-slate-700 truncate">
              bolt.hu / puha-jatekmacska-gyerekeknek
            </p>
          </div>

          {/* Meta cím — amber */}
          <div className="rounded-lg bg-white p-2 shadow-sm" style={{ border: '2px solid #ffc107' }}>
            <SectionHeader
              title="Meta cím"
              style={{ iconBg: '#ffc107', titleColor: '#f57c00' }}
              icon={
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M5 4v3h5.5V4h-2V2h6v2h-2v3H18V4h-2V2h4v6h-2v2h2v12H5V12H3V6h2V4H5zm2 8v8h10v-8H7z" />
                </svg>
              }
            />
            <p className="text-[10px] font-semibold text-slate-900 leading-snug">
              Puha játékmackó gyerekeknek — raktáron, gyors szállítás | Bolt
            </p>
            <p className="text-[9px] text-slate-400 mt-0.5">52 karakter · példa</p>
          </div>

          {/* Meta kulcsszavak — green */}
          <div className="rounded-lg bg-white p-2 shadow-sm" style={{ border: '2px solid #4caf50' }}>
            <SectionHeader
              title="Meta kulcsszavak"
              style={{ iconBg: '#4caf50', titleColor: '#2e7d32' }}
              icon={
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                </svg>
              }
            />
            <p className="text-[10px] text-slate-700 leading-snug">
              játékmackó, plüss maci, gyerekjáték, ajándék, puha játék
            </p>
          </div>

          {/* Meta leírás — indigo (distinct from részletes leírás purple) */}
          <div className="rounded-lg bg-white p-2 shadow-sm" style={{ border: '2px solid #5c6bc0' }}>
            <SectionHeader
              title="Meta leírás"
              style={{ iconBg: '#5c6bc0', titleColor: '#3949ab' }}
              icon={
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                </svg>
              }
            />
            <p className="text-[10px] text-slate-600 leading-relaxed">
              [PRODUCT] — prémium plüss, hypoallergén anyag. [PRICE] · Ingyenes szállítás felett. Rendeld meg ma!
            </p>
            <p className="text-[9px] text-slate-400 mt-0.5">ShopRenter címkék: [PRODUCT], [PRICE] …</p>
          </div>

          {/* Termékképek — blue */}
          <div className="rounded-lg bg-white p-2 shadow-sm" style={{ border: '2px solid #2196f3' }}>
            <div className="flex items-center gap-2 mb-2">
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                style={{ backgroundColor: '#2196f3' }}
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M22 16V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2zm-11-4l2.03 2.71L16 11l4 5H8l3-4zM2 6v14c0 1.1.9 2 2 2h14v-2H4V6H2z" />
                </svg>
              </div>
              <span className="text-[11px] sm:text-xs font-bold text-[#1565c0]">Termékképek</span>
              <AiPill />
            </div>
            <div className="flex items-center gap-1.5">
              <img
                src="/banner/teddy.jpg"
                alt=""
                className="h-11 w-11 rounded border border-slate-200 object-cover"
                loading="lazy"
                decoding="async"
              />
              <img
                src="/banner/lego.jpg"
                alt=""
                className="h-11 w-11 rounded border border-slate-200 object-cover"
                loading="lazy"
                decoding="async"
              />
              <img
                src="/banner/puzlle.jpeg"
                alt=""
                className="h-11 w-11 rounded border border-slate-200 object-cover"
                loading="lazy"
                decoding="async"
              />
              <div className="flex h-11 w-11 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-[10px] font-bold text-slate-400">
                +
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
