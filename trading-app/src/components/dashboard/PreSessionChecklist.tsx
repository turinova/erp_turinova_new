"use client"

import { useState } from "react"

const ITEMS = [
  "Csak 9:30–11:00 ET között tradelek (15:30–17:00 magyar idő)",
  "Max 2 trade ma — a második csak szabályos setupra",
  "Napi stop: -2R után vége, nincs kivétel",
  "ORB 15p + VWAP filter + volume (RVOL ≥ 1.2) aktív",
  "Demo mód — az első 3 hónapban nincs élő pénz",
]

export function PreSessionChecklist() {
  const [checked, setChecked] = useState<boolean[]>(ITEMS.map(() => false))
  const done = checked.filter(Boolean).length
  const allDone = done === ITEMS.length

  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Pre-session checklist</h2>
        <span
          className={`num rounded-full px-2.5 py-0.5 text-xs font-medium ${
            allDone ? "bg-win/15 text-win" : "bg-surface-2 text-muted"
          }`}
        >
          {done}/{ITEMS.length}
        </span>
      </div>

      <ul className="space-y-2.5">
        {ITEMS.map((item, i) => (
          <li key={item}>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={() =>
                  setChecked((prev) => prev.map((c, j) => (j === i ? !c : c)))
                }
                className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
              />
              <span className={checked[i] ? "text-muted line-through" : ""}>
                {item}
              </span>
            </label>
          </li>
        ))}
      </ul>

      {allDone && (
        <p className="mt-4 rounded-md bg-win/10 px-3 py-2 text-xs text-win">
          Minden pipálva — mehet a session. Fegyelmezett napot!
        </p>
      )}
    </section>
  )
}
