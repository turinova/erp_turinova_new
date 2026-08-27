import type { Metadata } from "next";
import { LegalShell, renderLegalMarkdown } from "@/components/legal/LegalShell";
import { loadLegalMarkdown } from "@/lib/legal/load";

export const metadata: Metadata = {
  title: "Általános szerződési feltételek",
  description: "Turinova B2B Általános szerződési feltételek (ÁSZF).",
  robots: { index: true, follow: true },
};

export default function AszfPage() {
  const md = loadLegalMarkdown("aszf");
  return (
    <LegalShell activeHref="/aszf">{renderLegalMarkdown(md)}</LegalShell>
  );
}
