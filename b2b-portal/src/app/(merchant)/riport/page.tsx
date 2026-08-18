import type { Metadata } from "next";
import { ReportsView } from "@/components/merchant/ReportsView";
import { requireMerchant } from "@/lib/auth/require";

export const metadata: Metadata = {
  title: "Riport",
};

export default async function MerchantReportsPage() {
  await requireMerchant();
  return <ReportsView />;
}
