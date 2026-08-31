import type { MarketingSignature } from "@/lib/merchant/partner-activation";

/** Minimal input — only merchant-branded fields, no per-shop stats. */
export type LaunchEmailContext = {
  shopName: string;
  shopUrl: string;
  buttonLabel: string;
  logoUrl: string;
  signature: MarketingSignature;
};

export type BuiltLaunchEmail = {
  subject: string;
  plainText: string;
  html: string;
};

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

const CTA_COLOR = "#0B6BCB";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loginUrlForShop(shopUrl: string): string {
  if (!shopUrl) return "";
  return `${shopUrl.replace(/\/$/, "")}/account/login`;
}

function renderHeader(input: {
  shopName: string;
  logoUrl: string;
}): string {
  const shop = escapeHtml(input.shopName);
  const logoUrl = input.logoUrl.trim();
  const logoCell =
    logoUrl.startsWith("http://") || logoUrl.startsWith("https://")
      ? `<img src="${escapeHtml(logoUrl)}" alt="${shop}" height="40" style="display:block;height:40px;width:auto;max-width:200px;border:0;" />`
      : `<p style="margin:0;font-size:17px;font-weight:600;color:#111111;">${shop}</p>`;

  return `<tr>
    <td style="padding:20px 24px 16px;border-bottom:1px solid #F0F0F0;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="vertical-align:middle;">${logoCell}</td>
          <td align="right" style="vertical-align:middle;">
            <span style="display:inline-block;padding:6px 13px 6px 10px;border-radius:999px;font-size:12px;font-weight:600;background-color:#EDF7ED;color:#1A6B1A;border:1px solid #A8D5A8;">
              <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background-color:#2E7D32;margin-right:5px;vertical-align:middle;"></span>Gyors rendelés
            </span>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function renderBenefits(): string {
  const items = [
    {
      title: "Ismét rendelés percek alatt",
      body: "Megvan a cikkszám? Nem kell a katalógusban keresgélni — beírod, kosárba, kész.",
    },
    {
      title: "Kevesebb telefon, kevesebb email",
      body: "A rendelésed ugyanott landol, mintha eddig is leadtad volna — csak gyorsabban.",
    },
    {
      title: "Partnerár automatikusan",
      body: "Bejelentkezés után minden tételnél a neked járó ár látszik.",
    },
  ];

  const rows = items
    .map(
      (item, i) => `<tr>
        <td style="padding:10px 14px;color:#111111;${i < items.length - 1 ? "border-bottom:1px solid #F0F0F0;" : ""}vertical-align:top;">
          <strong style="font-weight:600;">${escapeHtml(item.title)}</strong>
          <span style="color:#666666;"> — ${escapeHtml(item.body)}</span>
        </td>
      </tr>`,
    )
    .join("");

  return `<tr>
    <td style="padding:20px 24px 0;">
      <p style="margin:0 0 10px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#999999;">Miért használd?</p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #F0F0F0;border-radius:8px;overflow:hidden;font-size:13px;">
        ${rows}
      </table>
    </td>
  </tr>`;
}

function renderSteps(buttonLabel: string): string {
  const btn = escapeHtml(buttonLabel || "Gyors rendelés");
  const steps = [
    { n: "1", label: "Jelentkezz be a boltba" },
    { n: "2", label: `Kattints a „${btn}” gombra` },
    { n: "3", label: "Írd be a cikkszámot, kosár, rendelés" },
  ];

  const rows = steps
    .map(
      (s, i) => `<tr>
        <td style="padding:9px 14px;color:#666666;width:28px;font-weight:600;${i < steps.length - 1 ? "border-bottom:1px solid #F0F0F0;" : ""}">${s.n}.</td>
        <td style="padding:9px 14px;color:#111111;${i < steps.length - 1 ? "border-bottom:1px solid #F0F0F0;" : ""}">${s.label}</td>
      </tr>`,
    )
    .join("");

  return `<tr>
    <td style="padding:20px 24px 0;">
      <p style="margin:0 0 10px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#999999;">Három lépés</p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #F0F0F0;border-radius:8px;overflow:hidden;font-size:13px;">
        ${rows}
      </table>
    </td>
  </tr>`;
}

function renderMockup(buttonLabel: string): string {
  const btn = escapeHtml(buttonLabel || "Gyors rendelés");

  return `<tr>
    <td style="padding:20px 24px 0;">
      <p style="margin:0 0 10px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#999999;">Így néz ki</p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #F0F0F0;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="padding:12px 14px;background-color:#FAFAFA;border-bottom:1px solid #F0F0F0;">
            <p style="margin:0;padding:8px 10px;font-size:12px;color:#999999;background-color:#FFFFFF;border:1px solid #E5E5E5;border-radius:6px;">Cikkszám…</p>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-size:12px;color:#111111;border-bottom:1px solid #F0F0F0;">
            <span style="color:#666666;">ABC-123</span> · Példa termék · <strong>1 db</strong>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 14px;">
            <span style="display:inline-block;padding:6px 12px;font-size:11px;font-weight:600;color:#FFFFFF;background-color:${CTA_COLOR};border-radius:4px;">Kosárba</span>
            <span style="margin-left:10px;font-size:11px;color:#999999;">A „${btn}” gomb a boltban jelenik meg.</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function renderCta(loginUrl: string, buttonLabel: string): string {
  if (!loginUrl) return "";
  const href = escapeHtml(loginUrl);
  const btn = escapeHtml(buttonLabel || "Gyors rendelés");
  return `<tr>
    <td style="padding:20px 24px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="border-radius:8px;background-color:${CTA_COLOR};">
            <a href="${href}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;">Kipróbálom a ${btn} funkciót</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function renderSignature(
  shopName: string,
  signature: MarketingSignature,
): string {
  const shop = escapeHtml(shopName);
  const sigLines: string[] = [];
  if (signature.name.trim()) {
    sigLines.push(escapeHtml(signature.name.trim()));
  }
  if (signature.title.trim()) {
    sigLines.push(escapeHtml(signature.title.trim()));
  }
  const contactParts: string[] = [];
  if (signature.phone.trim()) {
    contactParts.push(escapeHtml(signature.phone.trim()));
  }
  if (signature.email.trim()) {
    contactParts.push(escapeHtml(signature.email.trim()));
  }
  if (contactParts.length) sigLines.push(contactParts.join(" · "));
  if (signature.extra.trim()) {
    sigLines.push(escapeHtml(signature.extra.trim()));
  }

  const body =
    sigLines.length > 0
      ? sigLines.join("<br />")
      : `Üdvözlettel,<br /><strong style="font-weight:600;color:#111111;">${shop}</strong>`;

  return `<tr>
    <td style="padding:20px 24px;border-top:1px solid #F0F0F0;">
      <p style="margin:0;font-size:13px;color:#333333;line-height:1.6;">${body}</p>
    </td>
  </tr>`;
}

function buildPlainText(ctx: LaunchEmailContext, loginUrl: string): string {
  const btn = ctx.buttonLabel || "Gyors rendelés";
  const lines: string[] = [
    "Kedves Partnerünk!",
    "",
    `A ${ctx.shopName} boltban elérhető a ${btn}: cikkszámra keresve percek alatt újra rendelhetsz.`,
    "Bejelentkezés után a partneráraid automatikusan érvényesülnek.",
    "",
    "Miért használd?",
    "• Ismét rendelés percek alatt — cikkszám beírása, kosár, kész.",
    "• Kevesebb telefon, kevesebb email — ugyanott landol a rendelésed.",
    "• Partnerár automatikusan — minden tételnél a neked járó ár látszik.",
    "",
    "Három lépés:",
    `1. Jelentkezz be a boltba${loginUrl ? `: ${loginUrl}` : ""}`,
    `2. Kattints a „${btn}” gombra`,
    "3. Írd be a cikkszámot, kosár, rendelés",
    "",
  ];

  if (loginUrl) {
    lines.push(`Kipróbálás: ${loginUrl}`, "");
  }

  if (ctx.signature.name.trim()) {
    lines.push(ctx.signature.name.trim());
    if (ctx.signature.title.trim()) lines.push(ctx.signature.title.trim());
    const contact = [ctx.signature.phone, ctx.signature.email]
      .map((s) => s.trim())
      .filter(Boolean);
    if (contact.length) lines.push(contact.join(" · "));
    if (ctx.signature.extra.trim()) lines.push(ctx.signature.extra.trim());
  } else {
    lines.push("Üdvözlettel,", ctx.shopName);
  }

  return lines.join("\n");
}

export function buildLaunchPartnerEmail(
  ctx: LaunchEmailContext,
): BuiltLaunchEmail {
  const shop = escapeHtml(ctx.shopName);
  const btn = escapeHtml(ctx.buttonLabel || "Gyors rendelés");
  const loginUrl = loginUrlForShop(ctx.shopUrl);

  const subject = `Gyors rendelés — cikkszámra rendelhetsz (${ctx.shopName})`;

  const html = `<!DOCTYPE html>
<html lang="hu">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background-color:#F5F5F5;font-family:${FONT};">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F5F5F5;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background-color:#FFFFFF;border-radius:12px;border:1px solid #E5E5E5;overflow:hidden;">
          ${renderHeader({ shopName: ctx.shopName, logoUrl: ctx.logoUrl })}
          <tr>
            <td style="padding:20px 24px 0;">
              <p style="margin:0;font-size:14px;color:#111111;line-height:1.6;">Kedves <strong style="font-weight:600;">Partnerünk</strong>!</p>
              <p style="margin:6px 0 0;font-size:13px;color:#666666;line-height:1.6;">
                A <strong style="font-weight:600;color:#111111;">${shop}</strong> boltban elérhető a
                <strong style="font-weight:600;color:#111111;">${btn}</strong>: cikkszámra keresve percek alatt újra rendelhetsz.
                Bejelentkezés után a partneráraid automatikusan érvényesülnek.
              </p>
            </td>
          </tr>
          ${renderBenefits()}
          ${renderSteps(ctx.buttonLabel)}
          ${renderMockup(ctx.buttonLabel)}
          ${renderCta(loginUrl, ctx.buttonLabel)}
          ${renderSignature(ctx.shopName, ctx.signature)}
        </table>
        <p style="margin:10px auto 0;font-size:11px;color:#AAAAAA;text-align:center;max-width:560px;">Partner értesítő · ${shop}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject,
    plainText: buildPlainText(ctx, loginUrl),
    html,
  };
}
