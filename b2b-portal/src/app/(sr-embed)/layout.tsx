import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "ProGate · Shoprenter",
  robots: { index: false, follow: false },
};

/** Shoprenter admin iframe shell — no marketing chrome. */
export default function SrEmbedLayout({ children }: { children: ReactNode }) {
  return children;
}
