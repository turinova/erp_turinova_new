import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ProGateComingSoon } from "@/components/marketing/ProGateComingSoon";
import { ProGateLanding } from "@/components/marketing/ProGateLanding";
import { getSessionFromCookies } from "@/lib/auth/session";
import { COMPANY } from "@/lib/company";
import { hostFromHeaders, isAppHost, isMarketingHost } from "@/lib/hosts";
import { isProGateLandingComingSoon } from "@/lib/landing-mode";

export async function generateMetadata(): Promise<Metadata> {
  if (isProGateLandingComingSoon()) {
    return {
      title: { absolute: `${COMPANY.brand} — Hamarosan` },
      description: "A ProGate weboldal hamarosan elérhető.",
      robots: { index: false, follow: false },
    };
  }
  return {
    title: {
      absolute: `${COMPANY.brand} — B2B gyors rendelés Shoprenterhez`,
    },
    description:
      "ProGate: partnerár és gyors rendelés a meglévő Shoprenter bolton. Widget, árazás, automatizmus, riport. 14 nap próba.",
    robots: { index: true, follow: true },
  };
}

/** Marketing on progate.hu; app.progate.hu is the portal (guests → marketing). */
export default async function RootPage() {
  const host = hostFromHeaders(await headers());
  const session = await getSessionFromCookies();
  const comingSoon = isProGateLandingComingSoon();

  if (session?.isPlatformAdmin) {
    redirect("/admin");
  }
  if (session) {
    redirect("/home");
  }

  if (comingSoon) {
    if (isAppHost(host)) {
      redirect(`${COMPANY.marketingUrl}/`);
    }
    return <ProGateComingSoon />;
  }

  if (isMarketingHost(host)) {
    return <ProGateLanding />;
  }

  if (isAppHost(host)) {
    redirect(`${COMPANY.marketingUrl}/`);
  }
  return <ProGateLanding />;
}
