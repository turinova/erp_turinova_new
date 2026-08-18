import type { Metadata } from "next";
import { CatalogStatusPanel } from "@/components/merchant/CatalogStatusPanel";
import { MerchantSettingsForm } from "@/components/merchant/MerchantSettingsForm";
import { requireMerchant } from "@/lib/auth/require";
import { withTenant } from "@/lib/db";
import { loadMerchantShop } from "@/lib/merchant/shop";

export const metadata: Metadata = {
  title: "Beállítások",
};

export default async function MerchantSettingsPage() {
  const session = await requireMerchant();
  const orgId = session.activeOrganizationId!;
  const shop = await withTenant(
    { organizationId: orgId, userId: session.userId },
    (client) => loadMerchantShop(client, orgId),
  );

  if (!shop) {
    return (
      <div className="rounded-none border-[0.5px] border-line-strong bg-surface p-5">
        <p className="text-[14px] font-semibold">Még nincs bolt</p>
        <p className="mt-1 text-[12px] text-muted">
          A Turinovának előbb létre kell hoznia a boltot. Írj nekünk, ha ez már megvan.
        </p>
      </div>
    );
  }

  return (
    <>
      <CatalogStatusPanel />
      <MerchantSettingsForm initial={shop} />
    </>
  );
}
