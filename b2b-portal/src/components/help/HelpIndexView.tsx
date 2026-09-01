"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  HELP_CATEGORIES,
  listArticlesByCategory,
} from "@/lib/help/catalog";
import type { HelpArticleMeta } from "@/lib/help/types";

const SUPPORT_EMAIL = "hello@progate.hu";

export function HelpIndexView({
  articles,
}: {
  articles: HelpArticleMeta[];
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return articles;
    return articles.filter((a) => {
      const hay = [a.title, a.summary, ...(a.keywords ?? [])]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [articles, q]);

  const byCategory = useMemo(() => {
    const slugs = new Set(filtered.map((a) => a.slug));
    return HELP_CATEGORIES.map((cat) => ({
      cat,
      items: listArticlesByCategory(cat.id).filter((a) => slugs.has(a.slug)),
    })).filter((g) => g.items.length > 0);
  }, [filtered]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-6">
      <h1 className="text-[20px] font-semibold tracking-tight text-text">
        Tudásbázis
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-faint">
        Súgó a bolthoz, a widgethez és a partnerárakhoz.
      </p>

      <div className="mt-6">
        <label className="sr-only" htmlFor="help-search">
          Keresés a súgóban
        </label>
        <input
          id="help-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Keresés…"
          className="tn-input h-9 w-full text-[13px]"
          autoComplete="off"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="mt-8 text-[13px] text-faint">
          Nincs találat. Próbálj más kulcsszót, vagy írj:{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-semibold text-text underline underline-offset-2"
          >
            {SUPPORT_EMAIL}
          </a>
        </p>
      ) : (
        <div className="mt-8 space-y-8">
          {byCategory.map(({ cat, items }) => (
            <section key={cat.id}>
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                {cat.label}
              </h2>
              <p className="mt-1 text-[12px] text-faint">{cat.description}</p>
              <ul className="mt-3 divide-y divide-line border border-line-strong bg-surface">
                {items.map((a) => (
                  <li key={a.slug}>
                    <Link
                      href={`/tudasbazis/${a.slug}`}
                      className="block px-4 py-3 transition-colors hover:bg-surface-2"
                    >
                      <span className="text-[13px] font-semibold text-text">
                        {a.title}
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-relaxed text-faint">
                        {a.summary}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <aside className="mt-10 border border-line bg-surface-2 px-4 py-3 text-[12px] leading-relaxed text-faint">
        Nem találod, amit keresel?{" "}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="font-semibold text-text underline underline-offset-2"
        >
          {SUPPORT_EMAIL}
        </a>
      </aside>
    </div>
  );
}
