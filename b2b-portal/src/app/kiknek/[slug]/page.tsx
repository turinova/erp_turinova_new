import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProGateVerticalPage } from "@/components/marketing/ProGateVerticalPage";
import {
  getAllVerticalSlugs,
  getVerticalBySlug,
} from "@/lib/marketing/verticals";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getAllVerticalSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const vertical = getVerticalBySlug(slug);
  if (!vertical) {
    return { title: "Nem található" };
  }
  return {
    title: vertical.metaTitle,
    description: vertical.metaDescription,
    robots: { index: true, follow: true },
  };
}

export default async function KiknekSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const vertical = getVerticalBySlug(slug);
  if (!vertical) {
    notFound();
  }
  return <ProGateVerticalPage vertical={vertical} />;
}
