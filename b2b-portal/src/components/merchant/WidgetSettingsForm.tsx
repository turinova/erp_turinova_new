"use client";

import { useMemo, useState } from "react";
import { WidgetLivePreview } from "@/components/merchant/WidgetLivePreview";
import { isLocalAppUrl } from "@/lib/public-app-url";
import type { MerchantWidgetDto } from "@/lib/widget/settings";
import {
  DEFAULT_WIDGET_SETTINGS,
  FAB_COLOR_PRESETS,
  FAB_INK_PRESETS,
  FAB_POSITION_PRESETS,
  FAB_SIZE_PRESETS,
  FAB_STYLE_PRESETS,
  resolveFabColor,
  type FabColorPresetId,
  type FabInkId,
  type FabPositionId,
  type FabSizeId,
  type FabStyleId,
  type WidgetSettingsPayload,
} from "@/lib/widget/presets";

type Props = { initial: MerchantWidgetDto; apiBase: string };
type TabId = "appear" | "install";

/** Notion/Apple: short chips, clear selected state, soft hover — no purple SaaS pills. */
function ChipRow<T extends string>({
  label,
  value,
  options,
  onChange,
  renderLeading,
  segmented,
}: {
  label: string;
  value: T;
  options: { id: T; label: string; hint?: string }[];
  onChange: (id: T) => void;
  renderLeading?: (id: T) => React.ReactNode;
  /** iOS-style track for short exclusive sets (e.g. Betű). */
  segmented?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-[-0.01em] text-muted">
        {label}
      </p>
      <div
        className={
          segmented
            ? "mt-2 inline-flex flex-wrap gap-0.5 rounded-none bg-surface-2 p-0.5"
            : "mt-2 flex flex-wrap gap-1.5"
        }
        role="radiogroup"
        aria-label={label}
      >
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              title={opt.hint || opt.label}
              onClick={() => onChange(opt.id)}
              className={
                segmented
                  ? active
                    ? "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-none bg-surface px-2.5 text-[11px] font-semibold text-text shadow-[0_0.5px_1px_rgba(0,0,0,0.12)] transition-[color,background,box-shadow] duration-150"
                    : "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-none px-2.5 text-[11px] font-medium text-faint transition-colors duration-150 hover:text-text"
                  : active
                    ? "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-none border-[1.5px] border-text bg-surface px-2.5 text-[11px] font-semibold text-text transition-[border-color,background] duration-150"
                    : "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-none border-[0.5px] border-line bg-surface px-2.5 text-[11px] font-medium text-faint transition-colors duration-150 hover:border-line-strong hover:text-text"
              }
            >
              {renderLeading?.(opt.id)}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WidgetSettingsForm({ initial, apiBase }: Props) {
  const [widgetEnabled, setWidgetEnabled] = useState(initial.widgetEnabled);
  const [buttonLabel, setButtonLabel] = useState(initial.buttonLabel);
  const [widgetVersion, setWidgetVersion] = useState(initial.widgetVersion);
  const [settings, setSettings] = useState<WidgetSettingsPayload>({
    ...initial.settings,
    features: {
      ...DEFAULT_WIDGET_SETTINGS.features,
      hideTurinovaMark: initial.settings.features.hideTurinovaMark === true,
      showCustomerGroupName:
        initial.settings.features.showCustomerGroupName === true,
      showNextLevelProgress:
        initial.settings.features.showNextLevelProgress === true,
    },
  });
  const [hideTurinovaMark, setHideTurinovaMark] = useState(
    initial.settings.features.hideTurinovaMark === true,
  );
  const [showCustomerGroupName, setShowCustomerGroupName] = useState(
    initial.settings.features.showCustomerGroupName === true,
  );
  const [showNextLevelProgress, setShowNextLevelProgress] = useState(
    initial.settings.features.showNextLevelProgress === true,
  );
  const [tab, setTab] = useState<TabId>("appear");
  const [showPanel, setShowPanel] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const apiBaseLocal = isLocalAppUrl(apiBase);
  const snippet = useMemo(
    () =>
      `<script>
window.SR_B2B_QUICKORDER = {
  apiBase: ${JSON.stringify(apiBase)},
  shopId: ${JSON.stringify(initial.publicId)}
};
</script>
<script src=${JSON.stringify(`${apiBase}/widget.js?v=${widgetVersion}`)}></script>`,
    [apiBase, initial.publicId, widgetVersion],
  );

  const fabColor = useMemo(
    () => resolveFabColor(settings.appearance),
    [settings.appearance],
  );

  function patchAppearance(
    patch: Partial<WidgetSettingsPayload["appearance"]>,
  ) {
    setSettings((s) => ({
      ...s,
      appearance: { ...s.appearance, ...patch },
    }));
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);

    const payload: WidgetSettingsPayload = {
      appearance: {
        ...settings.appearance,
        panelTheme: "high_contrast",
      },
      features: {
        ...DEFAULT_WIDGET_SETTINGS.features,
        hideTurinovaMark,
        showCustomerGroupName,
        showNextLevelProgress,
      },
    };

    try {
      const res = await fetch("/api/merchant/widget", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widgetEnabled,
          buttonLabel,
          customerGroupIds: [],
          settings: payload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Mentés sikertelen");
      const nextHide =
        data.widget.settings.features.hideTurinovaMark === true;
      const nextGroupName =
        data.widget.settings.features.showCustomerGroupName === true;
      const nextProgress =
        data.widget.settings.features.showNextLevelProgress === true;
      setSettings({
        ...data.widget.settings,
        features: {
          ...DEFAULT_WIDGET_SETTINGS.features,
          hideTurinovaMark: nextHide,
          showCustomerGroupName: nextGroupName,
          showNextLevelProgress: nextProgress,
        },
      });
      setHideTurinovaMark(nextHide);
      setShowCustomerGroupName(nextGroupName);
      setShowNextLevelProgress(nextProgress);
      setButtonLabel(data.widget.buttonLabel);
      setWidgetEnabled(data.widget.widgetEnabled);
      if (typeof data.widget.widgetVersion === "string") {
        setWidgetVersion(data.widget.widgetVersion);
      }
      setMessage(
        "Mentve. Nyisd meg a boltot, és frissítsd erősen (Cmd/Ctrl + Shift + R), hogy a változás látszódjon.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    } finally {
      setPending(false);
    }
  }

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet);
      setError(null);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("A másolás nem sikerült — jelöld ki a kódot kézzel.");
    }
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "appear", label: "Nézet" },
    { id: "install", label: "Boltba" },
  ];

  return (
    <form
      onSubmit={save}
      className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)] lg:overflow-hidden"
    >
      <section className="flex min-h-[380px] flex-col border-b-[0.5px] border-line-strong p-3 md:p-4 lg:min-h-0 lg:border-b-0 lg:border-r-[0.5px]">
        <WidgetLivePreview
          buttonLabel={buttonLabel}
          fabColor={fabColor}
          fabInk={settings.appearance.fabInk}
          fabStyle={settings.appearance.fabStyle}
          fabPosition={settings.appearance.fabPosition}
          fabSize={settings.appearance.fabSize}
          panelTheme="high_contrast"
          modules={[...DEFAULT_WIDGET_SETTINGS.features.modules]}
          showTurinovaMark={
            initial.canHideTurinovaMark ? !hideTurinovaMark : true
          }
          showPanel={showPanel}
          onTogglePanel={() => setShowPanel((v) => !v)}
        />
      </section>

      <aside className="flex min-h-0 flex-col bg-bg lg:overflow-hidden">
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b-[0.5px] border-line-strong bg-bg/95 px-3 py-2.5 backdrop-blur-sm md:px-4">
          <div
            className="flex flex-1 gap-0.5 rounded-none p-0.5"
            style={{ background: "rgba(55,53,47,0.08)" }}
            role="tablist"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={
                  tab === t.id
                    ? "h-7 flex-1 cursor-pointer rounded-none bg-surface text-[11px] font-semibold text-text shadow-[0_0.5px_1px_rgba(26,25,23,.1)]"
                    : "h-7 flex-1 cursor-pointer rounded-none text-[11px] font-medium text-muted"
                }
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-8 shrink-0 cursor-pointer items-center rounded-none bg-accent px-3 text-[12px] font-semibold text-white disabled:opacity-60"
          >
            {pending ? "…" : "Mentés"}
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3 md:px-4">
          {!initial.catalogReady ? (
            <div className="border-[1.5px] border-line-strong bg-surface-2 p-3">
              <p className="text-[13px] font-semibold">A termékek még másolódnak</p>
              <p className="mt-1 text-[12px] text-faint">
                A kereső még nem lesz teljes. Nézd a Beállításokat.
              </p>
            </div>
          ) : null}
          {tab === "appear" ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex cursor-pointer items-center gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    checked={widgetEnabled}
                    onChange={(e) => setWidgetEnabled(e.target.checked)}
                    className="accent-[var(--accent)]"
                  />
                  Megjelenik a boltban
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-muted">
                  Felirat a boltban
                </span>
                <input
                  value={buttonLabel}
                  onChange={(e) => setButtonLabel(e.target.value)}
                  className="h-8 rounded-none border-[0.5px] border-line-strong bg-surface px-3 text-[12px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>

              <div>
                <label
                  className={
                    initial.canHideTurinovaMark
                      ? "flex cursor-pointer items-center gap-2 text-[12px]"
                      : "flex items-center gap-2 text-[12px] text-faint"
                  }
                >
                  <input
                    type="checkbox"
                    checked={
                      initial.canHideTurinovaMark ? !hideTurinovaMark : true
                    }
                    disabled={!initial.canHideTurinovaMark}
                    onChange={(e) => setHideTurinovaMark(!e.target.checked)}
                    className="accent-[var(--accent)]"
                  />
                  Turinova a panel alján
                </label>
                <p className="mt-1 text-[11px] leading-relaxed text-faint">
                  {initial.canHideTurinovaMark
                    ? "A jel a gyors rendelés alján. Leveheted — a te márkád marad a boltban."
                    : initial.isTrial
                      ? "Próba alatt a jel ott marad. A fizetett Pron leveheted."
                      : "A fizetett Pron elrejtheted — a te márkád marad a boltban."}{" "}
                  {!initial.canHideTurinovaMark ? (
                    <a href="/csomag" className="font-semibold underline underline-offset-2">
                      Csomagok
                    </a>
                  ) : null}
                </p>

                <div className="mt-4 space-y-2 border-t border-line pt-3">
                  <p className="text-[11px] font-semibold text-muted">
                    Partner szint a panelen
                  </p>
                  <label className="flex cursor-pointer items-start gap-2 text-[12px]">
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-[var(--accent)]"
                      checked={showCustomerGroupName}
                      onChange={(e) =>
                        setShowCustomerGroupName(e.target.checked)
                      }
                    />
                    <span>
                      <span className="font-semibold">Csoportnév mutatása</span>
                      <span className="mt-0.5 block text-[11px] text-faint">
                        Pl. „Csoportod: Asztalosok”. Alapból ki — csak ha
                        akarod.
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2 text-[12px]">
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-[var(--accent)]"
                      checked={showNextLevelProgress}
                      onChange={(e) =>
                        setShowNextLevelProgress(e.target.checked)
                      }
                    />
                    <span>
                      <span className="font-semibold">
                        Következő szint (még ennyi kell)
                      </span>
                      <span className="mt-0.5 block text-[11px] text-faint">
                        „Még X Ft / rendelés a jobb csoporthoz” — a Szintlépés
                        szabályokból számoljuk.
                      </span>
                    </span>
                  </label>
                </div>
                {!initial.canParseImage ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-faint">
                    A fotós lista a Proé. Próba után a Starton és a Pluson nincs.{" "}
                    <a href="/csomag" className="font-semibold underline underline-offset-2">
                      Csomagok
                    </a>
                  </p>
                ) : (
                  <p className="mt-2 text-[11px] leading-relaxed text-faint">
                    A fotós lista most be van kapcsolva.
                  </p>
                )}
              </div>

              <ChipRow
                label="Szín"
                value={settings.appearance.fabColorPreset}
                options={FAB_COLOR_PRESETS.map((p) => ({
                  id: p.id,
                  label: p.label,
                }))}
                onChange={(id) =>
                  patchAppearance({ fabColorPreset: id as FabColorPresetId })
                }
                renderLeading={(id) => {
                  const p = FAB_COLOR_PRESETS.find((x) => x.id === id);
                  const bg =
                    id === "custom"
                      ? settings.appearance.fabColorCustom ||
                        "conic-gradient(from 180deg,#FF3B30,#FF9F0A,#34C759,#007AFF,#AF52DE,#FF3B30)"
                      : p?.color || "#ccc";
                  const ring =
                    id === settings.appearance.fabColorPreset
                      ? "ring-1 ring-text ring-offset-1"
                      : "ring-0";
                  return (
                    <span
                      className={`h-4 w-4 shrink-0 rounded-none border-[0.5px] border-black/15 ${ring}`}
                      style={{ background: bg }}
                      aria-hidden
                    />
                  );
                }}
              />
              {settings.appearance.fabColorPreset === "custom" ? (
                <label className="flex items-center gap-2">
                  <span className="text-[11px] text-muted">Saját szín</span>
                  <input
                    type="color"
                    value={settings.appearance.fabColorCustom || "#007AFF"}
                    onChange={(e) =>
                      patchAppearance({ fabColorCustom: e.target.value })
                    }
                    className="h-8 w-12 cursor-pointer rounded-none border-[0.5px] border-line-strong bg-surface p-0.5"
                  />
                </label>
              ) : null}

              <ChipRow
                label="Betű"
                segmented
                value={settings.appearance.fabInk}
                options={FAB_INK_PRESETS.map((p) => ({
                  id: p.id,
                  label: p.label,
                  hint:
                    p.id === "auto"
                      ? "Automatikus kontraszt"
                      : p.id === "white"
                        ? "Fehér betű"
                        : "Fekete betű",
                }))}
                onChange={(id) =>
                  patchAppearance({ fabInk: id as FabInkId })
                }
                renderLeading={(id) => {
                  if (id === "auto") {
                    return (
                      <span
                        className="relative flex h-3.5 w-3.5 overflow-hidden rounded-none ring-1 ring-black/15"
                        aria-hidden
                      >
                        <span className="flex h-full w-1/2 items-center justify-center bg-[#1C1C1E] text-[7px] font-bold text-white">
                          A
                        </span>
                        <span className="flex h-full w-1/2 items-center justify-center bg-white text-[7px] font-bold text-[#1C1C1E]">
                          A
                        </span>
                      </span>
                    );
                  }
                  const dark = id === "black";
                  return (
                    <span
                      className={
                        dark
                          ? "flex h-3.5 w-3.5 items-center justify-center rounded-none bg-white text-[8px] font-bold leading-none text-[#1C1C1E] ring-1 ring-black/15"
                          : "flex h-3.5 w-3.5 items-center justify-center rounded-none bg-[#1C1C1E] text-[8px] font-bold leading-none text-white"
                      }
                      aria-hidden
                    >
                      A
                    </span>
                  );
                }}
              />

              <ChipRow
                label="Stílus"
                value={settings.appearance.fabStyle}
                options={FAB_STYLE_PRESETS.map((p) => ({
                  id: p.id,
                  label: p.label,
                  hint: p.hint,
                }))}
                onChange={(id) =>
                  patchAppearance({ fabStyle: id as FabStyleId })
                }
              />

              <ChipRow
                label="Pozíció"
                value={settings.appearance.fabPosition}
                options={FAB_POSITION_PRESETS.map((p) => ({
                  id: p.id,
                  label: p.label,
                }))}
                onChange={(id) =>
                  patchAppearance({ fabPosition: id as FabPositionId })
                }
              />

              <ChipRow
                label="Méret"
                value={settings.appearance.fabSize}
                options={FAB_SIZE_PRESETS.map((p) => ({
                  id: p.id,
                  label: p.label,
                }))}
                onChange={(id) =>
                  patchAppearance({ fabSize: id as FabSizeId })
                }
              />
            </>
          ) : null}

          {tab === "install" ? (
            <div className="space-y-3">
              {apiBaseLocal ? (
                <div className="border-[1.5px] border-line-strong bg-surface-2 p-3">
                  <p className="text-[13px] font-semibold">
                    Ez a cím most a géped
                  </p>
                  <p className="mt-1 text-[12px] text-faint">
                    A bolt nem éri el a localhostot. Nyilvános HTTPS kell
                    (tunnel vagy b2b.turinova.hu), utána másold újra a kódot.
                  </p>
                </div>
              ) : null}

              <div>
                <p className="text-[11px] font-semibold text-muted">
                  Hova tedd
                </p>
                <ol className="mt-1 list-decimal space-y-1.5 pl-4 text-[12px] text-faint">
                  <li>Shoprenter → Design → Fejléc (header HTML)</li>
                  <li>Illeszd be a kódot egyszer, a záró fejléccímke elé</li>
                  <li>Mentsd a sablont, nyisd meg a boltot inkognitóban</li>
                </ol>
                <p className="mt-3 text-[12px] leading-relaxed text-faint">
                  Ettől lesz a sablonotokban, nem csak a sarokban: adj egy
                  menüpontot — felirat{" "}
                  <span className="font-semibold text-text">Gyors rendelés</span>
                  , hivatkozás{" "}
                  <code className="rounded-none bg-surface-2 px-1 font-mono text-[11px] text-text">
                    #sr-b2b-qo
                  </code>
                  . A partner rákattint, és azonnal a keresőben van.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-muted">
                    Kód a gyors rendeléshez
                  </p>
                  <button
                    type="button"
                    onClick={copySnippet}
                    className="cursor-pointer text-[11px] font-semibold underline underline-offset-2"
                  >
                    {copied ? "Másolva" : "Másolás"}
                  </button>
                </div>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-none bg-[#0f172a] p-3 font-mono text-[10px] leading-relaxed text-white">
                  {snippet}
                </pre>
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="text-[12px] font-medium text-danger" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="text-[12px] font-medium text-ok" role="status">
              {message}
            </p>
          ) : null}
        </div>
      </aside>
    </form>
  );
}
