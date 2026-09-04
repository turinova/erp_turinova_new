"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PaperSelect } from "@/components/ui/PaperSelect";
import { relativeTime } from "@/lib/format";

type GroupOpt = {
  innerId: number;
  groupId: string;
  name: string;
  isDefault: boolean;
};

type Period = "lifetime" | "rolling_12m" | "calendar_year" | "custom";

type RuleDto = {
  id: string;
  name: string;
  enabled: boolean;
  metric: "lifetime_spent" | "order_count";
  threshold: number;
  keepThreshold: number | null;
  period: Period;
  periodFrom: string | null;
  periodTo: string | null;
  fromGroupInnerIds: number[];
  toGroupInnerId: number;
  toGroupName: string | null;
  priority: number;
};

type PolicyDto = {
  allowDowngrade: boolean;
  graceDays: number;
  cooldownDays: number;
  downgradeAfterMd: string | null;
  ladder: number[];
  rewards: Record<string, { headline: string; detail: string | null }>;
  orderStatusMode: "exclude_cancelled" | "allowlist";
  orderStatusIds: string[];
};

type OrderStatusOpt = {
  id: string;
  name: string;
  color?: string;
  looksCancelled: boolean;
};

function policyFromApi(raw: Partial<PolicyDto> | null | undefined): PolicyDto {
  const mode =
    raw?.orderStatusMode === "allowlist" ? "allowlist" : "exclude_cancelled";
  const ids = Array.isArray(raw?.orderStatusIds)
    ? raw!.orderStatusIds.filter(
        (x): x is string => typeof x === "string" && x.trim().length > 0,
      )
    : [];
  return {
    allowDowngrade: Boolean(raw?.allowDowngrade),
    graceDays: Number(raw?.graceDays ?? 90),
    cooldownDays: Number(raw?.cooldownDays ?? 0),
    downgradeAfterMd: raw?.downgradeAfterMd ?? "02-01",
    ladder: Array.isArray(raw?.ladder) ? raw!.ladder : [],
    rewards:
      raw?.rewards && typeof raw.rewards === "object" && !Array.isArray(raw.rewards)
        ? raw.rewards
        : {},
    orderStatusMode: mode === "allowlist" && ids.length === 0 ? "exclude_cancelled" : mode,
    orderStatusIds: ids,
  };
}

type RecentMove = {
  id: string;
  customerInnerId: number;
  email: string | null;
  fromGroupName: string | null;
  toGroupName: string | null;
  reason: string | null;
  source?: string | null;
  metricValue?: number | null;
  createdAt: string;
};

type Hit = {
  customerInnerId: number;
  email: string;
  name: string;
  fromGroupName: string | null;
  toGroupName: string;
  ruleName: string;
  metric: string;
  value: number;
  threshold: number;
  direction?: "up" | "down";
};

function formatThreshold(metric: string, n: number) {
  if (metric === "order_count") return `${n} rendelés`;
  return `${Math.round(n).toLocaleString("hu-HU")} Ft`;
}

function periodLabel(p: Period) {
  switch (p) {
    case "rolling_12m":
      return "az elmúlt 12 hónap";
    case "calendar_year":
      return "az idei év (jan. 1-től)";
    case "custom":
      return "saját időszak";
    default:
      return "összes eddigi";
  }
}

/** Worst → best: default group first, then the rest. */
function defaultLadderFromGroups(gs: GroupOpt[]): number[] {
  const defs = gs.filter((g) => g.isDefault).map((g) => g.innerId);
  const rest = gs.filter((g) => !g.isDefault).map((g) => g.innerId);
  const ids = [...defs, ...rest];
  if (ids.length > 0) return ids;
  return gs.map((g) => g.innerId);
}

/**
 * Drop deleted group ids, append new ones.
 * If nothing from the saved ladder still exists → full rebuild.
 */
function reconcileLadder(
  ladder: number[],
  gs: GroupOpt[],
): { next: number[]; orphanCount: number; addedCount: number } {
  if (gs.length === 0) {
    return { next: [], orphanCount: ladder.length, addedCount: 0 };
  }
  const live = new Set(gs.map((g) => g.innerId));
  if (ladder.length === 0) {
    return {
      next: defaultLadderFromGroups(gs),
      orphanCount: 0,
      addedCount: gs.length,
    };
  }
  const kept = ladder.filter((id) => live.has(id));
  const orphanCount = ladder.length - kept.length;
  if (kept.length === 0) {
    return {
      next: defaultLadderFromGroups(gs),
      orphanCount,
      addedCount: gs.length,
    };
  }
  const keptSet = new Set(kept);
  const added = gs.map((g) => g.innerId).filter((id) => !keptSet.has(id));
  return {
    next: [...kept, ...added],
    orphanCount,
    addedCount: added.length,
  };
}

