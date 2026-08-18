import type { Metadata } from "next";
import { requireMerchant } from "@/lib/auth/require";
import { CustomersView } from "@/components/merchant/CustomersView";

export const metadata: Metadata = {
  title: "Vevők",
};

export default async function CustomersPage() {
  await requireMerchant();
  return <CustomersView />;
}
