import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HelpArticleView } from "@/components/help/HelpArticleView";
import { requireMerchant } from "@/lib/auth/require";
import { allPublishedSlugs, loadHelpArticle } from "@/lib/help/load";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return allPublishedSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = loadHelpArticle(slug);
  if (!article) return { title: "Tudásbázis" };
  return {
    title: article.title,
    description: article.summary,
  };
}

export default async function HelpArticlePage({ params }: Props) {
  await requireMerchant();
  const { slug } = await params;
  const article = loadHelpArticle(slug);
  if (!article) notFound();
  return <HelpArticleView article={article} />;
}
