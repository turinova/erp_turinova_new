import { CryptoLive } from "@/components/crypto/CryptoLive"

export const metadata = { title: "Crypto live" }

export default function CryptoPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Crypto live — SOL + DOGE</h1>
        <p className="mt-1 text-sm text-muted">
          Élő scalp-signalok perp kereskedéshez, BTC/ETH kontextussal. A
          setupok: liquidity sweep + reclaim, US-open breakout, momentum
          pullback és VWAP mean reversion (csak range piacon). A trade-eket
          kézzel viszed be a saját platformodon — itt csak a signal születik,
          és a rendszer papíron követi végig.
        </p>
      </header>
      <CryptoLive />
    </div>
  )
}
