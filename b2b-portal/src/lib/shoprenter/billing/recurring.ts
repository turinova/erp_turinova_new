/**
 * Shoprenter App Store Payment API — recurring charges.
 * Docs: https://doc.shoprenter.hu/paymentapi/docs/i_recurring_charge.html
 */

import {
  getAccessToken,
  getAuthMode,
  type ShoprenterConfig,
} from "@/lib/shoprenter/api";
import { fetchWithTimeout } from "@/lib/shoprenter/http";

export type RecurringChargeStatus =
  | "pending"
  | "active"
  | "frozen"
  | "canceled"
  | "declined"
  | string;

export type CreateRecurringChargeInput = {
  planId: string | number;
  trialDays?: number;
  test?: boolean;
  notificationUrl: string;
  successUrl: string;
  failedUrl: string;
};

export type RecurringCharge = {
  id: number | string;
  planId: number | string;
  status: RecurringChargeStatus;
  trialDays?: number;
  netPrice?: number;
  confirmationUrl?: string;
  test?: boolean;
};

function api2BaseUrl(shopName: string): string {
  return `https://${shopName}.api2.myshoprenter.hu/api`;
}

async function authHeaders(config: ShoprenterConfig): Promise<HeadersInit> {
  if (getAuthMode(config) === "oauth") {
    const token = await getAccessToken(config);
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }
  if (!config.username || !config.password) {
    throw new Error("Basic auth username/password missing");
  }
  const token = Buffer.from(
    `${config.username}:${config.password}`,
    "utf8",
  ).toString("base64");
  return {
    Authorization: `Basic ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function billingFetch(
  config: ShoprenterConfig,
  path: string,
  init: RequestInit,
): Promise<Response> {
  const url = `${api2BaseUrl(config.shopName)}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = await authHeaders(config);
  return fetchWithTimeout(
    url,
    { ...init, headers: { ...headers, ...(init.headers || {}) } },
    { pathLabel: path, timeoutMs: 20_000 },
  );
}

export async function createRecurringCharge(
  config: ShoprenterConfig,
  input: CreateRecurringChargeInput,
): Promise<{ ok: true; charge: RecurringCharge } | { ok: false; error: string }> {
  try {
    const res = await billingFetch(config, "/billing/recurringCharges", {
      method: "POST",
      body: JSON.stringify({
        planId: Number(input.planId) || input.planId,
        trialDays: input.trialDays ?? 0,
        test: Boolean(input.test),
        notificationUrl: input.notificationUrl,
        successUrl: input.successUrl,
        failedUrl: input.failedUrl,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Payment API ${res.status}: ${text.slice(0, 200) || res.statusText}`,
      };
    }
    const data = (await res.json()) as RecurringCharge;
    return { ok: true, charge: data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Payment API hiba",
    };
  }
}

export async function getRecurringCharge(
  config: ShoprenterConfig,
  chargeId: string | number,
): Promise<{ ok: true; charge: RecurringCharge } | { ok: false; error: string }> {
  try {
    const res = await billingFetch(
      config,
      `/billing/recurringCharges/${encodeURIComponent(String(chargeId))}`,
      { method: "GET" },
    );
    if (!res.ok) {
      return { ok: false, error: `GET charge ${res.status}` };
    }
    const data = (await res.json()) as RecurringCharge;
    return { ok: true, charge: data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Payment API hiba",
    };
  }
}

export async function deleteRecurringCharge(
  config: ShoprenterConfig,
  chargeId: string | number,
): Promise<{ ok: true } | { error: string }> {
  try {
    const res = await billingFetch(
      config,
      `/billing/recurringCharges/${encodeURIComponent(String(chargeId))}`,
      { method: "DELETE" },
    );
    if (!res.ok && res.status !== 204) {
      return { error: `DELETE charge ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Payment API hiba",
    };
  }
}

export function normalizeBillingStatus(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s === "cancelled") return "canceled";
  if (
    s === "pending" ||
    s === "active" ||
    s === "frozen" ||
    s === "canceled" ||
    s === "declined" ||
    s === "mailto"
  ) {
    return s;
  }
  return s;
}
