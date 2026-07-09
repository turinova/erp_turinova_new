import type { AppUser } from "@/types/users"
import { readClientAuthUser } from "@/lib/auth/client-user"

/** Bejelentkezett felhasználó — a Supabase auth session-ből (kliens cache). */
export function getCurrentUser(): AppUser {
  const fromAuth = readClientAuthUser()
  if (fromAuth) {
    return {
      id: fromAuth.id,
      email: fromAuth.email,
      displayName: fromAuth.displayName,
    }
  }
  return { id: "", email: "", displayName: "Ismeretlen felhasználó" }
}

/** Tevékenységnapló „Ki” oszlop — e-mail a fő azonosító */
export function formatActorLabel(user: Pick<AppUser, "email" | "displayName">): string {
  return user.email
}
