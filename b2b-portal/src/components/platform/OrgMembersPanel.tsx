"use client";

import { useState } from "react";
import { ResendInviteButton } from "@/components/platform/ResendInviteButton";
import { isOrgAdminRole } from "@/lib/auth/roles";
import { relativeTime } from "@/lib/format";
import type { OrgDetail } from "@/lib/orgs/types";

type Member = OrgDetail["members"][number];

type Props = {
  orgId: string;
  members: Member[];
  pendingInvite: OrgDetail["pending_invite"];
  onOrganization: (org: OrgDetail) => void;
};

export function OrgMembersPanel({
  orgId,
  members,
  pendingInvite,
  onOrganization,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");

  function startEdit(m: Member) {
    setEditId(m.userId);
    setEmail(m.email);
    setDisplayName(m.display_name ?? "");
    setPassword("");
    setError(null);
    setMessage(null);
  }

  async function patchMember(
    userId: string,
    body: Record<string, unknown>,
    okMsg: string,
  ) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        organization?: OrgDetail;
      };
      if (!res.ok || !json.ok || !json.organization) {
        setError(json.error ?? "Nem sikerült");
        return;
      }
      onOrganization(json.organization);
      setMessage(okMsg);
      setEditId(null);
      setPassword("");
    } catch {
      setError("Nincs net.");
    } finally {
      setPending(false);
    }
  }

  async function saveEdit(userId: string) {
    const body: Record<string, unknown> = {
      email,
      displayName: displayName.trim() || null,
    };
    if (password) body.password = password;
    await patchMember(userId, body, "Felhasználó mentve");
  }

  async function removeMember(userId: string, label: string) {
    if (!confirm(`Eltávolítod: ${label}?`)) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/members/${userId}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        organization?: OrgDetail;
      };
      if (!res.ok || !json.ok || !json.organization) {
        setError(json.error ?? "Nem sikerült");
        return;
      }
      onOrganization(json.organization);
      setMessage("Eltávolítva");
    } catch {
      setError("Nincs net.");
    } finally {
      setPending(false);
    }
  }

  async function createMember(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          displayName: newName || undefined,
          password: newPassword,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        organization?: OrgDetail;
        reusedAccount?: boolean;
      };
      if (!res.ok || !json.ok || !json.organization) {
        setError(json.error ?? "Nem sikerült");
        return;
      }
      onOrganization(json.organization);
      setMessage(
        json.reusedAccount
          ? "Hozzáadva (meglévő fiók)"
          : "Felhasználó létrehozva",
      );
      setNewEmail("");
      setNewName("");
      setNewPassword("");
    } catch {
      setError("Nincs net.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="tn-section">
      <h3 className="tn-section-title">Emberek</h3>
      <p className="mt-1 text-[13px] text-faint">
        {members.length} / 20 · Admin = fő user · User = Beállítások nélkül
      </p>

      {(error || message) && (
        <p
          className={`mt-3 text-[13px] font-medium ${
            error ? "text-danger" : "text-ok"
          }`}
        >
          {error ?? message}
        </p>
      )}

      {members.length === 0 && !pendingInvite ? (
        <p className="mt-3 text-[13px] text-faint">Nincs tag</p>
      ) : null}

      <ul className="mt-4 space-y-4 text-[14px]">
        {members.map((m) => {
          const isAdmin = isOrgAdminRole(m.role);
          const editing = editId === m.userId;
          return (
            <li
              key={m.userId}
              className={
                isAdmin
                  ? "border-2 border-text bg-surface p-3"
                  : "border border-line-strong bg-surface p-3"
              }
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {m.display_name || m.email}
                    <span className="ml-2 text-[12px] font-normal text-faint">
                      {m.roleLabel}
                      {isAdmin ? " · fő user" : ""}
                      {m.disabled_at ? " · tiltva" : ""}
                    </span>
                  </p>
                  <p className="text-[12px] text-faint">{m.email}</p>
                  <p className="text-[12px] text-faint">
                    {m.last_login_at
                      ? relativeTime(m.last_login_at)
                      : "még nem lépett be"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="tn-btn tn-btn-ghost"
                    disabled={pending}
                    onClick={() => startEdit(m)}
                  >
                    Szerkeszt
                  </button>
                  {!m.disabled_at ? (
                    <button
                      type="button"
                      className="tn-btn tn-btn-ghost"
                      disabled={pending}
                      onClick={() => {
                        if (
                          isAdmin &&
                          !confirm(
                            "Az admin tiltása kizárja a belépésből. Folytatod?",
                          )
                        ) {
                          return;
                        }
                        void patchMember(
                          m.userId,
                          { disabled: true },
                          "Tiltva",
                        );
                      }}
                    >
                     Tilt
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="tn-btn tn-btn-ghost"
                      disabled={pending}
                      onClick={() =>
                        void patchMember(
                          m.userId,
                          { disabled: false },
                          "Engedélyezve",
                        )
                      }
                    >
                      Engedélyez
                    </button>
                  )}
                  {!isAdmin ? (
                    <button
                      type="button"
                      className="tn-btn tn-btn-ghost"
                      disabled={pending}
                      onClick={() => void removeMember(m.userId, m.email)}
                    >
                      Eltávolít
                    </button>
                  ) : null}
                </div>
              </div>

              {editing ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="tn-field">
                    <span className="tn-label">Email</span>
                    <input
                      className="tn-input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                  <label className="tn-field">
                    <span className="tn-label">Név</span>
                    <input
                      className="tn-input"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </label>
                  <label className="tn-field sm:col-span-2">
                    <span className="tn-label">Új jelszó</span>
                    <input
                      className="tn-input"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="üres = nem változik"
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
                      onClick={() => setEditId(null)}
                    >
                      Mégse
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}

        {pendingInvite ? (
          <li className="text-warn">
            Függő meghívó: {pendingInvite.email}
            {" · "}
            {new Date(pendingInvite.expires_at) <= new Date()
              ? "lejárt"
              : `lejár ${new Date(pendingInvite.expires_at).toLocaleDateString("hu-HU")}`}
          </li>
        ) : null}
      </ul>

      {pendingInvite ? (
        <div className="mt-4">
          <ResendInviteButton orgId={orgId} />
        </div>
      ) : null}

      <form
        className="mt-6 grid max-w-lg gap-3 border-t border-line-strong pt-5"
        onSubmit={(e) => void createMember(e)}
      >
        <p className="text-[13px] font-semibold">Új User (azonnal)</p>
        <label className="tn-field">
          <span className="tn-label">Email</span>
          <input
            className="tn-input"
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
        </label>
        <label className="tn-field">
          <span className="tn-label">Név</span>
          <input
            className="tn-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </label>
        <label className="tn-field">
          <span className="tn-label">Jelszó</span>
          <input
            className="tn-input"
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <button
          type="submit"
          className="tn-btn tn-btn-primary w-fit"
          disabled={pending || members.length >= 20}
        >
          Létrehozás
        </button>
      </form>
    </section>
  );
}
