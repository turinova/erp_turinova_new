import {
  BASE_PRICE_HUF,
  MARK_ADDON_HUF,
  WHITE_LABEL_PRICE_HUF,
  formatHuf,
} from "@/lib/billing/plans";

export function PlanPriceTable({
  highlight,
}: {
  highlight?: boolean;
}) {
  void highlight;
  return (
    <div className="mt-4 border border-line-strong">
      <table className="w-full border-collapse text-left text-[12px]">
        <thead>
          <tr className="border-b border-line bg-surface-2 text-[10px] font-semibold uppercase tracking-wide text-faint">
            <th className="px-3 py-2">Tétel</th>
            <th className="px-3 py-2 text-right">Havi</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-line bg-surface-2">
            <td className="px-3 py-2 font-semibold">Gyors rendelés</td>
            <td className="px-3 py-2 text-right tabular-nums">
              {formatHuf(BASE_PRICE_HUF)}
            </td>
          </tr>
          <tr className="border-b border-line last:border-0">
            <td className="px-3 py-2">
              Turinova felirat eltávolítása{" "}
              <span className="text-faint">(opcionális)</span>
            </td>
            <td className="px-3 py-2 text-right tabular-nums">
              +{formatHuf(MARK_ADDON_HUF)}
            </td>
          </tr>
          <tr className="last:border-0">
            <td className="px-3 py-2 font-semibold text-faint">
              Összesen saját márkával
            </td>
            <td className="px-3 py-2 text-right tabular-nums font-semibold">
              {formatHuf(WHITE_LABEL_PRICE_HUF)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
