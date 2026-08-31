import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  getArticleMeta,
  listPublishedArticles,
} from "@/lib/help/catalog";
import type { HelpArticle, HelpArticleMeta } from "@/lib/help/types";

const ARTICLES_DIR = join(process.cwd(), "src/content/help/articles");

function loadMarkdownBody(slug: string): string | null {
  const path = join(ARTICLES_DIR, `${slug}.md`);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

export function loadHelpArticle(slug: string): HelpArticle | null {
  const meta = getArticleMeta(slug);
  if (!meta || meta.status !== "published") return null;
  const body = loadMarkdownBody(slug);
  if (!body) return null;
  return { ...meta, body };
}

export function listPublishedHelpArticles(): HelpArticleMeta[] {
  return listPublishedArticles().filter((meta) => {
    const path = join(ARTICLES_DIR, `${meta.slug}.md`);
    return existsSync(path);
  });
}

export function searchHelpArticles(query: string): HelpArticleMeta[] {
  const q = query.trim().toLowerCase();
  if (!q) return listPublishedHelpArticles();
  return listPublishedHelpArticles().filter((a) => {
    const hay = [
      a.title,
      a.summary,
      ...(a.keywords ?? []),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function allPublishedSlugs(): string[] {
  return listPublishedHelpArticles().map((a) => a.slug);
}
