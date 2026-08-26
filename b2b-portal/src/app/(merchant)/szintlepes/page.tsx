import type { Metadata } from "next";
import { requireMerchant } from "@/lib/auth/require";
import { LevelUpView } from "@/components/merchant/LevelUpView";

export const metadata: Metadata = {
  title: "Szintlépés",
};

export default async function LevelUpPage() {
  await requireMerchant();
  return <LevelUpView />;
}
