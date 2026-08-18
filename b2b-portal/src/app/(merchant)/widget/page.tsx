import type { Metadata } from "next";
import { headers } from "next/headers";
import { WidgetSettingsForm } from "@/components/merchant/WidgetSettingsForm";
import { requireMerchant } from "@/lib/auth/require";
import { withTenant } from "@/lib/db";
import { publicAppUrl } from "@/lib/public-app-url";
import { loadMerchantWidget } from "@/lib/widget/settings";

export const metadata: Metadata = {
  title: "Gyors rendelés",
};

export default async function MerchantWidgetPage() {
  const session = await requireMerchant();
  const orgId = session.activeOrganizationId!;
  const apiBase = publicAppUrl(await headers());
  const widget = await withTenant(
    { organizationId: orgId, userId: session.userId },
    (client) => loadMerchantWidget(client, orgId),
  );

  if (!widget) {
    return (
      <div className="rounded-none border-[0.5px] border-line-strong bg-surface p-5">
        <p className="text-[14px] font-semibold">Még nincs bolt</p>
        <p className="mt-1 text-[12px] text-muted">
          A Turinovának előbb létre kell hoznia a boltot.
        </p>
      </div>
    );
  }

  return <WidgetSettingsForm initial={widget} apiBase={apiBase} />;
}
