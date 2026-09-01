import Link from "next/link";
import { renderHelpMarkdown } from "@/components/help/renderHelpMarkdown";
import {
  getHelpCategory,
  getArticleMeta,
} from "@/lib/help/catalog";
import type { HelpArticle } from "@/lib/help/types";

const SUPPORT_EMAIL = "hello@progate.hu";

export function HelpArticleView({ article }: { article: HelpArticle }) {
  const category = getHelpCategory(article.categoryId);
  const related = (article.related ?? [])
    .map((slug) => getArticleMeta(slug))
    .filter((m): m is NonNullable<typeof m> => m?.status === "published");

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-6">
      <nav className="text-[12px] text-faint" aria-label="Útvonal">
        <Link
          href="/tudasbazis"
          className="underline underline-offset-2 hover:text-text"
        >
          Tudásbázis
        </Link>
        {category ? (
          <>
            <span className="mx-1.5">/</span>
            <span>{category.label}</span>
          </>
        ) : null}
      </nav>

      <article className="mt-4">{renderHelpMarkdown(article.body)}</article>

      {related.length > 0 ? (
        <section className="mt-10 border-t border-line pt-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
            Kapcsolódó
          </p>
          <ul className="mt-2 space-y-2">
            {related.map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/tudasbazis/${r.slug}`}
                  className="text-[13px] font-semibold text-text underline underline-offset-2 hover:text-accent-ink"
                >
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <aside className="mt-10 border border-line bg-surface-2 px-4 py-3 text-[12px] leading-relaxed text-faint">
        Hasznos volt? Ha még elakadtál, írj:{" "}
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=Súgó — ${encodeURIComponent(article.title)}`}
          className="font-semibold text-text underline underline-offset-2"
        >
          {SUPPORT_EMAIL}
        </a>
      </aside>

      <p className="mt-6">
        <Link
          href="/tudasbazis"
          className="text-[12px] font-semibold text-faint underline underline-offset-2 hover:text-text"
        >
          ← Vissza a Tudásbázishoz
        </Link>
      </p>
    </div>
  );
}
