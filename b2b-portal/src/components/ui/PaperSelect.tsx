"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export type PaperSelectOption = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: PaperSelectOption[];
  /** Üres érték labelje (pl. „Minden kategória”). */
  emptyLabel?: string;
  /** Ha true, megjelenik az üres opció. */
  allowEmpty?: boolean;
  ariaLabel?: string;
  className?: string;
  /** Ennyi tétel felett: kereső + sűrűbb lista. */
  denseFrom?: number;
  /** Trigger max szélesség. */
  maxWidth?: number | string;
  disabled?: boolean;
  size?: "sm" | "md";
  /**
   * Force open direction. Default: auto (felfelé, ha alul kevés a hely).
   * Sticky alsó sávoknál hasznos: "up".
   */
  preferPlacement?: "auto" | "up" | "down";
};

/**
 * Papír-szerű legördülő (Olvasó): erős vonal, fehér felület, 0 radius.
 * 10+ tételnél kompakt lista + kereső — a natív OS select ezt nem tudja.
 * Alsó képernyőszélnél felfelé nyílik (vevők sticky sáv).
 */
export function PaperSelect({
  value,
  onChange,
  options,
  emptyLabel = "—",
  allowEmpty = true,
  ariaLabel,
  className = "",
  denseFrom = 10,
  maxWidth,
  disabled = false,
  size = "sm",
  preferPlacement = "auto",
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const [placement, setPlacement] = useState<"up" | "down">("down");

  const dense = options.length >= denseFrom;
  const selected = options.find((o) => o.value === value);
  const triggerLabel =
    value === "" || value == null
      ? emptyLabel
      : (selected?.label ?? emptyLabel);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = allowEmpty
      ? [{ value: "", label: emptyLabel }, ...options]
      : options;
    if (!needle) return base;
    return base.filter((o) => o.label.toLowerCase().includes(needle));
  }, [allowEmpty, emptyLabel, options, q]);

  useLayoutEffect(() => {
    if (!open) return;
    if (preferPlacement === "up" || preferPlacement === "down") {
      setPlacement(preferPlacement);
      return;
    }
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const need = dense ? 240 : 280;
    setPlacement(
      spaceBelow < need && spaceAbove > spaceBelow ? "up" : "down",
    );
  }, [open, dense, preferPlacement, filtered.length]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setHi(0);
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
  }

  function onKey(e: KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((i) => Math.min(filtered.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[hi];
      if (opt) pick(opt.value);
    }
  }

  const triggerH = size === "sm" ? "h-7" : "h-8";
  const triggerText = size === "sm" ? "text-[11px]" : "text-[12px]";
  const rowH = dense ? "h-7" : "h-8";
  const rowText = dense ? "text-[11px]" : "text-[12px]";
  const panelMax = dense ? "max-h-[min(40vh,220px)]" : "max-h-[min(40vh,280px)]";
  const panelPos =
    placement === "up"
      ? "absolute left-0 bottom-[calc(100%+2px)] z-50"
      : "absolute left-0 top-[calc(100%+2px)] z-50";

  return (
    <div
      ref={rootRef}
      className={`relative inline-block min-w-0 ${className}`}
      style={maxWidth != null ? { maxWidth } : undefined}
      onKeyDown={onKey}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`tn-select-trigger ${triggerH} ${triggerText} w-full min-w-[7rem] cursor-pointer disabled:cursor-not-allowed disabled:opacity-45`}
      >
        <span className="min-w-0 flex-1 truncate text-left">{triggerLabel}</span>
        <span className="tn-select-chevron" aria-hidden />
      </button>

      {open ? (
        <div
          className={`${panelPos} min-w-full overflow-hidden border-[1.5px] border-line-strong bg-surface shadow-[0_8px_24px_rgba(0,0,0,.14)]`}
          style={{ minWidth: "max(100%, 12rem)" }}
        >
          {dense ? (
            <div className="border-b border-line-strong p-1">
              <input
                ref={searchRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setHi(0);
                }}
                placeholder="Keresés…"
                className="h-7 w-full border-[1.5px] border-line-strong bg-surface px-2 text-[11px] outline-none placeholder:text-faint focus:border-accent"
                aria-label="Szűrés a listában"
              />
            </div>
          ) : null}
          <ul
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            className={`${panelMax} overflow-y-auto overscroll-contain`}
          >
            {filtered.length === 0 ? (
              <li className="px-2.5 py-2 text-[11px] text-faint">
                Nincs találat
              </li>
            ) : (
              filtered.map((opt, i) => {
                const on = opt.value === value;
                const active = i === hi;
                return (
                  <li
                    key={`${opt.value || "empty"}-${i}`}
                    role="option"
                    aria-selected={on}
                  >
                    <button
                      type="button"
                      onMouseEnter={() => setHi(i)}
                      onClick={() => pick(opt.value)}
                      className={
                        on
                          ? `${rowH} ${rowText} flex w-full cursor-pointer items-center bg-accent-soft px-2.5 text-left font-semibold`
                          : active
                            ? `${rowH} ${rowText} flex w-full cursor-pointer items-center bg-surface-2 px-2.5 text-left`
                            : `${rowH} ${rowText} flex w-full cursor-pointer items-center px-2.5 text-left hover:bg-surface-2`
                      }
                    >
                      <span className="truncate">{opt.label}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
