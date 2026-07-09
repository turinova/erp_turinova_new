import type { Metadata } from "next"
import { CategoriesPageClient } from "@/components/kategoriak/categories-page-client"

export const metadata: Metadata = {
  title: "Kategóriák",
}

export default function KategoriakPage() {
  return <CategoriesPageClient />
}
