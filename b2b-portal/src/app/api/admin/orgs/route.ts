import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requirePlatformAdminApi,
} from "@/lib/auth/api";
import {
  generateToken,
  hashToken,
  inviteExpiresAt,
} from "@/lib/auth/tokens";
import { withPlatformAdmin, query } from "@/lib/db";
import {
  parsePlanId,
  TRIAL_DAYS_DEFAULT,
  type PlanId,
} from "@/lib/billing/plans";
import { listOrganizations } from "@/lib/orgs/queries";
import {
  ensureSlug,
  normalizeStoreUrl,
  originFromStoreUrl,
  slugify,
} from "@/lib/orgs/slug";

export async function GET(req: Request) {
  const auth = await requirePlatformAdminApi();
  if (isErrorResponse(auth)) return auth;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() || undefined;
  const status = url.searchParams.get("status")?.trim() || undefined;
  const plan = url.searchParams.get("plan")?.trim() || undefined;
  const health = url.searchParams.get("health")?.trim() || undefined;
  const catalog = url.searchParams.get("catalog")?.trim() || undefined;
  const widget = url.searchParams.get("widget")?.trim() || undefined;
  const flag = url.searchParams.get("flag")?.trim() || undefined;

  try {
    const rows = await withPlatformAdmin((client) =>
      listOrganizations(client, { q, status, plan, health, catalog, widget, flag }),
    );
    return NextResponse.json({ ok: true, organizations: rows });
  } catch (err) {
    console.error("[GET /api/admin/orgs]", err);
    return NextResponse.json({ error: "Lista hiba" }, { status: 500 });
  }
}

type CreateBody = {
  name?: string;
  slug?: string;
  shoprenterShopName?: string;
  storeUrl?: string;
  plan?: PlanId;
  trialDays?: number;
  ownerEmail?: string;
};

export async function POST(req: Request) {
  const auth = await requirePlatformAdminApi();
  if (isErrorResponse(auth)) return auth;

  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const shopName = body.shoprenterShopName?.trim().toLowerCase() ?? "";
  const ownerEmail = body.ownerEmail?.toLowerCase().trim() ?? "";
  const plan = parsePlanId(body.plan, "start");
  const trialDays = Math.min(
    90,
    Math.max(1, Number(body.trialDays) || TRIAL_DAYS_DEFAULT),
  );
  const storeUrl = normalizeStoreUrl(body.storeUrl);
  const slug = ensureSlug(name, body.slug);

  if (name.length < 2) {
    return NextResponse.json(
      { error: "Szervezet név kötelező (min. 2 karakter)" },
      { status: 400 },
    );
  }
  if (!shopName || !/^[a-z0-9][a-z0-9_-]{1,62}$/i.test(shopName)) {
    return NextResponse.json(
      {
        error:
          "Érvénytelen Shoprenter shop name (betű, szám, -, _; pl. vasalatmester)",
      },
      { status: 400 },
    );
  }
  if (!ownerEmail || !ownerEmail.includes("@")) {
    return NextResponse.json(
      { error: "Érvényes owner email kell" },
      { status: 400 },
    );
  }
  if (body.storeUrl?.trim() && !storeUrl) {
    return NextResponse.json({ error: "Érvénytelen Store URL" }, { status: 400 });
  }

  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + trialDays);

  const rawToken = generateToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = inviteExpiresAt(7);
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3030";
  const inviteUrl = `${appUrl}/invite/${rawToken}`;

  try {
    const created = await withPlatformAdmin(async (client) => {
      // unique slug retry
      let finalSlug = slug;
      for (let n = 0; n < 5; n++) {
        const clash = await query(
          client,
          `select 1 from organizations where slug = $1`,
          [finalSlug],
        );
        if (clash.rowCount === 0) break;
        finalSlug = `${slugify(name).slice(0, 40)}-${n + 2}`;
      }

      const shopClash = await query(
        client,
        `select 1 from shops where shoprenter_shop_name = $1`,
        [shopName],
      );
      if ((shopClash.rowCount ?? 0) > 0) {
        return {
          ok: false as const,
          status: 409 as const,
          error: "Ez a Shoprenter shop name már foglalt",
        };
      }

      const orgIns = await query<{ id: string }>(
        client,
        `insert into organizations (name, slug, status, plan, trial_ends_at)
         values ($1, $2, 'trial', $3, $4)
         returning id`,
        [name, finalSlug, plan, trialEnds.toISOString()],
      );
      const orgId = orgIns.rows[0].id;

      const shopIns = await query<{ id: string; public_id: string }>(
        client,
        `insert into shops (
           organization_id, shoprenter_shop_name, store_url, status, widget_enabled
         ) values ($1, $2, $3, 'draft', false)
         returning id, public_id`,
        [orgId, shopName, storeUrl],
      );
      const shopId = shopIns.rows[0].id;

      await query(
        client,
        `insert into widget_settings (shop_id) values ($1)`,
        [shopId],
      );

      if (storeUrl) {
        await query(
          client,
          `insert into shop_allowed_origins (shop_id, origin)
           values ($1, $2)
           on conflict do nothing`,
          [shopId, originFromStoreUrl(storeUrl)],
        );
      }

      await query(
        client,
        `insert into invitations (
           organization_id, email, role, token_hash, status,
           invited_by_user_id, expires_at
         ) values ($1, $2, 'owner', $3, 'pending', $4, $5)`,
        [orgId, ownerEmail, tokenHash, auth.userId, expiresAt.toISOString()],
      );

      await query(
        client,
        `insert into audit_events (organization_id, actor_user_id, action, meta)
         values ($1, $2, 'org.created', $3::jsonb)`,
        [
          orgId,
          auth.userId,
          JSON.stringify({
            slug: finalSlug,
            shop: shopName,
            owner_email: ownerEmail,
          }),
        ],
      );
      await query(
        client,
        `insert into audit_events (organization_id, actor_user_id, action, meta)
         values ($1, $2, 'invite.sent', $3::jsonb)`,
        [
          orgId,
          auth.userId,
          JSON.stringify({ email: ownerEmail, channel: "link_copy" }),
        ],
      );

      return {
        ok: true as const,
        orgId,
        slug: finalSlug,
        publicId: shopIns.rows[0].public_id,
        inviteUrl,
        ownerEmail,
      };
    }, auth.userId);

    if (!created.ok) {
      return NextResponse.json(
        { error: created.error },
        { status: created.status },
      );
    }

    return NextResponse.json({
      ok: true,
      organizationId: created.orgId,
      slug: created.slug,
      publicId: created.publicId,
      inviteUrl: created.inviteUrl,
      ownerEmail: created.ownerEmail,
      emailSent: false,
      message:
        "Szervezet létrehozva. Másold a meghívó linket. Email küldés még nincs bekötve.",
    });
  } catch (err) {
    console.error("[POST /api/admin/orgs]", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("organizations_slug_unique") || msg.includes("duplicate")) {
      return NextResponse.json(
        { error: "Slug vagy shop name ütközés" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Létrehozás sikertelen" }, { status: 500 });
  }
}
