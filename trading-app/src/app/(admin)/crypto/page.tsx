import { CryptoLive } from "@/components/crypto/CryptoLive"

export const metadata = { title: "Crypto live" }

export default function CryptoPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Crypto live — SOL + DOGE</h1>
        <p className="mt-1 text-sm text-muted">
          Nagy chart, setup ki/be kapcsolók, és a „hogyan épül fel” checklist —
          így látod, hol tart a trükk, mielőtt belépnél. A trade-eket kézzel
          viszed be a saját platformodon; itt a signal születik, és a rendszer
          papíron követi.
        </p>
      </header>
      <CryptoLive />
    </div>
  )
}
