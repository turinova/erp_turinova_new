/**
 * iPhone-style frame containing a single SMS bubble.
 * Visual proof of the "SMS, ha elkészült" promise.
 */

export default function PhoneSmsMockup() {
  return (
    <div className="w-full max-w-[260px] mx-auto">
      <div
        className="relative rounded-[2.4rem] bg-slate-900 p-2.5"
        style={{
          boxShadow:
            "0 18px 40px rgba(0,0,0,0.18), inset 0 0 0 2px rgba(255,255,255,0.06)",
        }}
      >
        {/* Notch */}
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 h-4 w-20 rounded-full bg-slate-950" />

        {/* Screen */}
        <div className="rounded-[1.8rem] bg-white overflow-hidden relative">
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 pt-2 pb-1 text-[10px] font-bold text-slate-800">
            <span>9:42</span>
            <span className="flex items-center gap-1">
              <svg
                className="w-3 h-3"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path d="M2 22h20V2L2 22z" />
              </svg>
              <svg
                className="w-3 h-3"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
              </svg>
              <span className="ml-0.5 inline-block w-5 h-2.5 rounded-sm border border-slate-700 relative">
                <span className="absolute inset-0.5 right-1.5 bg-slate-800 rounded-[1px]" />
              </span>
            </span>
          </div>

          {/* Conversation header */}
          <div className="px-3 pt-2 pb-2 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[var(--color-brand)] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                HÁ
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-900 truncate">
                  HÍRÖS-Ablak
                </p>
                <p className="text-[9px] text-slate-500">+36 76 481 729</p>
              </div>
            </div>
          </div>

          {/* SMS body */}
          <div className="p-3 pb-5 bg-white min-h-[200px]">
            <p className="text-center text-[8px] text-slate-400 mb-2">
              ma 9:41
            </p>

            <div className="flex justify-start mb-2">
              <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-slate-100 px-3 py-2">
                <p className="text-[10px] text-slate-800 leading-snug">
                  Tisztelt Megrendelő! A POR-2026/047 árajánlat alapján leadott
                  rendelése elkészült.
                </p>
                <p className="text-[10px] text-slate-800 leading-snug mt-1">
                  Átvétel:{" "}
                  <span className="font-semibold">
                    Mindszenti krt. 10., munkanapokon 8–17 óráig.
                  </span>
                </p>
                <p className="text-[10px] text-slate-800 leading-snug mt-1">
                  Üdvözlettel: HÍRÖS-Ablak
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-1 mt-3 text-[8px] text-emerald-600 font-semibold">
              <svg
                className="w-3 h-3"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
              Kézbesítve
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
