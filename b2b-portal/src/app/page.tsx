import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ProGateLanding } from "@/components/marketing/ProGateLanding";
import { getSessionFromCookies } from "@/lib/auth/session";
import { COMPANY } from "@/lib/company";
import { hostFromHeaders, isAppHost, isMarketingHost } from "@/lib/hosts";

export const metadata: Metadata = {
  title: {
    absolute: `${COMPANY.brand} — B2B gyors rendelés Shoprenterhez`,
  },
  description:
    "ProGate: partnerár és gyors rendelés a meglévő Shoprenter bolton. Widget, árazás, automatizmus, riport. 14 nap próba.",
  robots: { index: true, follow: true },
};

/** Marketing on progate.hu; app.progate.hu is the portal (guests → marketing). */
export default async function RootPage() {
  const host = hostFromHeaders(await headers());
  const session = await getSessionFromCookies();

  if (isMarketingHost(host)) {
    return <ProGateLanding />;
  }

  if (session?.isPlatformAdmin) {
    redirect("/admin");
  }
  if (session) {
    redirect("/home");
  }
  if (isAppHost(host)) {
    redirect(`${COMPANY.marketingUrl}/`);
  }
  return <ProGateLanding />;
}