function pruneRewards(
  rewards: PolicyDto["rewards"],
  liveInnerIds: number[],
): PolicyDto["rewards"] {
  const live = new Set(liveInnerIds.map(String));
  const out: PolicyDto["rewards"] = {};
  for (const [k, v] of Object.entries(rewards || {})) {
    if (live.has(k) && v?.headline) out[k] = v;
  }
  return out;
}

function ruleSentence(r: RuleDto, groups: GroupOpt[]) {
  const to =
    groups.find((g) => g.innerId === r.toGroupInnerId)?.name ||
    r.toGroupName ||
    "cél csoport";
  const from =
    r.fromGroupInnerIds.length === 0
      ? "bármely csoportból"
      : r.fromGroupInnerIds
          .map(
            (id) =>
              groups.find((g) => g.innerId === id)?.name || `#${id}`,
          )
          .join(" / ");
  const when =
    r.metric === "order_count"
      ? `legalább ${r.threshold} rendelése van`
      : `legalább ${Math.round(r.threshold).toLocaleString("hu-HU")} Ft-ot költött`;
  return `Ha ${when} (${periodLabel(r.period)}, ${from}) → ${to}`;
}

export function LevelUpView() {
  const [groups, setGroups] = useState<GroupOpt[]>([]);
  const [rules, setRules] = useState<RuleDto[]>([]);
  const [recent, setRecent] = useState<RecentMove[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [autoLastRunAt, setAutoLastRunAt] = useState<string | null>(null);

  const [policy, setPolicy] = useState<PolicyDto>({
    allowDowngrade: false,
    graceDays: 90,
    cooldownDays: 0,
    downgradeAfterMd: "02-01",
    ladder: [],
    rewards: {},
    orderStatusMode: "exclude_cancelled",
    orderStatusIds: [],
  });
  const [policySaving, setPolicySaving] = useState(false);
  const [orderStatuses, setOrderStatuses] = useState<OrderStatusOpt[]>([]);
  const [orderStatusesLoading, setOrderStatusesLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("Automatizmus");
  const [metric, setMetric] = useState<"lifetime_spent" | "order_count">(
    "lifetime_spent",
  );
  const [period, setPeriod] = useState<Period>("lifetime");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [threshold, setThreshold] = useState("500000");
  const [keepThreshold, setKeepThreshold] = useState("");
  const [fromId, setFromId] = useState<string>("");
  const [toId, setToId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [hits, setHits] = useState<Hit[] | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/merchant/group-rules");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Betöltés sikertelen");
      setRules(json.rules || []);
      setGroups(json.groups || []);
      setRecent(json.recentMoves || []);
      setAutoLastRunAt(json.autoLastRunAt ?? null);
      const gs = (json.groups || []) as GroupOpt[];
      const rawLadder = Array.isArray(json.policy?.ladder)
        ? (json.policy.ladder as number[])
        : [];
      const rawRewards =
        json.policy?.rewards &&
        typeof json.policy.rewards === "object" &&
        !Array.isArray(json.policy.rewards)
          ? (json.policy.rewards as PolicyDto["rewards"])
          : {};
      const reconciled = reconcileLadder(rawLadder, gs);
      const nextRewards = pruneRewards(rawRewards, reconciled.next);
      const nextPolicy = policyFromApi({
        ...json.policy,
        ladder: reconciled.next,
        rewards: nextRewards,
      });
      setPolicy(nextPolicy);

      const ladderChanged =
        rawLadder.length !== reconciled.next.length ||
        rawLadder.some((id, i) => id !== reconciled.next[i]);
      if (
        json.policy &&
        gs.length > 0 &&
        (reconciled.orphanCount > 0 || ladderChanged)
      ) {
        /* Persist healed ladder so #ghost ids don't come back */
        void (async () => {
          try {
            const res = await fetch("/api/merchant/group-rules", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                policy: {
                  ...nextPolicy,
                  ladder: reconciled.next,
                  rewards: nextRewards,
                },
              }),
            });
            const saved = await res.json();
            if (res.ok && saved.policy) {
              setPolicy(
                policyFromApi({
                  ...saved.policy,
                  ladder: Array.isArray(saved.policy.ladder)
                    ? saved.policy.ladder
                    : reconciled.next,
                  rewards:
                    saved.policy.rewards &&
                    typeof saved.policy.rewards === "object"
                      ? saved.policy.rewards
                      : nextRewards,
                }),
              );
              if (reconciled.orphanCount > 0) {
                setMessage(
                  `Létra frissítve: ${reconciled.orphanCount} törölt csoport ID eltávolítva` +
                    (reconciled.addedCount
                      ? `, ${reconciled.addedCount} új felvéve`
                      : "") +
                    ".",
                );
              }
            }
          } catch {
            /* keep local healed view */
          }
        })();
      }

      setOrderStatusesLoading(true);
      void (async () => {
        try {
          const sr = await fetch("/api/merchant/order-statuses");
          const sj = await sr.json();
          if (sr.ok && Array.isArray(sj.statuses)) {
            setOrderStatuses(sj.statuses as OrderStatusOpt[]);
          }
        } catch {
          /* optional */
        } finally {
          setOrderStatusesLoading(false);
        }
      })();

      setToId((prev) => {
        if (prev && gs.some((g) => String(g.innerId) === prev)) return prev;
        const partner = gs.find((g) => !g.isDefault);
        return partner ? String(partner.innerId) : "";
      });
      setFromId((prev) => {
        if (prev && gs.some((g) => String(g.innerId) === prev)) return prev;
        const def = gs.find((g) => g.isDefault);
        return def ? String(def.innerId) : "";
      });
      if ((json.rules || []).length === 0) setShowForm(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hiba");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePolicy(next: Partial<PolicyDto>) {
    setPolicySaving(true);
    setError(null);
    setMessage(null);
    const merged = { ...policy, ...next };
    try {
      const res = await fetch("/api/merchant/group-rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policy: merged }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Mentés sikertelen");
      if (json.policy) setPolicy(policyFromApi(json.policy));
      else setPolicy(merged);
      setMessage(json.message || "Beállítások mentve.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mentés sikertelen");
    } finally {
      setPolicySaving(false);
    }
  }

  async function createRule() {
    if (!toId) {
      setError("Válaszd ki, melyik csoportba kerüljenek.");
      return;
    }
    const th = Number(threshold.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(th) || th < 0) {
      setError("Érvénytelen belépési küszöb.");
      return;
    }
    let keep: number | null = null;
    if (keepThreshold.trim()) {
      const k = Number(keepThreshold.replace(/\s/g, "").replace(",", "."));
      if (!Number.isFinite(k) || k < 0) {
        setError("Érvénytelen megtartó küszöb.");
        return;
      }
      keep = k;
    }
    if (period === "custom" && !periodFrom) {
      setError("Saját időszaknál add meg a kezdő napot.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/merchant/group-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Automatizmus",
          metric,
          threshold: th,
          keepThreshold: keep,
          period,
          periodFrom: period === "custom" ? periodFrom || null : null,
          periodTo: period === "custom" ? periodTo || null : null,
          fromGroupInnerIds: fromId ? [Number(fromId)] : [],
          toGroupInnerId: Number(toId),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Mentés sikertelen");
      setMessage(json.message || "Mentve.");
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mentés sikertelen");
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(r: RuleDto) {
    setError(null);
    try {
      const res = await fetch(`/api/merchant/group-rules/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !r.enabled }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Frissítés sikertelen");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hiba");
    }
  }

  async function removeRule(r: RuleDto) {
    if (!window.confirm(`Törlöd: „${r.name}”?`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/merchant/group-rules/${r.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Törlés sikertelen");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hiba");
    }
  }

  async function run(dryRun: boolean) {
    setRunning(true);
    setError(null);
    setMessage(null);
    setHits(null);
    try {
      const res = await fetch("/api/merchant/group-rules/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Futtatás sikertelen");
      setHits(json.hits || []);
      setMessage(
        `${json.message} (átnézve: ${json.scanned ?? 0} vevő${
          json.sourceLabel ? `, forrás: ${json.sourceLabel}` : ""
        }${json.errors?.length ? `, hibák: ${json.errors.length}` : ""})`,
      );
      if (!dryRun) await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Futtatás sikertelen");
    } finally {
      setRunning(false);
    }
  }

  function moveLadder(innerId: number, dir: -1 | 1) {
    const cur =
      policy.ladder.length > 0
        ? [...policy.ladder]
        : groups.map((g) => g.innerId);
    const i = cur.indexOf(innerId);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= cur.length) return;
    const next = [...cur];
    const tmp = next[i]!;
    next[i] = next[j]!;
    next[j] = tmp;
    void savePolicy({ ladder: next });
  }

  function refreshLadderFromGroups() {
    if (!groups.length) {
      setError("Nincs megjeleníthető vevőcsoport a boltból.");
      return;
    }
    const next = defaultLadderFromGroups(groups);
    const nextRewards = pruneRewards(policy.rewards, next);
    void savePolicy({ ladder: next, rewards: nextRewards });
    setMessage(
      "Létra újraépítve a betöltött csoportokból (alap → többi). Állítsd a sorrendet ↑↓-vel.",
    );
  }

  const ladderIds =
    policy.ladder.length > 0
      ? policy.ladder
      : groups.map((g) => g.innerId);
  const ladderHasOrphans = ladderIds.some(
    (id) => !groups.some((g) => g.innerId === id),
  );

  if (loading && rules.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px] text-faint">
        Betöltés…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6">
      {/* Row 0 — header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[20px] font-semibold tracking-tight text-text">
            Automatizmus
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-snug text-faint">
            Ha a vevő eleget rendel, jobb csoportba kerül. Az{" "}
            <Link href="/arak" className="font-semibold underline">
              Árak
            </Link>{" "}
            szerinti kedvezménnyel.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={running || rules.length === 0}
            onClick={() => {
              if (
                window.confirm(
                  "Futtatod most? Aki eléri a küszöböt, átkerül a cél csoportba a boltban is.",
                )
              ) {
                void run(false);
              }
            }}
            className="h-9 cursor-pointer bg-accent px-3 text-[12px] font-semibold text-white disabled:opacity-40"
          >
            {running ? "…" : "Futtatás most"}
          </button>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="h-9 cursor-pointer border-[1.5px] border-line-strong px-3 text-[12px] font-semibold"
          >
            {showForm ? "Form elrejtése" : "Új szabály"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-[12px] font-medium text-danger">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-3 text-[12px] font-medium text-ok">{message}</p>
      ) : null}

      {/* Row 1 — rules */}
      <section className="mt-5">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-semibold tracking-tight text-text">
            Szabályok
          </h2>
          <p className="text-[12px] text-faint">
            {rules.length} · küszöb → csoportváltás
          </p>
        </div>

        {rules.length === 0 && !showForm ? (
          <div className="border-[1.5px] border-line-strong bg-surface px-4 py-6 text-center">
            <p className="text-[13px] text-faint">Még nincs szabály.</p>
            <button
              type="button"
              className="mt-2 cursor-pointer text-[13px] font-semibold underline"
              onClick={() => setShowForm(true)}
            >
              Add hozzá az elsőt
            </button>
          </div>
        ) : null}

        {rules.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rules.map((r) => (
              <li
                key={r.id}
                className="flex flex-col border-[1.5px] border-line-strong bg-surface p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-[13px] font-semibold text-text">
                    {r.name}
                  </p>
                  <span
                    className={
                      r.enabled
                        ? "shrink-0 border border-line-strong bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent-ink"
                        : "shrink-0 border border-line px-1.5 py-0.5 text-[10px] font-semibold text-faint"
                    }
                  >
                    {r.enabled ? "Be" : "Ki"}
                  </span>
                </div>
                <p className="mt-1.5 flex-1 text-[12px] leading-snug text-faint">
                  {ruleSentence(r, groups)}
                </p>
                <p className="mt-1 text-[11px] text-faint">
                  Belépés: {formatThreshold(r.metric, r.threshold)}
                  {r.keepThreshold != null
                    ? ` · Bent: ${formatThreshold(r.metric, r.keepThreshold)}`
                    : ""}
                </p>
                <div className="mt-3 flex gap-3 border-t border-line pt-2">
                  <button
                    type="button"
                    onClick={() => void toggleRule(r)}
                    className="cursor-pointer text-[12px] font-semibold underline"
                  >
                    {r.enabled ? "Kikapcsol" : "Bekapcsol"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeRule(r)}
                    className="cursor-pointer text-[12px] font-semibold text-danger"
                  >
                    Törlés
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* Form — full width under rules */}
      {showForm ? (
        <section className="mt-4 border-[1.5px] border-line-strong bg-surface p-4">
          <h2 className="text-[13px] font-semibold">Új szabály</h2>
          <p className="mt-0.5 text-[12px] text-faint">
            Ha eléri a küszöböt → átrakás.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-[12px]">
              <span className="font-semibold text-faint">Név</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 h-9 w-full border-[1.5px] border-line-strong bg-surface px-2.5 text-[13px] outline-none focus:border-accent"
              />
            </label>
            <label className="block text-[12px]">
              <span className="font-semibold text-faint">Mit nézünk?</span>
              <div className="mt-1">
                <PaperSelect
                  value={metric}
                  onChange={(v) =>
                    setMetric(v as "lifetime_spent" | "order_count")
                  }
                  options={[
                    { value: "lifetime_spent", label: "Költés (Ft)" },
                    { value: "order_count", label: "Rendelések száma" },
                  ]}
                  allowEmpty={false}
                  ariaLabel="Metrika"
                  size="md"
                  className="w-full"
                />
              </div>
            </label>
            <label className="block text-[12px]">
              <span className="font-semibold text-faint">Melyik időszak?</span>
              <div className="mt-1">
                <PaperSelect
                  value={period}
                  onChange={(v) => setPeriod(v as Period)}
                  options={[
                    { value: "lifetime", label: "Összes eddigi" },
                    { value: "rolling_12m", label: "Az elmúlt 12 hónap" },
                    {
                      value: "calendar_year",
                      label: "Csak az idei év (január 1-től)",
                    },
                    { value: "custom", label: "Saját időszak…" },
                  ]}
                  allowEmpty={false}
                  ariaLabel="Időszak"
                  size="md"
                  className="w-full"
                />
              </div>
            </label>
            {period === "custom" ? (
              <>
                <label className="block text-[12px]">
                  <span className="font-semibold text-faint">Ettől a naptól</span>
                  <input
                    type="date"
                    value={periodFrom}
                    onChange={(e) => setPeriodFrom(e.target.value)}
                    className="mt-1 h-9 w-full border-[1.5px] border-line-strong bg-surface px-2.5 text-[13px] outline-none focus:border-accent"
                  />
                </label>
                <label className="block text-[12px]">
                  <span className="font-semibold text-faint">Eddig a napig</span>
                  <input
                    type="date"
                    value={periodTo}
                    onChange={(e) => setPeriodTo(e.target.value)}
                    className="mt-1 h-9 w-full border-[1.5px] border-line-strong bg-surface px-2.5 text-[13px] outline-none focus:border-accent"
                  />
                </label>
              </>
            ) : null}
            <label className="block text-[12px]">
              <span className="font-semibold text-faint">
                Belépéshez ennyi kell{" "}
                {metric === "order_count" ? "(db)" : "(Ft)"}
              </span>
              <input
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                inputMode="numeric"
                className="mt-1 h-9 w-full border-[1.5px] border-line-strong bg-surface px-2.5 text-[13px] tabular-nums outline-none focus:border-accent"
              />
            </label>
            <label className="block text-[12px]">
              <span className="font-semibold text-faint">
                Bent maradáshoz ennyi elég
              </span>
              <input
                value={keepThreshold}
                onChange={(e) => setKeepThreshold(e.target.value)}
                placeholder="Üres = ugyanaz"
                inputMode="numeric"
                className="mt-1 h-9 w-full border-[1.5px] border-line-strong bg-surface px-2.5 text-[13px] tabular-nums outline-none focus:border-accent"
              />
            </label>
            <label className="block text-[12px]">
              <span className="font-semibold text-faint">Honnan</span>
              <div className="mt-1">
                <PaperSelect
                  value={fromId}
                  onChange={setFromId}
                  options={groups.map((g) => ({
                    value: String(g.innerId),
                    label: g.isDefault ? `${g.name} (alap)` : g.name,
                  }))}
                  emptyLabel="Bármely csoport"
                  allowEmpty
                  ariaLabel="Forrás csoport"
                  size="md"
                  denseFrom={8}
                  className="w-full"
                />
              </div>
            </label>
            <label className="block text-[12px]">
              <span className="font-semibold text-faint">Hova</span>
              <div className="mt-1">
                <PaperSelect
                  value={toId}
                  onChange={setToId}
                  options={groups
                    .filter((g) => !g.isDefault)
                    .map((g) => ({
                      value: String(g.innerId),
                      label: g.name,
                    }))}
                  emptyLabel="Cél csoport…"
                  allowEmpty
                  ariaLabel="Cél csoport"
                  size="md"
                  denseFrom={8}
                  className="w-full"
                />
              </div>
            </label>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void createRule()}
            className="mt-4 inline-flex h-9 cursor-pointer items-center bg-accent px-4 text-[13px] font-semibold text-white disabled:opacity-40"
          >
            {saving ? "…" : "Szabály mentése"}
          </button>
        </section>
      ) : null}

      {hits && hits.length > 0 ? (
        <section className="mt-4 border-[1.5px] border-line-strong bg-surface p-4">
          <h2 className="text-[13px] font-semibold">Találatok</h2>
          <ul className="mt-2 columns-1 gap-x-6 space-y-1 text-[12px] sm:columns-2">
            {hits.map((h) => (
              <li
                key={`${h.customerInnerId}-${h.ruleName}-${h.direction}`}
                className="break-inside-avoid"
              >
                <Link
                  href={`/vevok/${h.customerInnerId}`}
                  className="font-semibold underline"
                >
                  {h.name}
                </Link>
                <span className="text-faint">
                  {" "}
                  · {h.direction === "down" ? "lejjebb" : "feljebb"} ·{" "}
                  {h.fromGroupName || "—"} → {h.toGroupName}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Beállítások — elkülönítve a szabályoktól */}
      <div className="mt-8 border-t-[1.5px] border-line-strong pt-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-semibold tracking-tight text-text">
            Beállítások
          </h2>
          <p className="text-[12px] text-faint">
            Futás, irány, státusz. A szabályoktól függetlenül.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <section className="border-[1.5px] border-line-strong bg-surface-2/60 p-4">
          <h3 className="text-[13px] font-semibold">Mikor fut?</h3>
          <p className="mt-2 text-[13px] leading-snug text-text">
            Minden nap éjfélkor (Budapest), ha van bekapcsolt szabály.
          </p>
          <p className="mt-2 text-[12px] text-faint">
            Azonnal is ellenőrizheted:{" "}
            <span className="font-medium text-text">Futtatás most</span>.
          </p>
          <p className="mt-3 text-[11px] text-faint">
            {autoLastRunAt
              ? `Utoljára futott: ${relativeTime(autoLastRunAt)}`
              : "Még nem futott."}
          </p>
        </section>

        <section className="border-[1.5px] border-line-strong bg-surface-2/60 p-4">
          <h3 className="text-[13px] font-semibold">Mit csinálhat?</h3>
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-[13px]">
            <input
              type="radio"
              className="mt-1"
              checked={!policy.allowDowngrade}
              disabled={policySaving}
              onChange={() => void savePolicy({ allowDowngrade: false })}
            />
            <span>
              <span className="font-semibold">Csak felfelé</span>
              <span className="mt-0.5 block text-[11px] text-faint">
                Ajánlott. Nem vesz el kedvezményt.
              </span>
            </span>
          </label>
          <label className="mt-2 flex cursor-pointer items-start gap-2 text-[13px]">
            <input
              type="radio"
              className="mt-1"
              checked={policy.allowDowngrade}
              disabled={policySaving}
              onChange={() => {
                if (
                  window.confirm(
                    "Biztos? Így lejjebb is rakhatja a vevőket. Év elején a türelmi idő véd.",
                  )
                ) {
                  void savePolicy({ allowDowngrade: true });
                }
              }}
            />
            <span>
              <span className="font-semibold">Feljebb és lejjebb is</span>
              <span className="mt-0.5 block text-[11px] text-faint">
                Csak ha tudatosan akarod.
              </span>
            </span>
          </label>
          {policy.allowDowngrade ? (
            <div className="mt-3 space-y-2 border-t border-line pt-3">
              <label className="block text-[12px]">
                <span className="font-semibold text-faint">
                  Türelmi idő (nap)
                </span>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={policy.graceDays}
                  disabled={policySaving}
                  onChange={(e) =>
                    setPolicy((p) => ({
                      ...p,
                      graceDays: Number(e.target.value) || 0,
                    }))
                  }
                  onBlur={() =>
                    void savePolicy({ graceDays: policy.graceDays })
                  }
                  className="mt-1 h-8 w-full border border-line-strong px-2 text-[13px] outline-none focus:border-accent"
                />
              </label>
              <label className="block text-[12px]">
                <span className="font-semibold text-faint">
                  Várakozás újabb váltás előtt (nap)
                </span>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={policy.cooldownDays}
                  disabled={policySaving}
                  onChange={(e) =>
                    setPolicy((p) => ({
                      ...p,
                      cooldownDays: Number(e.target.value) || 0,
                    }))
                  }
                  onBlur={() =>
                    void savePolicy({ cooldownDays: policy.cooldownDays })
                  }
                  className="mt-1 h-8 w-full border border-line-strong px-2 text-[13px] outline-none focus:border-accent"
                />
              </label>
              <label className="block text-[12px]">
                <span className="font-semibold text-faint">
                  Évforduló (HH-NN)
                </span>
                <input
                  value={policy.downgradeAfterMd ?? "02-01"}
                  disabled={policySaving}
                  onChange={(e) =>
                    setPolicy((p) => ({
                      ...p,
                      downgradeAfterMd: e.target.value,
                    }))
                  }
                  onBlur={() =>
                    void savePolicy({
                      downgradeAfterMd: policy.downgradeAfterMd,
                    })
                  }
                  className="mt-1 h-8 w-full border border-line-strong px-2 text-[13px] outline-none focus:border-accent"
                />
              </label>
            </div>
          ) : null}
        </section>

        <section className="border-[1.5px] border-line-strong bg-surface-2/60 p-4 md:col-span-2 lg:col-span-1">
          <h3 className="text-[13px] font-semibold">Melyik rendelés számít?</h3>
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-[13px]">
            <input
              type="radio"
              className="mt-1"
              checked={policy.orderStatusMode === "exclude_cancelled"}
              disabled={policySaving}
              onChange={() =>
                void savePolicy({
                  orderStatusMode: "exclude_cancelled",
                  orderStatusIds: [],
                })
              }
            />
            <span>
              <span className="font-semibold">Ajánlott</span>
              <span className="mt-0.5 block text-[11px] text-faint">
                Minden, kivéve sztornó / törölt / visszatérített.
              </span>
            </span>
          </label>
          <label className="mt-2 flex cursor-pointer items-start gap-2 text-[13px]">
            <input
              type="radio"
              className="mt-1"
              checked={policy.orderStatusMode === "allowlist"}
              disabled={policySaving || orderStatuses.length === 0}
              onChange={() => {
                const defaults = orderStatuses
                  .filter((s) => !s.looksCancelled)
                  .map((s) => s.id);
                void savePolicy({
                  orderStatusMode: "allowlist",
                  orderStatusIds:
                    defaults.length > 0
                      ? defaults
                      : orderStatuses.map((s) => s.id),
                });
              }}
            />
            <span>
              <span className="font-semibold">Csak a kijelöltek</span>
              <span className="mt-0.5 block text-[11px] text-faint">
                Pl. csak „Teljesítve” és hasonló státuszok.
              </span>
            </span>
          </label>

          {orderStatusesLoading ? (
            <p className="mt-3 text-[11px] text-faint">Státuszok betöltése…</p>
          ) : null}

          {policy.orderStatusMode === "allowlist" &&
          orderStatuses.length > 0 ? (
            <ul className="mt-3 max-h-40 space-y-1.5 overflow-y-auto border-t border-line pt-3">
              {orderStatuses.map((st) => {
                const checked = policy.orderStatusIds.includes(st.id);
                return (
                  <li key={st.id}>
                    <label className="flex cursor-pointer items-center gap-2 text-[12px]">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={policySaving}
                        onChange={() => {
                          const next = checked
                            ? policy.orderStatusIds.filter((x) => x !== st.id)
                            : [...policy.orderStatusIds, st.id];
                          if (next.length === 0) {
                            void savePolicy({
                              orderStatusMode: "exclude_cancelled",
                              orderStatusIds: [],
                            });
                            return;
                          }
                          void savePolicy({
                            orderStatusMode: "allowlist",
                            orderStatusIds: next,
                          });
                        }}
                      />
                      {st.color ? (
                        <span
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm border border-line"
                          style={{ backgroundColor: st.color }}
                          aria-hidden
                        />
                      ) : null}
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {st.name}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {!orderStatusesLoading &&
          orderStatuses.length === 0 &&
          policy.orderStatusMode === "allowlist" ? (
            <p className="mt-3 text-[11px] text-amber-900">
              Nem sikerült státuszokat betölteni. Marad az ajánlott szűrés.
            </p>
          ) : null}
        </section>
        </div>

        {/* Létra + napló */}
        <div className="mt-3 grid gap-3 lg:grid-cols-12">
        <section className="border-[1.5px] border-line-strong bg-surface-2/60 p-4 lg:col-span-8">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-[13px] font-semibold">Csoportok sorrendje</h3>
              <p className="mt-0.5 text-[11px] text-faint">
                Felül a legjobb. Szintenkénti szöveg a widget FOMO sávon jelenik
                meg.
              </p>
            </div>
            {ladderHasOrphans ? (
              <button
                type="button"
                disabled={policySaving || groups.length === 0}
                onClick={() => refreshLadderFromGroups()}
                className="h-8 shrink-0 cursor-pointer border border-line-strong px-2 text-[11px] font-semibold disabled:opacity-40"
                title="Eltávolítja a törölt csoportokat, és újraépíti a sorrendet"
              >
                Létra újraépítése
              </button>
            ) : null}
          </div>
          {ladderHasOrphans ? (
            <p className="mt-2 border border-amber-700/30 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-950">
              Van olyan ID a létrán, ami már nincs a csoportlistában. Építsd újra
              a létrát, vagy kösd újra a boltot a Beállításokban.
            </p>
          ) : null}
          <ul className="mt-3 space-y-2">
            {[...ladderIds].reverse().map((id, revIdx) => {
              const g = groups.find((x) => x.innerId === id);
              const realIdx = ladderIds.length - 1 - revIdx;
              const isBase = realIdx === 0;
              const reward = policy.rewards[String(id)] || {
                headline: "",
                detail: null,
              };
              return (
                <li
                  key={id}
                  className="border border-line px-2 py-2 text-[12px]"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="min-w-0 truncate font-semibold">
                      <span className="text-faint">
                        {ladderIds.length - revIdx}.
                      </span>{" "}
                      {g?.name || (
                        <span className="text-faint">Törölt #{id}</span>
                      )}
                    </span>
                    <span className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        disabled={
                          policySaving || realIdx >= ladderIds.length - 1
                        }
                        onClick={() => moveLadder(id, 1)}
                        className="cursor-pointer text-[11px] font-semibold underline disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={policySaving || realIdx <= 0}
                        onClick={() => moveLadder(id, -1)}
                        className="cursor-pointer text-[11px] font-semibold underline disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </span>
                  </div>
                  {!isBase && g ? (
                    <div className="mt-2 space-y-1.5">
                      <label className="block text-[10px] font-semibold uppercase tracking-wide text-faint">
                        Mit kap ezen a szinten?
                      </label>
                      <input
                        type="text"
                        defaultValue={reward.headline}
                        key={`h-${id}-${reward.headline}`}
                        placeholder="pl. −12% nettó"
                        maxLength={80}
                        disabled={policySaving}
                        className="h-8 w-full border border-line bg-bg px-2 text-[12px] outline-none focus:border-line-strong"
                        onBlur={(e) => {
                          const headline = e.target.value.trim();
                          const nextRewards = { ...policy.rewards };
                          const prev = nextRewards[String(id)];
                          if (!headline) {
                            delete nextRewards[String(id)];
                          } else {
                            nextRewards[String(id)] = {
                              headline,
                              detail: prev?.detail ?? null,
                            };
                          }
                          void savePolicy({ rewards: nextRewards });
                        }}
                      />
                      <input
                        type="text"
                        defaultValue={reward.detail ?? ""}
                        key={`d-${id}-${reward.detail ?? ""}`}
                        placeholder="Részletek (opcionális)"
                        maxLength={160}
                        disabled={policySaving}
                        className="h-8 w-full border border-line bg-bg px-2 text-[12px] outline-none focus:border-line-strong"
                        onBlur={(e) => {
                          const detail = e.target.value.trim() || null;
                          const nextRewards = { ...policy.rewards };
                          const prev = nextRewards[String(id)];
                          if (!prev?.headline && !detail) {
                            delete nextRewards[String(id)];
                          } else if (prev?.headline) {
                            nextRewards[String(id)] = {
                              headline: prev.headline,
                              detail,
                            };
                          } else if (detail) {
                            nextRewards[String(id)] = {
                              headline: "",
                              detail,
                            };
                          }
                          void savePolicy({ rewards: nextRewards });
                        }}
                      />
                    </div>
                  ) : !isBase && !g ? (
                    <p className="mt-1 text-[11px] text-faint">
                      Ez az ID már nincs a boltban. Frissítsd a létrát.
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-faint">
                      Kezdő szint. Nincs unlock szöveg.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="border-[1.5px] border-line-strong bg-surface-2/60 p-4 lg:col-span-4">
          <h3 className="text-[13px] font-semibold">Átrakások naplója</h3>
          <p className="mt-0.5 text-[11px] text-faint">
            Ki került át, mikor, és miért.
          </p>
          {recent.length === 0 ? (
            <p className="mt-2 text-[12px] text-faint">Még nem volt.</p>
          ) : (
            <ul className="mt-2 max-h-[28rem] space-y-2 overflow-y-auto text-[12px]">
              {recent.map((m) => (
                <li
                  key={m.id}
                  className="border-b border-line pb-1.5 last:border-0"
                >
                  <Link
                    href={`/vevok/${m.customerInnerId}`}
                    className="font-semibold underline"
                  >
                    {m.email || `#${m.customerInnerId}`}
                  </Link>
                  <span className="text-faint">
                    {" "}
                    · {m.fromGroupName || "—"} → {m.toGroupName || "—"}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-faint">
                    {relativeTime(m.createdAt)}
                    {m.source === "rule"
                      ? " · automata"
                      : m.source === "manual"
                        ? " · kézi"
                        : ""}
                    {m.metricValue != null
                      ? ` · ${Math.round(m.metricValue).toLocaleString("hu-HU")}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        </div>
      </div>
    </div>
  );
}
