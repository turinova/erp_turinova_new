import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminTenantsView } from "@/components/platform/AdminTenantsView";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { withPlatformAdmin } from "@/lib/db";
import { listOrganizations } from "@/lib/orgs/queries";

export const metadata: Metadata = {
  title: "Tenantok",
};

type Props = {
  searchParams: Promise<{ q?: string; status?: string; plan?: string }>;
};

export default async function PlatformAdminPage({ searchParams }: Props) {
  const sp = await searchParams;
  const rows = await withPlatformAdmin((client) =>
    listOrganizations(client, {
      q: sp.q,
      status: sp.status,
      plan: sp.plan,
    }),
  );

  return (
    <PlatformShell title="Tenantok" nav="tenants">
      <Suspense fallback={<p className="text-[12px] text-muted">Betöltés…</p>}>
        <AdminTenantsView initialRows={rows} />
      </Suspense>
    </PlatformShell>
  );
}
