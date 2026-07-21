/** Shared atoms for Nettfront portal mockups — colors match customer-portal theme. */

export function NfChip({
  label,
  tone = "muted",
}: {
  label: string
  tone?: "success" | "warning" | "error" | "primary" | "muted" | "outline"
}) {
  const styles = {
    success: "bg-[#0F7B6C] text-white border-[#0c6559]",
    warning: "bg-[#D9730D] text-white border-[#b85f0a] uppercase tracking-wide",
    error: "bg-[#E03E3E] text-white border-[#c43434]",
    primary: "bg-black text-white border-black",
    outline: "bg-white text-slate-700 border-slate-300",
    muted: "bg-slate-100 text-slate-600 border-slate-200",
  }
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] font-bold border whitespace-nowrap ${styles[tone]}`}
    >
      {label}
    </span>
  )
}

export function NfBrowserChrome({ url = "www.turinova.hu/nettfront" }: { url?: string }) {
  return (
    <div className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
      <span className="w-2.5 h-2.5 rounded-full bg-red-300 shrink-0" />
      <span className="w-2.5 h-2.5 rounded-full bg-amber-300 shrink-0" />
      <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 shrink-0" />
      <div className="ml-2 min-w-0 flex-1 h-6 rounded-md bg-white border border-slate-200 px-2 flex items-center">
        <svg
          className="w-3 h-3 text-slate-400 mr-1 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 12.75v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
          />
        </svg>
        <span className="truncate text-[10px] text-slate-500 font-mono">{url}</span>
      </div>
    </div>
  )
}

export function NfField({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper?: string
}) {
  return (
    <div>
      <p className="text-[8px] text-slate-500 mb-0.5 font-medium truncate">{label}</p>
      <div className="rounded border border-slate-300 bg-[rgba(0,0,0,0.02)] px-2 py-1">
        <span className="text-[10px] text-slate-800 truncate">{value}</span>
      </div>
      {helper ? (
        <p className="mt-0.5 text-[7.5px] text-slate-500 truncate">{helper}</p>
      ) : null}
    </div>
  )
}

export function NfMattBadge() {
  return (
    <span className="inline-flex px-1 py-0.5 rounded text-[7px] font-semibold bg-slate-100 text-slate-600 border border-slate-300">
      Matt
    </span>
  )
}

export function NfGlossBadge() {
  return (
    <span className="inline-flex px-1 py-0.5 rounded text-[7px] font-semibold bg-[#F5E6B8] text-[#6B4E00] border border-[#B8860B]">
      Fényes
    </span>
  )
}
