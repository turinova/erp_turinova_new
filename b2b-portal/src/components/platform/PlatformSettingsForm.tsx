"use client";

import { useEffect, useState } from "react";
import { PLAN_DEFAULTS, TRIAL_DAYS_DEFAULT, type PlanId } from "@/lib/billing/plans";
type PlanDefaultRow = {
  plan: PlanId;
  partnerLimit: number;
  skuLimit: number;
  listPriceHuf: number;
};

type PlatformSettingsDto = {
  trialDays: number;
  syncConcurrency: number;
  portalTopNGate: boolean;
  plans: PlanDefaultRow[];
};

type PlanDraft = {
  plan: PlanId;
  partnerLimit: string;
  skuLimit: string;
  listPriceHuf: string;
};

export function PlatformSettingsForm() {
  const [trialDays, setTrialDays] = useState(String(TRIAL_DAYS_DEFAULT));
  const [syncConcurrency, setSyncConcurrency] = useState("10");
  const [portalTopNGate, setPortalTopNGate] = useState(true);
  const [plans, setPlans] = useState<PlanDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/settings");
      const json = (await res.json()) as {
        ok?: boolean;
        settings?: PlatformSettingsDto;
        error?: string;
      };
      if (!res.ok || !json.settings) {
        setError(json.error ?? "Nem töltődött.");
        return;
      }
      const s = json.settings;
      setTrialDays(String(s.trialDays));
      setSyncConcurrency(String(s.syncConcurrency));
      setPortalTopNGate(s.portalTopNGate);
      setPlans(
        s.plans.map((p) => ({
          plan: p.plan,
          partnerLimit: String(p.partnerLimit),
          skuLimit: String(p.skuLimit),
          listPriceHuf: String(p.listPriceHuf),
        })),
      );
      setLoaded(true);
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trialDays: Number(trialDays),
          syncConcurrency: Number(syncConcurrency),
          portalTopNGate,
          plans: plans.map((p) => ({
            plan: p.plan,
            partnerLimit: Number(p.partnerLimit),
            skuLimit: Number(p.skuLimit),
            listPriceHuf: Number(p.listPriceHuf),
          })),
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Mentés sikertelen");
        return;
      }
      setMessage("Mentve.");
    } catch {
      setError("Nincs net.");
    } finally {
      setPending(false);
    }
  }

  function patchPlan(id: PlanId, field: keyof Omit<PlanDraft, "plan">, value: string) {
    setPlans((prev) =>
      prev.map((p) => (p.plan === id ? { ...p, [field]: value } : p)),
    );
  }

  if (!loaded && !error) {
    return <p className="text-[13px] text-faint">Betöltés…</p>;
  }

  return (
    <form className="flex max-w-[720px] flex-col gap-8" onSubmit={(e) => void save(e)}>
      {error ? <p className="text-[13px] font-medium text-danger">{error}</p> : null}
      {message ? <p className="text-[13px] font-medium text-ok">{message}</p> : null}

      <section>
        <h2 className="tn-section-title">Új szervezet</h2>
        <p className="tn-section-sub">
          Alapértelmezett próbaidő új tenantoknak (nap). A merchant oldalon teljes
          termék jár; a Turinova felirat próba alatt látszik. Futtasd a sql/018-at
          (és 028-at v5 árakhoz), ha a mentés nem marad meg.
        </p>
        <label className="tn-field mt-4 max-w-xs">
          <span className="tn-label">Próba napok</span>
          <input
            className="tn-input"
            value={trialDays}
            onChange={(e) => setTrialDays(e.target.value)}
          />
        </label>
      </section>

      <section className="tn-section">
        <h2 className="tn-section-title">Csomagok</h2>
        <p className="tn-section-sub">
          Merchant pitch: egy termék (Gyors rendelés) + opcionális saját márka.
          Itt a soft limitek és listárak. Start = alapár; plus / pro = fehér címke
          (ugyanaz az ár). Vevő / termékhely = infra cap, nem a fő eladási üzenet.
        </p>
        <div className="mt-4 overflow-x-auto border border-line-strong">
          <table className="w-full min-w-[520px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line-strong bg-surface-2">
                <th className="px-3 py-2 text-[11px] font-semibold uppercase text-faint">
                  Csomag
                </th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase text-faint">
                  Vevő
                </th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase text-faint">
                  Termékhely
                </th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase text-faint">
                  Ár (Ft)
                </th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.plan} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 font-medium">
                    {PLAN_DEFAULTS[p.plan].label}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="tn-input !h-8"
                      value={p.partnerLimit}
                      onChange={(e) =>
                        patchPlan(p.plan, "partnerLimit", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="tn-input !h-8"
                      value={p.skuLimit}
                      onChange={(e) => patchPlan(p.plan, "skuLimit", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="tn-input !h-8"
                      value={p.listPriceHuf}
                      onChange={(e) =>
                        patchPlan(p.plan, "listPriceHuf", e.target.value)
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="tn-section">
        <h2 className="tn-section-title">Motor</h2>
        <label className="tn-field mt-4 max-w-xs">
          <span className="tn-label">Párhuzamos másolás (shop)</span>
          <input
            className="tn-input"
            value={syncConcurrency}
            onChange={(e) => setSyncConcurrency(e.target.value)}
          />
        </label>
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={portalTopNGate}
            onChange={(e) => setPortalTopNGate(e.target.checked)}
            className="accent-accent"
          />
          Portál: limit felett a plusz vevők elrejtése
        </label>
      </section>

      <button type="submit" disabled={pending} className="tn-btn tn-btn-primary self-start">
        {pending ? "…" : "Mentés"}
      </button>
    </form>
  );
}
