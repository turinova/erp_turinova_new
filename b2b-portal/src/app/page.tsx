import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProGateLanding } from "@/components/marketing/ProGateLanding";
import { getSessionFromCookies } from "@/lib/auth/session";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: {
    absolute: `${COMPANY.brand} — B2B gyors rendelés Shoprenterhez`,
  },
  description:
    "ProGate: partnerár és gyors rendelés a meglévő Shoprenter bolton. Widget, árazás, automatizmus, riport. 14 nap próba.",
  robots: { index: true, follow: true },
};

/** Public entry — logged-in → app; guests → marketing landing. */
export default async function RootPage() {
  const session = await getSessionFromCookies();
  if (session?.isPlatformAdmin) {
    redirect("/admin");
  }
  if (session) {
    redirect("/home");
  }
  return <ProGateLanding />;
}
