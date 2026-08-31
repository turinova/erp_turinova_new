import type { Metadata } from "next";
import { HelpIndexView } from "@/components/help/HelpIndexView";
import { requireMerchant } from "@/lib/auth/require";
import { listPublishedHelpArticles } from "@/lib/help/load";

export const metadata: Metadata = {
  title: "Tudásbázis",
};

export default async function TudasbazisPage() {
  await requireMerchant();
  const articles = listPublishedHelpArticles();
  return <HelpIndexView articles={articles} />;
}
