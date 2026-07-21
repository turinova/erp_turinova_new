import React from 'react'

type Props = {
  url: string
  children: React.ReactNode
  className?: string
}

/** Mini browser chrome — same DNA as landing-v2 mocks. */
export default function BrowserFrame({ url, children, className = '' }: Props) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 text-left shadow-sm ${className}`}
      aria-hidden
    >
      <div className="flex items-center gap-1.5 border-b border-slate-200 bg-white px-3 py-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-300" />
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-300" />
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-300" />
        <div className="ml-2 flex h-7 min-w-0 flex-1 items-center rounded-md border border-slate-200/80 bg-slate-100 px-2">
          <span className="truncate font-mono text-[10px] tabular-nums text-slate-500 sm:text-[11px]">
            {url}
          </span>
        </div>
      </div>
      <div className="bg-[#fafafa]">{children}</div>
    </div>
  )
}
