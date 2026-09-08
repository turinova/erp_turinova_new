import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Widget előnézet",
  robots: { index: false, follow: false },
};

/** Isolated sandbox for merchant/embed live preview iframe. */
export default function WidgetPreviewLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
