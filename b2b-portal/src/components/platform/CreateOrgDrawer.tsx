"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PLAN_DEFAULTS, PLAN_IDS, RECOMMENDED_PLAN, TRIAL_DAYS_DEFAULT, type PlanId } from "@/lib/billing/plans";
import { PlanPriceTable } from "@/components/billing/PlanPriceTable";
import { ensureSlug } from "@/lib/orgs/slug";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (result: {
    organizationId: string;
    inviteUrl: string;
    ownerEmail: string;
  }) => void;
};

export function CreateOrgDrawer({ open, onClose, onCreated }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [shop, setShop] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [plan, setPlan] = useState<PlanId>("start");
  const [trialDays, setTrialDays] = useState(TRIAL_DAYS_DEFAULT);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setSlug("");
    setSlugTouched(false);
    setShop("");
    setStoreUrl("");
    setPlan("start");
    setTrialDays(TRIAL_DAYS_DEFAULT);
    setOwnerEmail("");
    setError(null);
    setPending(false);
  }, [open]);

  useEffect(() => {
    if (!slugTouched) setSlug(ensureSlug(name));
  }, [name, slugTouched]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/admin/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          shoprenterShopName: shop,
          storeUrl: storeUrl || undefined,
          plan,
          trialDays,
          ownerEmail,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        organizationId?: string;
        inviteUrl?: string;
        ownerEmail?: string;
      };
      if (!res.ok || !data.ok || !data.organizationId || !data.inviteUrl) {
        setError(data.error ?? "Sikertelen");
        setPending(false);
        return;
      }
      onCreated({
        organizationId: data.organizationId,
        inviteUrl: data.inviteUrl,
        ownerEmail: data.ownerEmail ?? ownerEmail,
      });
      onClose();
      router.refresh();
    } catch {
      setError("Hálózati hiba");
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 cursor-pointer bg-black/25"
        aria-label="Bezárás"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-[480px] flex-col border-l border-line-strong bg-surface">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-line-strong px-5">
          <h2 className="text-[15px] font-semibold tracking-tight">
            Új szervezet
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-[13px] font-medium text-faint hover:text-text"
          >
            Bezár
          </button>
        </header>

        <form
          onSubmit={submit}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5"
        >
          <p className="text-[13px] text-faint">
            30 nap Pro (fotó igen, logó nem). Utána ez a csomag. Plus = ajánlott
            ICP-nek (~40+ vevő). Start csak inbound kicsi boltnak.
          </p>

          <Field label="Szervezet neve">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Vasalatmester Kft."
            />
          </Field>
          <Field label="Slug">
            <input
              required
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              className={inputClass}
              placeholder="vasalatmester"
            />
          </Field>
          <Field label="Shoprenter shop name">
            <input
              required
              value={shop}
              onChange={(e) => setShop(e.target.value)}
              className={inputClass}
              placeholder="vasalatmester"
            />
          </Field>
          <Field label="Store URL (opcionális)">
            <input
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
              className={inputClass}
              placeholder="https://vasalatmester.hu"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Utána ez a csomag">
              <select
                value={plan}
                onChange={(e) =>
                  setPlan(
                    PLAN_IDS.includes(e.target.value as PlanId)
                      ? (e.target.value as PlanId)
                      : "start",
                  )
                }
                className="tn-select w-full"
              >
                {PLAN_IDS.map((id) => (
                  <option key={id} value={id}>
                    {PLAN_DEFAULTS[id].label}
                    {id === RECOMMENDED_PLAN ? " (ajánlott)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Trial napok">
              <input
                type="number"
                min={1}
                max={90}
                value={trialDays}
                onChange={(e) => setTrialDays(Number(e.target.value) || TRIAL_DAYS_DEFAULT)}
                className={inputClass}
              />
            </Field>
          </div>
          <PlanPriceTable highlight />

          <Field label="Owner email (meghívó)">
            <input
              required
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              className={inputClass}
              placeholder="ops@ceg.hu"
            />
          </Field>

          {error ? (
            <p className="text-[12px] font-medium text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-auto flex gap-2 border-t border-line-strong pt-4">
            <button
              type="button"
              onClick={onClose}
              className="tn-btn tn-btn-ghost flex-1"
            >
              Mégse
            </button>
            <button
              type="submit"
              disabled={pending}
              className="tn-btn tn-btn-primary flex-[1.4]"
            >
              {pending ? "…" : "Létrehozás"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="tn-field">
      <span className="tn-label">{label}</span>
      {children}
    </label>
  );
}

const inputClass = "tn-input";
