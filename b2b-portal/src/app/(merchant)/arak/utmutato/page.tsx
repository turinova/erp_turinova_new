import type { Metadata } from "next";
import { requireMerchant } from "@/lib/auth/require";
import { PricingGuideView } from "@/components/merchant/PricingGuideView";

export const metadata: Metadata = {
  title: "Útmutató — Árak",
};

export default async function PricingGuidePage() {
  await requireMerchant();
  return <PricingGuideView />;
}
