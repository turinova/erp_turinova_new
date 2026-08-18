import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrgDetailView } from "@/components/platform/OrgDetailView";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { withPlatformAdmin } from "@/lib/db";
import { getOrganizationDetail } from "@/lib/orgs/queries";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const detail = await withPlatformAdmin((client) =>
    getOrganizationDetail(client, id),
  );
  return { title: detail ? detail.name : "Szervezet" };
}

export default async function OrgDetailPage({ params }: Props) {
  const { id } = await params;
  const detail = await withPlatformAdmin((client) =>
    getOrganizationDetail(client, id),
  );
  if (!detail) notFound();

  return (
    <PlatformShell title={detail.name} nav="tenants">
      <OrgDetailView initial={detail} />
    </PlatformShell>
  );
}
