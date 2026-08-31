#!/usr/bin/env node
/**
 * AI-slop ellenőrzés a merchant súgó markdownokon.
 * Forrás: unslop-ai-text tells + magyar kiegészítések.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "src/content/help/articles");

const RULES = [
  {
    id: "em-dash",
    severity: "error",
    re: /—/g,
    msg: "Em dash (—). Használj vesszőt vagy pontot.",
  },
  {
    id: "en-dash",
    severity: "warn",
    re: / – /g,
    msg: "En dash kötőjel. Kerüld, ha nem szám tartomány.",
  },
  {
    id: "not-just-x",
    severity: "error",
    re: /nem csak|nem csupán|not just .+?, (it's|hanem)/gi,
    msg: "Antitézis („nem csak X, hanem Y”).",
  },
  {
    id: "dive",
    severity: "error",
    re: /\b(deep dive|dive into|merülj|merülünk)\b/gi,
    msg: "„Dive / merülés” metafora.",
  },
  {
    id: "delve-cluster",
    severity: "error",
    re: /\b(delve|seamless|leverage|robust|tapestry|game-?changer|zökkenőmentes|optimalizál)\b/gi,
    msg: "Corporate / AI szócsoport.",
  },
  {
    id: "hollow-opener",
    severity: "error",
    re: /^(Fontos megjegyezni|Összességében|Érdemes megfontolni|Ebben a cikkben|Lépésről lépésre)/gim,
    msg: "Üres AI nyitó.",
  },
  {
    id: "conclusion",
    severity: "error",
    re: /\b(In conclusion|Összegzés:|Összefoglalva)\b/gi,
    msg: "Formula záró.",
  },
  {
    id: "hope-helps",
    severity: "error",
    re: /\b(Remélem segített|Would you like me to|Ha bármi kérdésed van)\b/gi,
    msg: "Chat-asszisztens vége.",
  },
  {
    id: "bold-label-line",
    severity: "warn",
    re: /^[-*] \*\*[^*]+:\*\*/gm,
    msg: "Félkövér címke + kettőspont listaelemben.",
  },
  {
    id: "checklist-en",
    severity: "warn",
    re: /\bChecklist\b/gi,
    msg: "Angol „Checklist”. Használd: ellenőrzőlista / nézd végig.",
  },
  {
    id: "magazas",
    severity: "error",
    re: /(?:^|\s)(Ön|Önök|Önnek)(?:[\s,.!?]|$)|\b(kattintson|menjen|pipálja|állítsa|írja be|látja meg|állítsa be)\b/g,
    msg: "Magázás. Súgó = tegezés.",
  },
];

let failed = false;

for (const file of readdirSync(DIR).filter((f) => f.endsWith(".md"))) {
  const path = join(DIR, file);
  const text = readFileSync(path, "utf8");
  const rel = `articles/${file}`;

  for (const rule of RULES) {
    const matches = [...text.matchAll(rule.re)];
    if (matches.length === 0) continue;
    const level = rule.severity === "error" ? "ERROR" : "WARN";
    if (rule.severity === "error") failed = true;
    for (const m of matches) {
      const line = text.slice(0, m.index).split("\n").length;
      console.log(`${level} ${rel}:${line} [${rule.id}] ${rule.msg}`);
    }
  }
}

if (failed) {
  console.error("\nhelp-unslop-check: FAILED");
  process.exit(1);
}
console.log("help-unslop-check: OK");
