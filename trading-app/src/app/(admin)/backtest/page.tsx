import { BacktestPanel } from "@/components/backtest/BacktestPanel"

export const metadata = { title: "Backtest" }

export default function BacktestPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Backtest</h1>
        <p className="mt-1 text-sm text-muted">
          NQ futures 5 perces gyertyák (Yahoo, ~60 nap) · konzervatív modell:
          entry a jelzőgyertya záróárán, stop/target fill, ha mindkettő egy
          gyertyába esne, a stop számít. Frissítés:{" "}
          <code className="text-foreground">npm run fetch-data</code>
        </p>
      </header>

      <BacktestPanel />
    </div>
  )
}
