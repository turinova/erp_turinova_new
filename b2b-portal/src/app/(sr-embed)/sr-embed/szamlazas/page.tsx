import Link from "next/link";
import { EmbedErrorState } from "@/components/sr-embed/EmbedErrorState";
import { EmbedShell } from "@/components/sr-embed/EmbedShell";
import { getOrgBillingState } from "@/lib/billing/org-billing";
import { withPlatformAdmin } from "@/lib/db";
import { getEmbedSessionFromCookies } from "@/lib/shoprenter/embed-session";
import { findEmbedShopById } from "@/lib/shoprenter/embed-shop";

const STATUS_HU: Record<string, string> = {
  pending: "Fizetés folyamatban",
  active: "Aktív előfizetés",
  frozen: "Fizetés elakadt (frozen)",
  canceled: "Lemondva",
  declined: "Elutasítva",
  mailto: "E-mailes egyeztetés",
};

type Search = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return (v[0] || "").trim();
  return (v || "").trim();
}

export default async function SrEmbedSzamlazasPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const okFlag = one(sp.ok);

  const session = await getEmbedSessionFromCookies();
  if (!session) {
    return (
      <EmbedErrorState
        title="Nyisd meg a Shoprenterből"
        detail="Nincs érvényes embed session."
      />
    );
  }
  const shop = await findEmbedShopById(session.shopId);
  if (!shop) {
    return (
      <EmbedErrorState title="Bolt nem található" shopName={session.shopName} />
    );
  }

  const billing = await withPlatformAdmin((client) =>
    getOrgBillingState(client, shop.organizationId),
  );

  const statusLabel = billing.status
    ? STATUS_HU[billing.status] || billing.status
    : "Még nincs előfizetés";

  return (
    <EmbedShell shopName={shop.shopName} storeUrl={shop.storeUrl}>
      <div className="mx-auto w-full max-w-[640px] pb-12">
        <h1
          className="text-[28px] font-semibold leading-none tracking-tight text-text md:text-[34px]"
          style={{ letterSpacing: "-0.03em" }}
        >
          Számlázás
        </h1>
        <p className="mt-2 text-[15px] text-muted">
          Itt látod az App Store előfizetés állapotát.
        </p>

        {okFlag === "1" ? (
          <p className="mt-4 border border-ok bg-surface px-4 py-3 text-[14px] font-semibold text-ok">
            Fizetés sikeres. Ha a státusz még nem frissült, pár perc múlva nézd
            újra.
          </p>
        ) : null}
        {okFlag === "0" ? (
          <p className="mt-4 border border-danger bg-surface px-4 py-3 text-[14px] font-semibold text-danger">
            A fizetés nem sikerült. Próbáld újra az Előfizetés oldalon.
          </p>
        ) : null}

        <dl className="mt-6 border-[1.5px] border-line-strong bg-surface divide-y divide-line">
          <div className="flex justify-between gap-4 px-4 py-3 text-[14px]">
            <dt className="text-faint">Státusz</dt>
            <dd className="font-semibold text-text">{statusLabel}</dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-3 text-[14px]">
            <dt className="text-faint">Számlázás</dt>
            <dd className="font-semibold text-text">
              {billing.interval === "annual"
                ? "Éves"
                : billing.interval === "monthly"
                  ? "Havi"
                  : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-3 text-[14px]">
            <dt className="text-faint">Charge ID</dt>
            <dd className="font-mono text-[12px] text-text">
              {billing.chargeId || "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-3 text-[14px]">
            <dt className="text-faint">Frissítve</dt>
            <dd className="text-text">
              {billing.updatedAt
                ? new Date(billing.updatedAt).toLocaleString("hu-HU")
                : "—"}
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/sr-embed/elofizetes"
            className="tn-btn tn-btn-primary !h-11 px-5 text-[14px] font-semibold"
          >
            Előfizetés
          </Link>
          <Link
            href="/sr-embed"
            className="tn-btn tn-btn-ghost !h-11 px-5 text-[14px] font-semibold"
          >
            Kezdőlap
          </Link>
        </div>
      </div>
    </EmbedShell>
  );
}
