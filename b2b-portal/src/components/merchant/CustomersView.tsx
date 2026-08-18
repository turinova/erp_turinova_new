"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  gateFromBilling,
  NearLimitBanner,
  UpgradeBanner,
} from "@/components/merchant/PartnerUsageBar";
import {
  isPartnerLocked,
  isPartnerPreviewLocked,
  type PartnerGateDto,
} from "@/lib/billing/types";
import { onPlan } from "@/lib/billing/plans";

type ListFilter = "newcomers" | "partners" | "all";

type GroupDto = {
  innerId: number;
  groupId: string | null;
  name: string;
  isDefault: boolean;
};

type CustomerRow = {
  id: string;
  innerId: number;
  email: string;
  name: string;
  groupInnerId: number | null;
  groupName: string | null;
  isDefaultGroup?: boolean;
  isPartner?: boolean;
};

const FILTERS: { id: ListFilter; label: string; hint: string }[] = [
  {
    id: "newcomers",
    label: "Újak",
    hint: "Alapértelmezett csoport — új regisztrálók",
  },
  {
    id: "partners",
    label: "Partnerek",
    hint: "Akiket már átraktál egy másik csoportba",
  },
  { id: "all", label: "Összes", hint: "Minden vevő ezen az oldalon" },
];

export function CustomersView() {
  const [groups, setGroups] = useState<GroupDto[]>([]);
  const [list, setList] = useState<CustomerRow[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<ListFilter>("newcomers");
  const [groupFilterId, setGroupFilterId] = useState<number | "">("");
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [targetGroupId, setTargetGroupId] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [gate, setGate] = useState<PartnerGateDto | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadGroups = useCallback(async () => {
    const res = await fetch("/api/merchant/customer-groups");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Csoportok betöltése sikertelen");
    const gs = (data.groups || []) as GroupDto[];
    setGroups(gs);
    setTargetGroupId((prev) => {
      if (prev !== "" && gs.some((g) => g.innerId === prev)) return prev;
      const nonDef = gs.filter((g) => !g.isDefault);
      if (nonDef.length === 1) return nonDef[0].innerId;
      return "";
    });
  }, []);

  const loadGate = useCallback(async () => {
    const res = await fetch("/api/merchant/billing");
    const json = await res.json();
    if (!res.ok) return;
    setGate(gateFromBilling(json));
  }, []);

  const loadCustomers = useCallback(
    async (opts: {
      query: string;
      filter: ListFilter;
      page: number;
      groupInnerId: number | "";
    }) => {
      const params = new URLSearchParams();
      if (opts.query.trim()) {
        params.set("q", opts.query.trim());
      } else {
        params.set("filter", opts.filter);
        params.set("page", String(opts.page));
        params.set("limit", "25");
        if (opts.groupInnerId !== "") {
          params.set("groupInnerId", String(opts.groupInnerId));
        }
      }
      const res = await fetch(`/api/merchant/customers?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Vevők betöltése sikertelen");
      setList(data.customers || []);
      setPageCount(Math.max(1, Number(data.pageCount) || 1));
    },
    [],
  );

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await loadGroups();
      await loadCustomers({
        query: q,
        filter,
        page,
        groupInnerId: groupFilterId,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hiba");
    } finally {
      setLoading(false);
    }
  }, [loadGroups, loadCustomers, q, filter, page, groupFilterId]);

  useEffect(() => {
    setLoading(true);
    void loadGroups()
      .catch((e) => setError(e instanceof Error ? e.message : "Hiba"))
      .finally(() => {
        /* customers: a következő effect tölti */
      });
    void loadGate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setError(null);
      setLoading(true);
      void loadCustomers({
        query: q,
        filter,
        page,
        groupInnerId: groupFilterId,
      })
        .then(() => setSelected(new Set()))
        .catch((e) =>
          setError(e instanceof Error ? e.message : "Keresés hiba"),
        )
        .finally(() => setLoading(false));
    }, q.trim() ? 350 : 0);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, filter, page, groupFilterId, loadCustomers]);

  const unlocked = list.filter(
    (c) => !isPartnerLocked(c.isPartner, c.innerId, gate),
  );
  const allOnPageSelected =
    unlocked.length > 0 && unlocked.every((c) => selected.has(c.innerId));
  const selectedCount = selected.size;

  function toggleOne(innerId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(innerId)) next.delete(innerId);
      else next.add(innerId);
      return next;
    });
  }

  function toggleAllOnPage() {
    setSelected((prev) => {
      if (unlocked.length === 0) return prev;
      const next = new Set(prev);
      if (unlocked.every((c) => next.has(c.innerId))) {
        for (const c of unlocked) next.delete(c.innerId);
      } else {
        for (const c of unlocked) next.add(c.innerId);
      }
      return next;
    });
  }

  async function runBulkMove(toId: number) {
    if (selected.size === 0) return;
    setError(null);
    setMessage(null);
    setMoving(true);
    try {
      const res = await fetch("/api/merchant/customers/bulk-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerInnerIds: [...selected],
          toGroupInnerId: toId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Átrakás sikertelen");
      setMessage(data.message || "Kész.");
      setSelected(new Set());
      await loadCustomers({
        query: q,
        filter,
        page,
        groupInnerId: groupFilterId,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Átrakás sikertelen");
    } finally {
      setMoving(false);
    }
  }

  function onMoveClick() {
    if (targetGroupId === "") {
      setError("Válaszd ki, melyik csoportba kerüljenek.");
      return;
    }
    void runBulkMove(targetGroupId);
  }

  const emptyCopy = q.trim()
    ? "Nincs ilyen nevű vagy emailű vevő."
    : groupFilterId !== ""
      ? "Ebben a csoportban nincs vevő ezen az oldalon."
      : filter === "newcomers"
        ? "Nincs új vevő az alap csoportban. Ha valaki regisztrál, itt jelenik meg."
        : filter === "partners"
          ? "Még nincs partner — rakj át valakit az Újak közül egy másik csoportba."
          : "Nincs vevő ezen az oldalon.";

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col bg-bg">
      <div className="glass-bar sticky top-0 z-10 px-4 py-3 md:px-6">
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[15px] font-semibold tracking-tight text-text">
              Vevők
            </p>
            <p className="mt-0.5 text-[12px] text-faint">
              Újak → partner csoportba. Pipáld ki, válaszd a csoportot, Átrakás.
            </p>
          </div>

          {gate?.overCap ? (
            <UpgradeBanner
              used={gate.activePartners}
              limit={gate.partnerLimit}
            />
          ) : gate?.wouldLoseOnPaid ? (
            <p className="border border-line-strong bg-surface-2 px-3 py-2 text-[12px] text-text">
              A próba alatt mind a {gate.partnerLimit}-ig látszik.{" "}
              {onPlan(gate.planLabel)} {gate.paidPartnerLimit} után a név
              elmosódik.{" "}
              <Link href="/csomag" className="font-semibold underline underline-offset-2">
                Tartsd a {gate.activePartners} vevőt
              </Link>
            </p>
          ) : gate?.warn80 && !gate.isTrial ? (
            <NearLimitBanner
              used={gate.activePartners}
              limit={gate.partnerLimit}
            />
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-none bg-surface-2 p-0.5">
              {FILTERS.map((f) => {
                const active = filter === f.id && groupFilterId === "";
                return (
                  <button
                    key={f.id}
                    type="button"
                    title={f.hint}
                    onClick={() => {
                      setFilter(f.id);
                      setGroupFilterId("");
                      setPage(0);
                      setSelected(new Set());
                    }}
                    className={
                      active
                        ? "h-8 cursor-pointer rounded-none bg-surface px-3 text-[12px] font-semibold text-text shadow-[0_0.5px_1px_rgba(26,25,23,.1)]"
                        : "h-8 cursor-pointer rounded-none px-3 text-[12px] font-medium text-faint hover:text-text"
                    }
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            <select
              value={groupFilterId === "" ? "" : String(groupFilterId)}
              onChange={(e) => {
                const v = e.target.value;
                setGroupFilterId(v === "" ? "" : Number(v));
                setFilter("all");
                setPage(0);
                setSelected(new Set());
              }}
              className="h-8 max-w-[200px] cursor-pointer rounded-none border-[1.5px] border-line-strong bg-surface px-3 text-[12px] font-medium text-text outline-none"
              title="Szűrés egy konkrét csoportra"
            >
              <option value="">Csoport: mind</option>
              {groups.map((g) => (
                <option key={g.innerId} value={g.innerId}>
                  {g.name}
                  {g.isDefault ? " (alap)" : ""}
                </option>
              ))}
            </select>

            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="Keresés: név vagy email…"
              className="h-8 min-w-[180px] flex-1 rounded-none border-[1.5px] border-line-strong bg-surface px-3 text-[13px] text-text outline-none placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
          </div>
        </div>

        {error ? (
          <p className="mt-2 text-[12px] font-medium text-danger">{error}</p>
        ) : null}
        {message ? (
          <p className="mt-2 text-[12px] font-medium text-ok">{message}</p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto pb-20">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead className="sticky top-0 z-[5] bg-bg">
            <tr className="border-b border-line-strong text-[11px] font-semibold uppercase tracking-wide text-faint">
              <th className="w-12 px-4 py-2.5 md:px-6">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleAllOnPage}
                  disabled={unlocked.length === 0}
                  aria-label="Összes kijelölése ezen az oldalon"
                  className="h-4 w-4 cursor-pointer accent-accent"
                />
              </th>
              <th className="px-2 py-2.5 font-semibold">Név</th>
              <th className="px-3 py-2.5 font-semibold">Email</th>
              <th className="px-4 py-2.5 font-semibold md:px-6">Csoport</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const on = selected.has(c.innerId);
              const locked = isPartnerLocked(c.isPartner, c.innerId, gate);
              const preview = isPartnerPreviewLocked(c.isPartner, c.innerId, gate);
              return (
                <tr
                  key={c.innerId}
                  onClick={() => {
                    if (!locked) toggleOne(c.innerId);
                  }}
                  className={
                    locked
                      ? "border-b border-line bg-surface"
                      : preview
                        ? "cursor-pointer border-b border-dashed border-warn bg-surface hover:bg-surface-2/60"
                        : on
                        ? "cursor-pointer border-b border-line bg-accent-soft"
                        : "cursor-pointer border-b border-line bg-surface hover:bg-surface-2/60"
                  }
                >
                  <td
                    className="px-4 py-2.5 md:px-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleOne(c.innerId)}
                      disabled={locked}
                      aria-label={`${c.name} kijelölése`}
                      className="h-4 w-4 cursor-pointer accent-accent disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="max-w-[220px] truncate px-2 py-2.5 text-[13px] font-semibold text-text">
                    {locked ? (
                      <span className="inline-flex items-center gap-2 blur-[5px] select-none">
                        {c.name}
                      </span>
                    ) : preview ? (
                      <span className="relative inline-flex items-center">
                        <Link
                          href={`/vevok/${c.innerId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline"
                        >
                          {c.name}
                        </Link>
                      </span>
                    ) : (
                      <Link
                        href={`/vevok/${c.innerId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline"
                      >
                        {c.name}
                      </Link>
                    )}
                  </td>
                  <td className="max-w-[240px] truncate px-3 py-2.5 text-[12px] text-faint">
                    {locked ? (
                      <span className="blur-[5px] select-none">{c.email}</span>
                    ) : (
                      c.email
                    )}
                  </td>
                  <td className="px-4 py-2.5 md:px-6">
                    {locked ? (
                      <span className="text-[12px] font-medium text-faint">
                        Tartsd a {gate?.activePartners ?? 0} vevőt, hogy lásd
                      </span>
                    ) : preview ? (
                      <span className="text-[12px] font-medium text-faint">
                        {onPlan(gate?.planLabel || "Start")} ez a név elmosódna
                      </span>
                    ) : (
                      <span className="inline-flex rounded-none bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-text">
                        {c.groupName || "Nincs csoport"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!loading && list.length === 0 ? (
          <p className="px-6 py-12 text-center text-[13px] text-faint">
            {emptyCopy}
          </p>
        ) : null}

        {loading ? (
          <p className="px-6 py-6 text-[13px] text-faint">Betöltés…</p>
        ) : null}
      </div>

      {!q.trim() && pageCount > 1 ? (
        <div className="flex items-center justify-between border-t border-line-strong bg-bg/90 px-4 py-2.5 md:px-6">
          <button
            type="button"
            disabled={page <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="h-8 cursor-pointer rounded-none px-3 text-[12px] font-semibold text-text disabled:opacity-35"
          >
            Előző
          </button>
          <p className="text-[12px] text-faint">
            Oldal {page + 1} / {pageCount}
          </p>
          <button
            type="button"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((p) => p + 1)}
            className="h-8 cursor-pointer rounded-none px-3 text-[12px] font-semibold text-text disabled:opacity-35"
          >
            Következő
          </button>
        </div>
      ) : null}

      {selectedCount > 0 ? (
        <div className="absolute inset-x-0 bottom-0 z-20 border-t border-line-strong bg-bg/95 px-4 py-3 backdrop-blur-xl md:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-1 text-[13px] font-semibold text-text">
              {selectedCount} kiválasztva
            </p>
            <select
              value={targetGroupId === "" ? "" : String(targetGroupId)}
              onChange={(e) => {
                const v = e.target.value;
                setTargetGroupId(v === "" ? "" : Number(v));
              }}
              className="h-9 min-w-[160px] flex-1 cursor-pointer rounded-none border-[1.5px] border-line-strong bg-surface px-3 text-[13px] font-medium text-text outline-none sm:max-w-[240px] sm:flex-none"
            >
              <option value="">Csoport…</option>
              {groups.map((g) => (
                <option key={g.innerId} value={g.innerId}>
                  {g.name}
                  {g.isDefault ? " (alap)" : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={moving || targetGroupId === ""}
              onClick={onMoveClick}
              className="inline-flex h-9 cursor-pointer items-center rounded-none bg-accent px-4 text-[13px] font-semibold text-white disabled:opacity-40"
            >
              {moving ? "…" : "Átrakás"}
            </button>
            <button
              type="button"
              disabled={moving}
              onClick={() => setSelected(new Set())}
              className="inline-flex h-9 cursor-pointer items-center rounded-none px-3 text-[13px] font-semibold text-faint hover:text-text"
            >
              Mégse
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
