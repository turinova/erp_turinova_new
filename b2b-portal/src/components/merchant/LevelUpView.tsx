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
type Schedule = "manual" | "daily" | "on_order" | "hourly";

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
};

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

const SCHEDULE_OPTIONS: {
  value: Schedule;
  title: string;
  hint: string;
}[] = [
  {
    value: "manual",
    title: "Csak ha én indítom",
    hint: "Semmi nem fut magától. Te nyomod a Próba vagy Futtatás gombot.",
  },
  {
    value: "daily",
    title: "Naponta egyszer",
    hint: "Reggel megnézi a vevőket. Kíméletes a bolthoz.",
  },
  {
    value: "on_order",
    title: "Rendelés után (ez a vevő)",
    hint: "Ha valaki a gyors rendelésen keresztül rendel, csak őt ellenőrzi. Max. 3 percenként ugyanarra a vevőre.",
  },
  {
    value: "hourly",
    title: "Kb. óránként",
    hint: "Gyakoribb ellenőrzés, de nem folyamatos — így nem terheli le a Shoprentert.",
  },
];

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

  const [schedule, setSchedule] = useState<Schedule>("manual");
  const [autoLastRunAt, setAutoLastRunAt] = useState<string | null>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const [policy, setPolicy] = useState<PolicyDto>({
    allowDowngrade: false,
    graceDays: 90,
    cooldownDays: 0,
    downgradeAfterMd: "02-01",
    ladder: [],
  });
  const [policySaving, setPolicySaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("Szintlépés");
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
      const s = json.schedule as Schedule | undefined;
      setSchedule(
        s === "daily" || s === "on_order" || s === "hourly" || s === "manual"
          ? s
          : json.autoEnabled
            ? "daily"
            : "manual",
      );
      setAutoLastRunAt(json.autoLastRunAt ?? null);
      if (json.policy) {
        setPolicy({
          allowDowngrade: Boolean(json.policy.allowDowngrade),
          graceDays: Number(json.policy.graceDays ?? 90),
          cooldownDays: Number(json.policy.cooldownDays ?? 0),
          downgradeAfterMd: json.policy.downgradeAfterMd ?? "02-01",
          ladder: Array.isArray(json.policy.ladder) ? json.policy.ladder : [],
        });
      }
      const gs = (json.groups || []) as GroupOpt[];
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

  async function saveSchedule(next: Schedule) {
    setScheduleSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/merchant/group-rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Mentés sikertelen");
      setSchedule((json.schedule as Schedule) || next);
      setAutoLastRunAt(json.autoLastRunAt ?? null);
      setMessage(json.message || "Mentve.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mentés sikertelen");
    } finally {
      setScheduleSaving(false);
    }
  }

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
      if (json.policy) setPolicy(json.policy);
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
          name: name.trim() || "Szintlépés",
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
          json.errors?.length ? `, hibák: ${json.errors.length}` : ""
        })`,
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

  const ladderIds =
    policy.ladder.length > 0
      ? policy.ladder
      : groups.map((g) => g.innerId);

  if (loading && rules.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px] text-faint">
        Betöltés…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[20px] font-semibold tracking-tight text-text">
            Szintlépés
          </h1>
          <p className="mt-1 max-w-xl text-[13px] leading-snug text-faint">
            Ha a vevő eleget rendel, jobb csoportba kerül — és az{" "}
            <Link href="/arak" className="font-semibold underline">
              Árak
            </Link>{" "}
            szerinti kedvezményt kapja.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={running || rules.length === 0}
            onClick={() => void run(true)}
            className="h-9 cursor-pointer border-[1.5px] border-line-strong px-3 text-[12px] font-semibold disabled:opacity-40"
          >
            {running ? "…" : "Próba"}
          </button>
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
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-[12px] font-medium text-danger">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-3 text-[12px] font-medium text-ok">{message}</p>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)] lg:items-start">
        {/* —— BAL: szabályok —— */}
        <div className="min-w-0 space-y-4">
          <section>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[13px] font-semibold">Szabályok</h2>
              <button
                type="button"
                onClick={() => setShowForm((v) => !v)}
                className="h-8 cursor-pointer border-[1.5px] border-line-strong px-3 text-[12px] font-semibold"
              >
                {showForm ? "Form elrejtése" : "Új szabály"}
              </button>
            </div>

            {rules.length === 0 && !showForm ? (
              <p className="mt-3 text-[13px] text-faint">
                Még nincs szabály.{" "}
                <button
                  type="button"
                  className="font-semibold underline"
                  onClick={() => setShowForm(true)}
                >
                  Add hozzá az elsőt
                </button>
                .
              </p>
            ) : null}

            {rules.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {rules.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-start justify-between gap-2 border-[1.5px] border-line-strong bg-surface px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-text">
                        {r.name}
                        {!r.enabled ? (
                          <span className="ml-2 text-[11px] font-medium text-faint">
                            (ki)
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-[12px] text-faint">
                        {ruleSentence(r, groups)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-faint">
                        Belépés: {formatThreshold(r.metric, r.threshold)}
                        {r.keepThreshold != null
                          ? ` · Bent maradás: ${formatThreshold(r.metric, r.keepThreshold)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => void toggleRule(r)}
                        className="h-8 cursor-pointer px-2 text-[12px] font-semibold underline"
                      >
                        {r.enabled ? "Kikapcsol" : "Bekapcsol"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeRule(r)}
                        className="h-8 cursor-pointer px-2 text-[12px] font-semibold text-danger"
                      >
                        Törlés
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {showForm ? (
            <section className="border-[1.5px] border-line-strong bg-surface p-4">
              <h2 className="text-[13px] font-semibold">Új szabály</h2>
              <p className="mt-0.5 text-[12px] text-faint">
                Ha eléri a küszöböt → átrakás.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
                <label className="block text-[12px] sm:col-span-2">
                  <span className="font-semibold text-faint">
                    Melyik időszak?
                  </span>
                  <div className="mt-1">
                    <PaperSelect
                      value={period}
                      onChange={(v) => setPeriod(v as Period)}
                      options={[
                        { value: "lifetime", label: "Összes eddigi" },
                        {
                          value: "rolling_12m",
                          label: "Az elmúlt 12 hónap",
                        },
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
                      <span className="font-semibold text-faint">
                        Ettől a naptól
                      </span>
                      <input
                        type="date"
                        value={periodFrom}
                        onChange={(e) => setPeriodFrom(e.target.value)}
                        className="mt-1 h-9 w-full border-[1.5px] border-line-strong bg-surface px-2.5 text-[13px] outline-none focus:border-accent"
                      />
                    </label>
                    <label className="block text-[12px]">
                      <span className="font-semibold text-faint">
                        Eddig a napig
                      </span>
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
            <section>
              <h2 className="text-[13px] font-semibold">Találatok</h2>
              <ul className="mt-2 space-y-1 text-[12px]">
                {hits.map((h) => (
                  <li
                    key={`${h.customerInnerId}-${h.ruleName}-${h.direction}`}
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
        </div>

        {/* —— JOBB: ütemezés + policy —— */}
        <aside className="space-y-4 lg:sticky lg:top-4">
          <section className="border-[1.5px] border-line-strong bg-surface p-4">
            <h2 className="text-[13px] font-semibold">Mikor fusson?</h2>
            <p className="mt-0.5 text-[12px] text-faint">
              Válassz egyet. A boltot nem terheljük feleslegesen.
            </p>
            <div className="mt-3 space-y-2">
              {SCHEDULE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer gap-2 border px-2.5 py-2 text-[13px] ${
                    schedule === opt.value
                      ? "border-accent bg-accent/5"
                      : "border-line"
                  }`}
                >
                  <input
                    type="radio"
                    className="mt-1"
                    name="schedule"
                    checked={schedule === opt.value}
                    disabled={scheduleSaving}
                    onChange={() => void saveSchedule(opt.value)}
                  />
                  <span>
                    <span className="font-semibold">{opt.title}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-faint">
                      {opt.hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-faint">
              {autoLastRunAt
                ? `Utoljára futott: ${relativeTime(autoLastRunAt)}`
                : "Még nem futott magától."}
            </p>
          </section>

          <section className="border-[1.5px] border-line-strong bg-surface p-4">
            <h2 className="text-[13px] font-semibold">Mit csinálhat?</h2>
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
                    onChange={(e) =>
                      setPolicy((p) => ({
                        ...p,
                        graceDays: Number(e.target.value) || 0,
                      }))
                    }
                    onBlur={() =>
                      void savePolicy({ graceDays: policy.graceDays })
                    }
                    className="mt-1 h-8 w-full border-[1.5px] border-line-strong px-2 text-[13px] tabular-nums outline-none focus:border-accent"
                  />
                </label>
                <label className="block text-[12px]">
                  <span className="font-semibold text-faint">
                    Évente csak ettől (hh-nn)
                  </span>
                  <input
                    value={policy.downgradeAfterMd || ""}
                    placeholder="02-01"
                    onChange={(e) =>
                      setPolicy((p) => ({
                        ...p,
                        downgradeAfterMd: e.target.value || null,
                      }))
                    }
                    onBlur={() =>
                      void savePolicy({
                        downgradeAfterMd: policy.downgradeAfterMd,
                      })
                    }
                    className="mt-1 h-8 w-full border-[1.5px] border-line-strong px-2 text-[13px] outline-none focus:border-accent"
                  />
                </label>
                <label className="block text-[12px]">
                  <span className="font-semibold text-faint">
                    Várakozás átrakások között (nap)
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={policy.cooldownDays}
                    onChange={(e) =>
                      setPolicy((p) => ({
                        ...p,
                        cooldownDays: Number(e.target.value) || 0,
                      }))
                    }
                    onBlur={() =>
                      void savePolicy({ cooldownDays: policy.cooldownDays })
                    }
                    className="mt-1 h-8 w-full border-[1.5px] border-line-strong px-2 text-[13px] tabular-nums outline-none focus:border-accent"
                  />
                </label>
              </div>
            ) : null}
          </section>

          <section className="border-[1.5px] border-line-strong bg-surface p-4">
            <h2 className="text-[13px] font-semibold">Csoportok sorrendje</h2>
            <p className="mt-0.5 text-[11px] text-faint">
              Felül a legjobb. Ha több szabály illik, a legjobb nyer.
            </p>
            <ul className="mt-2 space-y-1">
              {[...ladderIds].reverse().map((id, revIdx) => {
                const g = groups.find((x) => x.innerId === id);
                const realIdx = ladderIds.length - 1 - revIdx;
                return (
                  <li
                    key={id}
                    className="flex items-center justify-between gap-1 border border-line px-2 py-1 text-[12px]"
                  >
                    <span className="min-w-0 truncate">
                      <span className="text-faint">
                        {ladderIds.length - revIdx}.
                      </span>{" "}
                      {g?.name || `#${id}`}
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
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="border-[1.5px] border-line-strong bg-surface p-4">
            <h2 className="text-[13px] font-semibold">Átrakások naplója</h2>
            <p className="mt-0.5 text-[11px] text-faint">
              Ki került át, mikor, és miért (szabály / kézi).
            </p>
            {recent.length === 0 ? (
              <p className="mt-2 text-[12px] text-faint">Még nem volt.</p>
            ) : (
              <ul className="mt-2 max-h-80 space-y-2 overflow-y-auto text-[12px]">
                {recent.map((m) => (
                  <li key={m.id} className="border-b border-line pb-1.5 last:border-0">
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
                        ? ` · érték: ${Math.round(m.metricValue).toLocaleString("hu-HU")}`
                        : ""}
                    </span>
                    {m.reason ? (
                      <span className="mt-0.5 block text-[11px] text-faint">
                        {m.reason}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
