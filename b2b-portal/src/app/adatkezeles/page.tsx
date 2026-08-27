import type { Metadata } from "next";
import { LegalShell, renderLegalMarkdown } from "@/components/legal/LegalShell";
import { loadLegalMarkdown } from "@/lib/legal/load";

export const metadata: Metadata = {
  title: "Adatkezelési tájékoztató",
  description: "Turinova B2B adatkezelési tájékoztató.",
  robots: { index: true, follow: true },
};

export default function AdatkezelesPage() {
  const md = loadLegalMarkdown("adatkezeles");
  return (
    <LegalShell activeHref="/adatkezeles">
      {renderLegalMarkdown(md)}
    </LegalShell>
  );
}
