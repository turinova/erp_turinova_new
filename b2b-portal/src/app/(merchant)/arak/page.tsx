import type { Metadata } from "next";
import { requireMerchant } from "@/lib/auth/require";
import { PricesView } from "@/components/merchant/PricesView";

export const metadata: Metadata = {
  title: "Árazás",
};

export default async function PricesPage() {
  await requireMerchant();
  return <PricesView />;
}
