import type { Bar } from "../../backtest/types"

/**
 * Tradovate market data provider — valós idejű CME adat.
 *
 * Beállítás (lásd README):
 *   1. Tradovate fiók + API Access add-on (Application Settings → API Access)
 *   2. .env.local:
 *        TRADOVATE_USERNAME=...
 *        TRADOVATE_PASSWORD=...
 *        TRADOVATE_CID=...        (API kulcs "Client ID")
 *        TRADOVATE_SEC=...        (API kulcs "Secret")
 *        TRADOVATE_ENV=demo       (vagy: live)
 *
 * A lekérés menete: REST auth → market data WebSocket → md/getChart
 * (1 perces gyertyák, 2 nap) → eoh jelzés után lezárás.
 */

export function isTradovateConfigured(): boolean {
  return Boolean(
    process.env.TRADOVATE_USERNAME &&
      process.env.TRADOVATE_PASSWORD &&
      process.env.TRADOVATE_CID &&
      process.env.TRADOVATE_SEC
  )
}

// --- auth token cache (a token több órán át érvényes) ---
let tokenCache: { mdToken: string; expiresAt: number } | null = null

async function getMdAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.mdToken
  }

  const env = process.env.TRADOVATE_ENV === "live" ? "live" : "demo"
  const res = await fetch(`https://${env}.tradovateapi.com/v1/auth/accesstokenrequest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: process.env.TRADOVATE_USERNAME,
      password: process.env.TRADOVATE_PASSWORD,
      appId: "TurinovaTradingApp",
      appVersion: "1.0",
      cid: Number(process.env.TRADOVATE_CID),
      sec: process.env.TRADOVATE_SEC,
      deviceId: process.env.TRADOVATE_DEVICE_ID ?? "trading-app-server",
    }),
  })
  if (!res.ok) throw new Error(`Tradovate auth HTTP ${res.status}`)
  const json = await res.json()
  if (json.errorText) throw new Error(`Tradovate auth: ${json.errorText}`)

  const mdToken: string | undefined = json.mdAccessToken ?? json.accessToken
  if (!mdToken) throw new Error("Tradovate auth: nincs mdAccessToken a válaszban")

  tokenCache = {
    mdToken,
    expiresAt: json.expirationTime
      ? new Date(json.expirationTime).getTime()
      : Date.now() + 60 * 60 * 1000,
  }
  return mdToken
}

/**
 * MNQ front-month kontrakt szimbólum (pl. "MNQU6").
 * Negyedéves lejáratok (már-jún-szep-dec), roll a lejárati hónap
 * 3. péntekje előtt ~1 héttel.
 */
export function frontMonthSymbol(now = new Date()): string {
  const MONTH_CODES: Record<number, string> = { 2: "H", 5: "M", 8: "U", 11: "Z" }

  let year = now.getUTCFullYear()
  let month = now.getUTCMonth()

  // következő negyedéves hónap (0-indexelt: 2, 5, 8, 11)
  while (!(month in MONTH_CODES)) {
    month++
    if (month > 11) {
      month = 0
      year++
    }
  }

  // 3. péntek az adott hónapban
  const first = new Date(Date.UTC(year, month, 1))
  const firstFriday = 1 + ((5 - first.getUTCDay() + 7) % 7)
  const thirdFriday = new Date(Date.UTC(year, month, firstFriday + 14))

  // roll: 7 nappal a lejárat előtt már a következő kontrakt
  const rollDate = new Date(thirdFriday.getTime() - 7 * 24 * 3600 * 1000)
  if (now >= rollDate) {
    month += 3
    if (month > 11) {
      month -= 12
      year++
    }
  }

  return `MNQ${MONTH_CODES[month]}${year % 10}`
}

interface TradovateBar {
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  upVolume?: number
  downVolume?: number
  volume?: number
}

export async function fetchTradovateBars(): Promise<{ symbol: string; bars: Bar[] }> {
  const mdToken = await getMdAccessToken()
  const symbol = frontMonthSymbol()

  const { default: WebSocket } = await import("ws")

  return new Promise((resolve, reject) => {
    const ws = new WebSocket("wss://md.tradovateapi.com/v1/websocket")
    const barsByTime = new Map<number, Bar>()
    let historicalId: number | null = null
    let settled = false

    const finish = (err?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      try {
        if (historicalId != null) {
          ws.send(`md/cancelChart\n9\n\n${JSON.stringify({ subscriptionId: historicalId })}`)
        }
        ws.close()
      } catch {
        // már zárva
      }
      if (err) {
        reject(err)
      } else {
        const bars = [...barsByTime.values()].sort((a, b) => a.t - b.t)
        if (bars.length === 0) {
          reject(new Error("Tradovate: nem érkezett gyertyaadat"))
        } else {
          resolve({ symbol, bars })
        }
      }
    }

    const timeout = setTimeout(
      () => finish(new Error("Tradovate: időtúllépés (15s)")),
      15_000
    )

    ws.on("error", (e: Error) => finish(new Error(`Tradovate WS: ${e.message}`)))

    ws.on("message", (raw: Buffer) => {
      const msg = raw.toString()
      const frameType = msg[0]

      // 'o' = kapcsolat nyitva → authorize
      if (frameType === "o") {
        ws.send(`authorize\n1\n\n${mdToken}`)
        return
      }
      // 'h' = heartbeat → válasz
      if (frameType === "h") {
        ws.send("[]")
        return
      }
      if (frameType !== "a") return

      let events: unknown[]
      try {
        events = JSON.parse(msg.slice(1))
      } catch {
        return
      }

      for (const ev of events as Record<string, unknown>[]) {
        // authorize válasz → chart kérés
        if (ev.i === 1) {
          if ((ev.s as number) !== 200) {
            finish(new Error(`Tradovate authorize hiba: ${JSON.stringify(ev)}`))
            return
          }
          const asFarAs = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
          ws.send(
            `md/getChart\n2\n\n${JSON.stringify({
              symbol,
              chartDescription: {
                underlyingType: "MinuteBar",
                elementSize: 1,
                elementSizeUnit: "UnderlyingUnits",
                withHistogram: false,
              },
              timeRange: { asFarAsTimestamp: asFarAs },
            })}`
          )
          continue
        }

        // getChart válasz → subscription id-k
        if (ev.i === 2) {
          if ((ev.s as number) !== 200) {
            finish(new Error(`Tradovate getChart hiba: ${JSON.stringify(ev)}`))
            return
          }
          const d = ev.d as { historicalId?: number } | undefined
          historicalId = d?.historicalId ?? null
          continue
        }

        // chart adatcsomagok
        if (ev.e === "chart") {
          const charts = (ev.d as { charts?: { eoh?: boolean; bars?: TradovateBar[] }[] })
            ?.charts
          if (!charts) continue
          let done = false
          for (const chart of charts) {
            for (const b of chart.bars ?? []) {
              const t = Math.floor(new Date(b.timestamp).getTime() / 1000)
              barsByTime.set(t, {
                t,
                o: b.open,
                h: b.high,
                l: b.low,
                c: b.close,
                v: b.volume ?? (b.upVolume ?? 0) + (b.downVolume ?? 0),
              })
            }
            if (chart.eoh) done = true
          }
          if (done) finish()
        }
      }
    })
  })
}
