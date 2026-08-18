import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth/session";

/** Public entry — redirect authenticated users; others → login. */
export default async function RootPage() {
  const session = await getSessionFromCookies();
  if (session?.isPlatformAdmin) {
    redirect("/admin");
  }
  if (session) {
    redirect("/home");
  }
  redirect("/login");
}
