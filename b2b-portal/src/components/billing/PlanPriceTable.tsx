import {
  PLAN_DEFAULTS,
  PLAN_IDS,
  RECOMMENDED_PLAN,
  annualPriceHuf,
  formatHuf,
} from "@/lib/billing/plans";

export function PlanPriceTable({
  highlight,
}: {
  highlight?: boolean;
}) {
  return (
    <div className="mt-4 border border-line-strong">
      <table className="w-full border-collapse text-left text-[12px]">
        <thead>
          <tr className="border-b border-line bg-surface-2 text-[10px] font-semibold uppercase tracking-wide text-faint">
            <th className="px-3 py-2">Csomag</th>
            <th className="px-2 py-2 text-right">Havi</th>
            <th className="px-2 py-2 text-right">Éves</th>
            <th className="px-3 py-2 text-right">Vevő / hó</th>
          </tr>
        </thead>
        <tbody>
          {PLAN_IDS.map((id) => {
            const d = PLAN_DEFAULTS[id];
            const rec = id === RECOMMENDED_PLAN;
            return (
              <tr
                key={id}
                className={
                  highlight && rec
                    ? "border-b border-line bg-surface-2 last:border-0"
                    : "border-b border-line last:border-0"
                }
              >
                <td className="px-3 py-2 font-semibold">
                  {d.label}
                  {rec ? (
                    <span className="ml-1 text-[10px] font-semibold uppercase text-faint">
                      Ajánlott
                    </span>
                  ) : null}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatHuf(d.listPriceHuf)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-faint">
                  {formatHuf(annualPriceHuf(id))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {d.partnerLimit}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
