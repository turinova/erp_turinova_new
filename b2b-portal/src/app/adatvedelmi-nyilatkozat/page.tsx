import type { Metadata } from "next";
import { LegalShell, renderLegalMarkdown } from "@/components/legal/LegalShell";
import { loadLegalMarkdown } from "@/lib/legal/load";

export const metadata: Metadata = {
  title: "Adatvédelmi nyilatkozat",
  description: "Turinova B2B adatvédelmi nyilatkozat.",
  robots: { index: true, follow: true },
};

export default function AdatvedelmiNyilatkozatPage() {
  const md = loadLegalMarkdown("adatvedelmi-nyilatkozat");
  return (
    <LegalShell activeHref="/adatvedelmi-nyilatkozat">
      {renderLegalMarkdown(md)}
    </LegalShell>
  );
}
