"use client";

import { useCallback, useEffect, useState } from "react";
import { isOrgAdminRole } from "@/lib/auth/roles";
import type { TeamMemberDto } from "@/lib/merchant/team";

type TeamResponse = {
  ok?: boolean;
  error?: string;
  members?: TeamMemberDto[];
  count?: number;
  limit?: number;
  created?: boolean;
  reusedAccount?: boolean;
  member?: TeamMemberDto;
};

export function MerchantTeamSection() {
  const [members, setMembers] = useState<TeamMemberDto[]>([]);
  const [count, setCount] = useState(0);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");

  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/merchant/team");
      const data = (await res.json()) as TeamResponse;
      if (!res.ok || !data.ok || !data.members) {
        setError(data.error ?? "Nem sikerült betölteni");
        return;
      }
      setMembers(data.members);
      setCount(data.count ?? data.members.length);
      setLimit(data.limit ?? 20);
    } catch {
      setError("Nincs kapcsolat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createMember(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/merchant/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          displayName: displayName || undefined,
          password,
        }),
      });
      const data = (await res.json()) as TeamResponse;
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Létrehozás sikertelen");
        return;
      }
      if (data.reusedAccount) {
        setMessage(
          "Hozzáadva. Meglévő fiók, a korábbi jelszóval tud belépni.",
        );
      } else {
        setMessage("Felhasználó létrehozva.");
      }
      setEmail("");
      setDisplayName("");
      setPassword("");
      await load();
    } catch {
      setError("Nincs kapcsolat.");
    } finally {
      setPending(false);
    }
  }

  async function saveEdit(userId: string) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const body: { displayName?: string; password?: string } = {};
      if (editName.trim()) body.displayName = editName.trim();
      if (editPassword) body.password = editPassword;
      if (!body.displayName && !body.password) {
        setError("Nincs mit menteni");
        setPending(false);
        return;
      }
      const res = await fetch(`/api/merchant/team/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as TeamResponse;
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Mentés sikertelen");
        return;
      }
      setMessage("Mentve.");
      setEditUserId(null);
      setEditPassword("");
      setEditName("");
      await load();
    } catch {
      setError("Nincs kapcsolat.");
    } finally {
      setPending(false);
    }
  }

  async function removeMember(userId: string, label: string) {
    if (!confirm(`Eltávolítod: ${label}?`)) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/merchant/team/${userId}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as TeamResponse;
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Törlés sikertelen");
        return;
      }
      setMessage("Eltávolítva.");
      await load();
    } catch {
      setError("Nincs kapcsolat.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="border-t border-line-strong pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold tracking-tight">
            Felhasználók
          </h2>
          <p className="mt-1 text-[13px] text-faint">
            Azonnali hozzáférés email + jelszóval. User nem látja a Beállításokat.
            {" · "}
            {count} / {limit}
          </p>
        </div>
      </div>

      {(error || message) && (
        <p
          className={`mt-3 text-[13px] font-medium ${
            error ? "text-danger" : "text-ok"
          }`}
          role={error ? "alert" : "status"}
        >
          {error ?? message}
        </p>
      )}

      {loading ? (
        <p className="mt-4 text-[13px] text-faint">Betöltés…</p>
      ) : (
        <ul className="mt-4 divide-y divide-line-strong border border-line-strong">
          {members.map((m) => {
            const isAdmin = isOrgAdminRole(m.role);
            const editing = editUserId === m.userId;
            return (
              <li key={m.userId} className="bg-surface px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium">
                      {m.displayName || m.email}
                      <span className="ml-2 text-[12px] font-normal text-faint">
                        {m.roleLabel}
                        {m.disabledAt ? " · tiltva" : ""}
                      </span>
                    </p>
                    <p className="text-[12px] text-faint">{m.email}</p>
                    <p className="text-[12px] text-faint">
                      {m.lastLoginAt
                        ? `Utolsó belépés: ${new Date(m.lastLoginAt).toLocaleString("hu-HU")}`
                        : "Még nem lépett be"}
                    </p>
                  </div>
                  {!isAdmin ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="tn-btn tn-btn-ghost"
                        disabled={pending}
                        onClick={() => {
                          setEditUserId(m.userId);
                          setEditName(m.displayName ?? "");
                          setEditPassword("");
                        }}
                      >
                        Szerkeszt
                      </button>
                      <button
                        type="button"
                        className="tn-btn tn-btn-ghost"
                        disabled={pending}
                        onClick={() =>
                          void removeMember(m.userId, m.email)
                        }
                      >
                        Eltávolít
                      </button>
                    </div>
                  ) : (
                    <p className="text-[12px] text-faint">Fő admin</p>
                  )}
                </div>
                {editing ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="tn-field">
                      <span className="tn-label">Megjelenített név</span>
                      <input
                        className="tn-input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </label>
                    <label className="tn-field">
                      <span className="tn-label">Új jelszó</span>
                      <input
                        className="tn-input"
                        type="password"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        placeholder="min. 8 karakter"
                        autoComplete="new-password"
                      />
                    </label>
                    <div className="flex gap-2 sm:col-span-2">
                      <button
                        type="button"
                        className="tn-btn tn-btn-primary"
                        disabled={pending}
                        onClick={() => void saveEdit(m.userId)}
                      >
                        Mentés
                      </button>
                      <button
                        type="button"
                        className="tn-btn tn-btn-ghost"
                        onClick={() => setEditUserId(null)}
                      >
                        Mégse
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="mt-6 grid max-w-xl gap-4"
        onSubmit={(e) => void createMember(e)}
      >
        <h3 className="text-[15px] font-semibold tracking-tight">
          Új felhasználó
        </h3>
        <label className="tn-field">
          <span className="tn-label">Email</span>
          <input
            className="tn-input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="tn-field">
          <span className="tn-label">Megjelenített név</span>
          <input
            className="tn-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <label className="tn-field">
          <span className="tn-label">Jelszó</span>
          <input
            className="tn-input"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <button
          type="submit"
          className="tn-btn tn-btn-primary w-fit"
          disabled={pending || count >= limit}
        >
          {pending ? "…" : "Létrehozás"}
        </button>
      </form>
    </section>
  );
}
