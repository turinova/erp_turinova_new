import { BinanceDesk } from "@/components/crypto/BinanceDesk"

export const metadata = { title: "Binance desk" }

export default function BinanceCryptoPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Binance Futures desk</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Élő USD-M pozíciók, egyenleg, SL/TP orderek. A /crypto signal fire ide köthető —
          auto default ki. Exit: 50% limit @ 1R, stop + TP2 closePosition; sync BE-re TP1 után.
          Withdraw jog nélkül használd az API key-t.
        </p>
      </header>
      <BinanceDesk />
    </div>
  )
}
