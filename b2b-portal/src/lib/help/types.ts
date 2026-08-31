export type HelpArticleStatus = "draft" | "published";

export type HelpCategory = {
  id: string;
  label: string;
  description: string;
  order: number;
};

export type HelpArticleMeta = {
  slug: string;
  categoryId: string;
  title: string;
  /** One-line teaser for index + search. */
  summary: string;
  order: number;
  status: HelpArticleStatus;
  keywords?: string[];
  related?: string[];
  /** Merchant routes where this article is the primary contextual help target. */
  appRoutes?: string[];
};

export type HelpArticle = HelpArticleMeta & {
  body: string;
};
