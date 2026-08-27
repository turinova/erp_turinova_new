import type { Metadata } from "next";
import Link from "next/link";
import { InviteAcceptForm } from "@/components/auth/InviteAcceptForm";
import { PlanPriceTable } from "@/components/billing/PlanPriceTable";
import { TurinovaWordmark } from "@/components/brand/TurinovaWordmark";
import { hashToken } from "@/lib/auth/tokens";
import { PLAN_DEFAULTS, TRIAL_DAYS_DEFAULT, parsePlanId } from "@/lib/billing/plans";
import { withPlatformAdmin, query } from "@/lib/db";

export const metadata: Metadata = {
  title: "Meghívó",
};

type InviteRow = {
  id: string;
  email: string;
  status: string;
  expires_at: string;
  org_name: string;
  plan: string;
};

async function loadInvite(token: string): Promise<InviteRow | null> {
  if (!token || token.length < 16) return null;
  const tokenHash = hashToken(token);
  return withPlatformAdmin(async (client) => {
    const res = await query<InviteRow>(
      client,
      `select i.id, i.email, i.status, i.expires_at, o.name as org_name, o.plan
       from invitations i
       join organizations o on o.id = i.organization_id
       where i.token_hash = $1
       limit 1`,
      [tokenHash],
    );
    return res.rows[0] ?? null;
  });
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let invite: InviteRow | null = null;
  let loadError: string | null = null;
  try {
    invite = await loadInvite(token);
  } catch {
    loadError = "Adatbázis hiba";
  }

  const expired =
    invite &&
    (invite.status !== "pending" || new Date(invite.expires_at) <= new Date());

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-10">
        <div className="relative w-full max-w-[420px]">
        <div className="mb-5 flex justify-center">
          <TurinovaWordmark height={24} />
        </div>

        <div className="rounded-none border-[0.5px] border-line-strong bg-surface p-5 shadow-[0_8px_24px_rgba(26,25,23,.06)]">
          <h1 className="text-[15px] font-semibold">Meghívó elfogadása</h1>
          {loadError ? (
            <p className="mt-2 text-[12px] text-danger">{loadError}</p>
          ) : !invite ? (
            <p className="mt-2 text-[12px] text-muted">
              Érvénytelen meghívó link.
            </p>
          ) : expired ? (
            <p className="mt-2 text-[12px] text-muted">
              Ez a meghívó lejárt vagy már felhasználták. Kérj újat.
            </p>
          ) : (
            <>
              <p className="mt-2 text-[12px] text-muted">
                Szervezet:{" "}
                <strong className="text-text">{invite.org_name}</strong>
              </p>
              <p className="mt-3 text-[12px] text-muted">
                {TRIAL_DAYS_DEFAULT} nap próba: teljes gyors rendelés. A Turinova
                felirat a widgeten látszik. Utána{" "}
                <strong className="text-text">
                  {PLAN_DEFAULTS[parsePlanId(invite.plan)].label}
                </strong>
                , ha nem írsz.
              </p>
              <PlanPriceTable highlight />
              <InviteAcceptForm token={token} email={invite.email} />
            </>
          )}
          <Link
            href="/login"
            className="mt-4 inline-flex h-8 items-center text-[12px] font-semibold text-accent hover:underline"
          >
            ← Bejelentkezés
          </Link>
        </div>
      </div>
    </main>
  );
}
