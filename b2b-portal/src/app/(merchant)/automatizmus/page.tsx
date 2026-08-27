import type { Metadata } from "next";
import { requireMerchant } from "@/lib/auth/require";
import { LevelUpView } from "@/components/merchant/LevelUpView";

export const metadata: Metadata = {
  title: "Automatizmus",
};

export default async function AutomatizmusPage() {
  await requireMerchant();
  return <LevelUpView />;
}
