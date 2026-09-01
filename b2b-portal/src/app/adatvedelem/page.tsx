import type { Metadata } from "next";
import { LegalShell, renderLegalMarkdown } from "@/components/legal/LegalShell";
import { loadLegalMarkdown } from "@/lib/legal/load";

export const metadata: Metadata = {
  title: "Adatvédelmi irányelvek",
  description: "ProGate adatvédelmi irányelvek.",
  robots: { index: true, follow: true },
};

export default function AdatvedelemPage() {
  const md = loadLegalMarkdown("adatvedelem");
  return (
    <LegalShell activeHref="/adatvedelem">
      {renderLegalMarkdown(md)}
    </LegalShell>
  );
}
