import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s · Turinova B2B",
    default: "Turinova B2B",
  },
  description: "Shoprenter B2B gyors rendelés. Merchant és platform portál.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hu">
      <body className="antialiased">{children}</body>
    </html>
  );
}
