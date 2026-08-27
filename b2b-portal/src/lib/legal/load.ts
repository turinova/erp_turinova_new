import { readFileSync } from "node:fs";
import { join } from "node:path";

export type LegalDocSlug =
  | "aszf"
  | "adatkezeles"
  | "adatvedelem"
  | "adatvedelmi-nyilatkozat";

const FILE_BY_SLUG: Record<LegalDocSlug, string> = {
  aszf: "aszf.md",
  adatkezeles: "adatkezeles.md",
  adatvedelem: "adatvedelem.md",
  "adatvedelmi-nyilatkozat": "adatvedelmi-nyilatkozat.md",
};

export function loadLegalMarkdown(slug: LegalDocSlug): string {
  const file = FILE_BY_SLUG[slug];
  const path = join(process.cwd(), "src/content/legal", file);
  return readFileSync(path, "utf8");
}
