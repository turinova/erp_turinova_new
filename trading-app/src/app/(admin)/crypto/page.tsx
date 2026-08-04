import { CryptoLive } from "@/components/crypto/CryptoLive"

export const metadata = { title: "Crypto live" }

export default function CryptoPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Crypto desk — SOL / DOGE</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Nem tippoldal. Chart, szintek, checklist — ha a setup kész, fire; ha nem, ülsz.
          Élő trade-et a saját platformodon viszed; itt születik a signal, papíron
          skálázunk: <span className="text-foreground/80">50% @ 1R → BE → runner @ 2R</span>
          . A napló mondja meg, mi él meg 6 hét alatt — ne a hangulatod.
        </p>
      </header>
      <CryptoLive />
    </div>
  )
}
