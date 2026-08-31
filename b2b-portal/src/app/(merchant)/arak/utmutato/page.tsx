import type { Metadata } from "next";
import { PricingGuideView } from "@/components/merchant/PricingGuideView";

export const metadata: Metadata = {
  title: "Árazás — útmutató",
};

export default function PricingGuidePage() {
  return <PricingGuideView />;
}
