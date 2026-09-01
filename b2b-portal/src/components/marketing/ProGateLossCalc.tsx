"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_ORDERS = 120;
const DEFAULT_MINUTES = 20;
const FIXED_WAGE = 5000;
const ERROR_RATE = 0.05;
const ERROR_MINUTES = 15;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useAnimatedNumber(target: number, ms = 220): number {
  const [value, setValue] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    if (prefersReducedMotion()) {
      current.current = target;
      setValue(target);
      return;
    }
    const from = current.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const eased = 1 - (1 - p) ** 2;
      const next = from + (target - from) * eased;
      current.current = next;
      setValue(next);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);

  return value;
}

function formatHours(hours: number): string {
  if (hours < 10) {
    return hours.toLocaleString("hu-HU", {
      maximumFractionDigits: 1,
      minimumFractionDigits: hours % 1 === 0 ? 0 : 1,
    });
  }
  return Math.round(hours).toLocaleString("hu-HU");
}

function formatHuf(value: number): string {
  return `${Math.round(value).toLocaleString("hu-HU")} Ft`;
}

export function ProGateLossCalc() {
  const [orders, setOrders] = useState(DEFAULT_ORDERS);
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);

  const { hours, labor, errorCost, money, yearly } = useMemo(() => {
    const laborH = (orders * minutes) / 60;
    const errorH = (orders * ERROR_RATE * ERROR_MINUTES) / 60;
    const laborFt = laborH * FIXED_WAGE;
    const errorFt = errorH * FIXED_WAGE;
    const total = laborFt + errorFt;
    return {
      hours: laborH + errorH,
      labor: laborFt,
      errorCost: errorFt,
      money: total,
      yearly: total * 12,
    };
  }, [orders, minutes]);

  const shownYearly = useAnimatedNumber(yearly);

  return (
    <aside className="pg-calc" aria-label="Kézi rendelésfelvétel költsége">
      <p className="pg-calc-kicker">
        Ennyit fizetsz évente a kézi rendelésfelvételért
      </p>
      <div className="pg-calc-out">
        <p className="pg-calc-money">
          <span className="pg-calc-money-n">{formatHuf(shownYearly)}</span>
          <span className="pg-calc-money-u"> / év</span>
        </p>
        <p className="pg-calc-hours">
          {formatHuf(money)} / hó · {formatHours(hours)} óra irodai munka —
          minden hónapban újra
        </p>
        <ul className="pg-calc-lines">
          <li>
            Rendelésfelvétel <b>{formatHuf(labor)}</b>
          </li>
          <li>
            Hibás rendelések javítása (minden 20.){" "}
            <b>{formatHuf(errorCost)}</b>
          </li>
        </ul>
        <p className="pg-calc-threat">
          Amíg a partnered vár — a versenytársadnál is rendelhet.
        </p>
        <p className="pg-calc-plan">
          Ezt havi 1 vacsora árért megoldjuk neked.
        </p>
        <p className="pg-calc-release">
          Ugyanez webshopos rendeléssel: ~0 Ft admin.
        </p>
      </div>

      <label className="pg-calc-row">
        <span>Havi B2B rendelés</span>
        <output>{orders}</output>
        <input
          type="range"
          min={10}
          max={400}
          step={5}
          value={orders}
          onChange={(e) => setOrders(Number(e.target.value))}
        />
      </label>
      <label className="pg-calc-row">
        <span>Perc / rendelés</span>
        <output>{minutes}</output>
        <input
          type="range"
          min={5}
          max={40}
          step={1}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
        />
      </label>

      <p className="pg-calc-wage">
        {FIXED_WAGE.toLocaleString("hu-HU")} Ft/óra · bruttó bérköltség
      </p>

      <p className="pg-calc-note">
        A kézi rendelésfelvételnél minden 20. rendelés hibás. A webshopban a
        partner maga viszi fel — hiba és várakozás nélkül, ~1 perc alatt.
      </p>
    </aside>
  );
}
