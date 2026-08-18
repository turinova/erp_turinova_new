import { createHash, randomBytes } from "crypto";

/** Invite / session token helpers — store only hashes in DB. */

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function inviteExpiresAt(days = 7): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export function sessionExpiresAt(days = 14): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
