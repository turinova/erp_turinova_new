import { cn } from '@/lib/utils'

/**
 * Statikus marketing mock: beérkezett quote-ready SMS iPhone keretben.
 * Szöveg = `DEFAULT_QUOTE_READY_SMS_BODY` minta (ASCII, ahogy az app küldi).
 * Nincs scroll, nincs DB, nincs interaktivitás.
 */

const SMS_SENDER = 'Turinova Mintabolt'
const SMS_BODY =
  'Kedves Kovacs Peter! A rendelese elkeszult es atveheto. Anyagok: EGGER W980 ST2 Udvozlettel, Turinova Mintabolt'

export function SmsErtesitesMockup({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'pointer-events-none flex select-none flex-col items-center gap-3',
        className
      )}
      aria-hidden
    >
      <div className="relative w-[min(100%,17.5rem)] rounded-[2.35rem] border-[5px] border-zinc-900 bg-zinc-900 p-2 shadow-lg">
        {/* Dynamic Island */}
        <div className="absolute left-1/2 top-3.5 z-10 h-6 w-[6.5rem] -translate-x-1/2 rounded-full bg-black" />

        <div className="overflow-hidden rounded-[1.85rem] bg-[#f2f2f7]">
          {/* Status bar */}
          <div className="flex items-end justify-between px-5 pb-1 pt-3.5">
            <span className="text-[11px] font-semibold tabular-nums text-ink">
              14:32
            </span>
            <div className="flex items-center gap-1">
              <span className="flex h-2 items-end gap-px" aria-hidden>
                <span className="h-1 w-0.5 rounded-sm bg-ink" />
                <span className="h-1.5 w-0.5 rounded-sm bg-ink" />
                <span className="h-2 w-0.5 rounded-sm bg-ink" />
                <span className="h-2.5 w-0.5 rounded-sm bg-ink/40" />
              </span>
              <span className="ml-0.5 h-2.5 w-5 rounded-[3px] border border-ink/80 p-px">
                <span className="block h-full w-[70%] rounded-[1px] bg-ink" />
              </span>
            </div>
          </div>

          {/* Messages header */}
          <div className="border-b border-black/5 px-4 pb-2.5 pt-1 text-center">
            <p className="text-[11px] font-medium text-[#8e8e93]">Üzenetek</p>
            <p className="mt-0.5 text-[15px] font-semibold text-ink">
              {SMS_SENDER}
            </p>
          </div>

          {/* Thread */}
          <div className="flex min-h-[17rem] flex-col justify-end gap-2 px-3 pb-4 pt-6">
            <p className="text-center text-[10px] font-medium text-[#8e8e93]">
              Ma 14:32
            </p>
            <div className="max-w-[92%] self-start rounded-[1.15rem] rounded-bl-md bg-white px-3 py-2.5 shadow-sm ring-1 ring-black/5">
              <p className="text-[12.5px] leading-snug text-ink">{SMS_BODY}</p>
            </div>
            <p className="pl-1 text-[10px] text-[#8e8e93]">Kézbesítve</p>
          </div>

          {/* Home indicator */}
          <div className="flex justify-center pb-2 pt-1">
            <span className="h-1 w-28 rounded-full bg-ink/25" />
          </div>
        </div>
      </div>

      <p className="text-center text-[13px] text-ink-secondary">
        Automatikus SMS a kész ajánlatról
      </p>
    </div>
  )
}
