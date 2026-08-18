import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireMerchant } from "@/lib/auth/require";
import { CustomerDetailView } from "@/components/merchant/CustomerDetailView";

export const metadata: Metadata = {
  title: "Vevő",
};

type Props = { params: Promise<{ id: string }> };

export default async function CustomerDetailPage({ params }: Props) {
  await requireMerchant();
  const { id } = await params;
  const innerId = Number(id);
  if (!Number.isFinite(innerId) || innerId <= 0) notFound();
  return <CustomerDetailView customerInnerId={innerId} />;
}
