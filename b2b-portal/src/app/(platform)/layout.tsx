import { requirePlatformAdmin } from "@/lib/auth/require";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePlatformAdmin();
  return children;
}
