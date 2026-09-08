"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { WidgetLivePreview } from "@/components/merchant/WidgetLivePreview";
import { EmbedShell } from "@/components/sr-embed/EmbedShell";
import { buildLoaderSnippet } from "@/lib/shoprenter/install/snippet";
import type { MerchantWidgetDto } from "@/lib/widget/settings";
import {
  applyWidgetTheme,
  FAB_INK_PRESETS,
  FAB_POSITION_PRESETS,
  FAB_SIZE_PRESETS,
  FAB_STYLE_PRESETS,
  normalizeFabHex,
  normalizeWidgetSettings,
  resolveFabColor,
  WIDGET_THEME_PRESETS,
  type FabPositionId,
  type FabSizeId,
  type FabStyleId,
  type WidgetModuleId,
  type WidgetSettingsPayload,
} from "@/lib/widget/presets";

type TabId = "button" | "extra";
export type WidgetEditorSurface = "embed" | "merchant";

type Props = {
  initial: MerchantWidgetDto;
  /** embed = Shoprenter App Store shell; merchant = portal /widget */
  surface: WidgetEditorSurface;
  /** Required for merchant install snippet. */
  apiBase?: string;
  shopName?: string;
  storeUrl?: string | null;
  catalogStatus?: string | null;
  /** Deep-link (?tab=extra). */
  initialTab?: TabId;
};

const TABS: { id: TabId; label: string }[] = [
  { id: "button", label: "Gomb" },
  { id: "extra", label: "Extra" },
];

function Field({
  title,
  hint,
  children,
  dense,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  dense?: boolean;
}) {
  return (
    <div className={dense ? "space-y-2" : "space-y-2.5"}>
      <div>
        <p className="text-[15px] font-semibold leading-snug tracking-tight text-text">
          {title}
        </p>
        {hint ? (
          <p className="mt-0.5 text-[13px] leading-snug text-faint">{hint}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/** Compact grid of equal choices (2–3 cols). */
function ChoiceGrid<T extends string>({
  value,
  options,
  cols = 2,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  cols?: 2 | 3;
  onChange: (id: T) => void;
}) {
  return (
    <div
      className={
        cols === 3
          ? "grid grid-cols-3 gap-1.5"
          : "grid grid-cols-2 gap-1.5"
      }
      role="radiogroup"
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.id)}
            className={
              active
                ? "flex min-h-10 cursor-pointer items-center justify-center border-2 border-text bg-surface px-2 text-[13px] font-semibold text-text"
                : "flex min-h-10 cursor-pointer items-center justify-center border-[1.5px] border-line-strong bg-surface px-2 text-[13px] font-medium text-faint hover:border-text hover:text-text"
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function BigToggle({
  label,
  hint,
  checked,
  onChange,
  locked,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  locked?: boolean;
}) {
  return (
    <label
      className={
        locked
          ? "flex min-h-11 cursor-not-allowed items-start gap-3 border-[1.5px] border-line-strong bg-surface-2 px-3 py-2.5 opacity-70"
          : "flex min-h-11 cursor-pointer items-start gap-3 border-[1.5px] border-line-strong bg-surface px-3 py-2.5 hover:border-text"
      }
    >
      <input
        type="checkbox"
        className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--accent)]"
        checked={checked}
        disabled={locked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-[14px] font-semibold text-text">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-[12px] leading-snug text-faint">
            {hint}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export function WidgetEditor({
  initial,
  surface,
  apiBase = "",
  shopName,
  storeUrl = null,
  catalogStatus = null,
  initialTab = "button",
}: Props) {
  const isEmbed = surface === "embed";
  const resolvedShopName = shopName || initial.shoprenterShopName;
  const resolvedCatalog = catalogStatus ?? initial.catalogStatus;

  const [widgetEnabled, setWidgetEnabled] = useState(initial.widgetEnabled);
  const [buttonLabel, setButtonLabel] = useState(initial.buttonLabel);
  const [widgetVersion, setWidgetVersion] = useState(initial.widgetVersion);
  const [settings, setSettings] = useState<WidgetSettingsPayload>(() =>
    normalizeWidgetSettings(initial.settings),
  );
  const [tab, setTab] = useState<TabId>(initialTab);
  const [showPanel, setShowPanel] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [snippetCopied, setSnippetCopied] = useState(false);

  useEffect(() => {
    // Gomb tab → FAB előnézet; Extra → nyitott widget panel.
    setShowPanel(tab !== "button");
  }, [tab]);

  const fabColor = useMemo(
    () => resolveFabColor(settings.appearance),
    [settings.appearance],
  );

  const menuLink = "#sr-b2b-qo";

  const markDirty = useCallback(() => {
    setDirty(true);
    setMessage(null);
  }, []);

  function patchAppearance(
    patch: Partial<WidgetSettingsPayload["appearance"]>,
  ) {
    setSettings((s) => ({
      ...s,
      appearance: { ...s.appearance, ...patch },
      launch: { ...s.launch, profileId: "custom" },
    }));
    markDirty();
  }

  function patchLaunch(patch: Partial<WidgetSettingsPayload["launch"]>) {
    setSettings((s) => ({
      ...s,
      launch: { ...s.launch, ...patch, profileId: "custom" },
    }));
    markDirty();
  }

  function setModuleOn(id: WidgetModuleId, on: boolean) {
    if (id === "search") return;
    setSettings((s) => {
      const has = s.features.modules.includes(id);
      let modules = s.features.modules;
      if (on && !has) modules = [...modules, id];
      if (!on && has) modules = modules.filter((m) => m !== id);
      return {
        ...s,
        features: { ...s.features, modules },
        launch: { ...s.launch, profileId: "custom" },
      };
    });
    markDirty();
  }

  async function copyMenuLink() {
    try {
      await navigator.clipboard.writeText(menuLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Másolás sikertelen");
    }
  }

  const snippet = useMemo(() => {
    if (!apiBase || !initial.publicId) return "";
    return buildLoaderSnippet({
      apiBase,
      publicId: initial.publicId,
      version: widgetVersion,
    });
  }, [apiBase, initial.publicId, widgetVersion]);

  async function copySnippet() {
    if (!snippet) return;
    try {
      await navigator.clipboard.writeText(snippet);
      setSnippetCopied(true);
      setTimeout(() => setSnippetCopied(false), 2000);
    } catch {
      setError("A másolás nem sikerült. Jelöld ki a kódot kézzel.");
    }
  }

  async function save() {
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const label = buttonLabel.trim() || "Gyors rendelés";
      const toSave = normalizeWidgetSettings({
        ...settings,
        features: {
          ...settings.features,
          showFreeShippingProgress: false,
        },
        freeShipping: { manualGross: null },
        launch: {
          ...settings.launch,
          panelTitle: label,
          presentation: "fullscreen",
        },
      });
      const endpoint = isEmbed
        ? "/api/shoprenter/embed/widget"
        : "/api/merchant/widget";
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widgetEnabled,
          buttonLabel: label,
          ...(isEmbed ? {} : { customerGroupIds: [] }),
          settings: toSave,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Mentés sikertelen");
        return;
      }
      if (data.widget) {
        setSettings(normalizeWidgetSettings(data.widget.settings));
        setButtonLabel(data.widget.buttonLabel);
        setWidgetEnabled(data.widget.widgetEnabled);
        if (typeof data.widget.widgetVersion === "string") {
          setWidgetVersion(data.widget.widgetVersion);
        }
      }
      setDirty(false);
      setMessage("Mentve");
      setTimeout(() => setMessage(null), 2000);
    } catch {
      setError("Hálózati hiba");
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const catalogReady =
    resolvedCatalog === "ready" || resolvedCatalog === "synced";

  const positionId = (
    FAB_POSITION_PRESETS.some((p) => p.id === settings.appearance.fabPosition)
      ? settings.appearance.fabPosition
      : "bottom_right"
  ) as FabPositionId;

  const saveSlot = (
    <div className="flex items-center gap-2">
      {message ? (
        <span className="hidden text-[13px] font-semibold text-accent sm:inline">
          {message}
        </span>
      ) : null}
      {error ? (
        <span className="hidden max-w-[12rem] truncate text-[13px] font-semibold text-danger sm:inline">
          {error}
        </span>
      ) : null}
      <button
        type="button"
        disabled={pending || !dirty}
        onClick={() => void save()}
        className="tn-btn tn-btn-primary !h-11 px-4 text-[14px] font-semibold"
      >
        {pending ? "…" : dirty ? "Mentés *" : "Mentés"}
      </button>
    </div>
  );

  const editorBody = (
      <div className="flex min-h-0 flex-1 flex-col lg:overflow-hidden">
        {!isEmbed ? (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line-strong px-4 py-2.5 md:px-5">
            <div className="min-w-0">
              {message ? (
                <p className="text-[13px] font-semibold text-accent">{message}</p>
              ) : error ? (
                <p className="truncate text-[13px] font-semibold text-danger">
                  {error}
                </p>
              ) : (
                <p className="text-[13px] text-faint">
                  {dirty ? "Nem mentett változtatások" : "Mentve a boltra"}
                </p>
              )}
            </div>
            {saveSlot}
          </div>
        ) : null}
        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.8fr)] lg:overflow-hidden">
          <section className="flex min-h-[380px] flex-col border-b border-line-strong p-4 md:p-5 lg:min-h-0 lg:border-b-0 lg:border-r">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[16px] font-semibold tracking-tight text-text">
                  Így néz ki
                </p>
                <p className="mt-0.5 text-[14px] text-faint">
                  Balra a bolt, jobbra állítod.
                </p>
              </div>
              <button
                type="button"
                className="text-[14px] font-semibold text-muted lg:hidden"
                onClick={() => setPreviewOpen((v) => !v)}
              >
                {previewOpen ? "Előnézet elrejt" : "Előnézet"}
              </button>
            </div>
            <div
              className={
                previewOpen
                  ? "flex min-h-0 flex-1 flex-col"
                  : "hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
              }
            >
              {!catalogReady ? (
                <div className="mb-3 border-[1.5px] border-line-strong bg-surface-2 px-4 py-3">
                  <p className="text-[15px] font-semibold">
                    A termékek még másolódnak
                  </p>
                  <p className="mt-1 text-[14px] text-faint">
                    A kereső a bolton még nem lesz teljes.
                  </p>
                </div>
              ) : null}
              <div className="min-h-0 flex-1">
                <WidgetLivePreview
                  buttonLabel={buttonLabel}
                  fabColor={fabColor}
                  fabInk={settings.appearance.fabInk}
                  fabInkCustom={settings.appearance.fabInkCustom}
                  fabStyle={settings.appearance.fabStyle}
                  fabPosition={settings.appearance.fabPosition}
                  fabSize={settings.appearance.fabSize}
                  panelTheme={settings.appearance.panelTheme}
                  modules={settings.features.modules}
                  showTurinovaMark={!settings.features.hideTurinovaMark}
                  showCustomerGroupName={
                    settings.features.showCustomerGroupName
                  }
                  showNextLevelProgress={
                    settings.features.showNextLevelProgress
                  }
                  showFreeShippingProgress={false}
                  freeShippingThresholdGross={null}
                  freeShippingThresholdLabel={undefined}
                  showPanel={showPanel}
                  onShowPanel={setShowPanel}
                  showFab={settings.launch.showFab}
                  presentation={settings.launch.presentation}
                />
              </div>
            </div>
          </section>

          <aside className="flex min-h-0 flex-col bg-bg lg:overflow-hidden">
            <div
              className="sticky top-0 z-10 flex border-b border-line-strong bg-bg"
              role="tablist"
              aria-label="Beállítások"
            >
              {TABS.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(t.id)}
                    className={
                      active
                        ? "min-h-12 flex-1 cursor-pointer border-b-2 border-text px-2 text-[15px] font-semibold text-text"
                        : "min-h-12 flex-1 cursor-pointer border-b-2 border-transparent px-2 text-[15px] font-medium text-faint hover:text-text"
                    }
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 pb-12 md:px-5">
              {tab === "button" ? (
                <>
                  <Field
                    title="Mutassam a gombot?"
                    hint="Ha nem, a menüből nyílik."
                    dense
                  >
                    <BigToggle
                      label={
                        settings.launch.showFab
                          ? "Igen, legyen gomb"
                          : "Nem, csak menüből"
                      }
                      checked={settings.launch.showFab}
                      onChange={(v) => patchLaunch({ showFab: v })}
                    />
                    {!settings.launch.showFab ? (
                      <div className="mt-2 border-[1.5px] border-line-strong bg-surface-2 px-3 py-2.5">
                        <p className="text-[13px] leading-snug text-text">
                          Menü link:{" "}
                          <code className="font-mono font-semibold">
                            {menuLink}
                          </code>
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="tn-btn tn-btn-ghost !h-10 px-3 text-[13px]"
                            onClick={() => void copyMenuLink()}
                          >
                            {copied ? "Kész" : "Másol"}
                          </button>
                          {isEmbed ? (
                            <Link
                              href="/sr-embed"
                              className="text-[13px] font-semibold text-text underline underline-offset-2"
                            >
                              Telepítés: Kezdőlap
                            </Link>
                          ) : (
                            <a
                              href="#widget-install"
                              className="text-[13px] font-semibold text-text underline underline-offset-2"
                            >
                              Telepítés: kód lent
                            </a>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </Field>

                  <Field title="Felirat" dense>
                    <input
                      className="tn-input !h-10 w-full !text-[14px]"
                      value={buttonLabel}
                      onChange={(e) => {
                        setButtonLabel(e.target.value);
                        markDirty();
                      }}
                      placeholder="Gyors rendelés"
                    />
                  </Field>

                  <Field title="Stílus" dense>
                    <ChoiceGrid
                      cols={3}
                      value={settings.appearance.fabStyle as FabStyleId}
                      options={FAB_STYLE_PRESETS.map((p) => ({
                        id: p.id as FabStyleId,
                        label: p.label,
                      }))}
                      onChange={(id) => patchAppearance({ fabStyle: id })}
                    />
                  </Field>

                  <Field
                    title="Háttér"
                    hint="Előre megadott, vagy saját."
                    dense
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      {WIDGET_THEME_PRESETS.map((t) => {
                        const usingCustom = Boolean(
                          settings.appearance.fabColorCustom,
                        );
                        const active =
                          !usingCustom &&
                          settings.appearance.themeId === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            title={t.label}
                            aria-label={t.label}
                            onClick={() => {
                              setSettings((s) => ({
                                ...s,
                                appearance: applyWidgetTheme(
                                  s.appearance,
                                  t.id,
                                ),
                                launch: {
                                  ...s.launch,
                                  profileId: "custom",
                                },
                              }));
                              markDirty();
                            }}
                            className={
                              active
                                ? "h-9 w-9 border-2 border-text"
                                : "h-9 w-9 border-[1.5px] border-line-strong hover:border-text"
                            }
                            style={{ background: t.fabColor }}
                          />
                        );
                      })}
                      <label
                        className={
                          settings.appearance.fabColorCustom
                            ? "relative flex h-9 w-9 cursor-pointer items-center justify-center border-2 border-text bg-surface"
                            : "relative flex h-9 w-9 cursor-pointer items-center justify-center border-[1.5px] border-dashed border-line-strong bg-surface hover:border-text"
                        }
                        title="Saját szín"
                      >
                        <span className="text-[10px] font-bold text-faint">
                          +
                        </span>
                        <input
                          type="color"
                          className="absolute inset-0 cursor-pointer opacity-0"
                          value={
                            settings.appearance.fabColorCustom || fabColor
                          }
                          onChange={(e) => {
                            const hex = normalizeFabHex(e.target.value);
                            if (!hex) return;
                            patchAppearance({
                              fabColorCustom: hex,
                              fabColorPreset: "custom",
                            });
                          }}
                        />
                      </label>
                    </div>
                    {settings.appearance.fabColorCustom ? (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          className="tn-input !h-9 w-[7.5rem] !font-mono !text-[13px] uppercase"
                          value={settings.appearance.fabColorCustom}
                          onChange={(e) => {
                            const hex = normalizeFabHex(e.target.value);
                            patchAppearance({
                              fabColorCustom: hex,
                              fabColorPreset: hex ? "custom" : "shoprenter_blue",
                            });
                          }}
                          placeholder="#007AFF"
                        />
                        <button
                          type="button"
                          className="text-[13px] font-semibold text-faint underline underline-offset-2 hover:text-text"
                          onClick={() => {
                            setSettings((s) => ({
                              ...s,
                              appearance: applyWidgetTheme(
                                s.appearance,
                                s.appearance.themeId || "ocean",
                              ),
                              launch: {
                                ...s.launch,
                                profileId: "custom",
                              },
                            }));
                            markDirty();
                          }}
                        >
                          Törlés
                        </button>
                      </div>
                    ) : null}
                  </Field>

                  <Field
                    title="Betűszín"
                    hint="Fehér, fekete, vagy saját."
                    dense
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      {FAB_INK_PRESETS.map((p) => {
                        const active =
                          settings.appearance.fabInk === p.id &&
                          !settings.appearance.fabInkCustom;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            title={p.label}
                            aria-label={p.label}
                            onClick={() =>
                              patchAppearance({
                                fabInk: p.id,
                                fabInkCustom: null,
                              })
                            }
                            className={
                              active
                                ? "h-9 w-9 border-2 border-text"
                                : "h-9 w-9 border-[1.5px] border-line-strong hover:border-text"
                            }
                            style={{ background: p.color }}
                          />
                        );
                      })}
                      <label
                        className={
                          settings.appearance.fabInk === "custom"
                            ? "relative flex h-9 w-9 cursor-pointer items-center justify-center border-2 border-text bg-surface"
                            : "relative flex h-9 w-9 cursor-pointer items-center justify-center border-[1.5px] border-dashed border-line-strong bg-surface hover:border-text"
                        }
                        title="Saját betűszín"
                      >
                        <span className="text-[10px] font-bold text-faint">
                          +
                        </span>
                        <input
                          type="color"
                          className="absolute inset-0 cursor-pointer opacity-0"
                          value={
                            settings.appearance.fabInkCustom || "#FFFFFF"
                          }
                          onChange={(e) => {
                            const hex = normalizeFabHex(e.target.value);
                            if (!hex) return;
                            patchAppearance({
                              fabInk: "custom",
                              fabInkCustom: hex,
                            });
                          }}
                        />
                      </label>
                    </div>
                    {settings.appearance.fabInk === "custom" &&
                    settings.appearance.fabInkCustom ? (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          className="tn-input !h-9 w-[7.5rem] !font-mono !text-[13px] uppercase"
                          value={settings.appearance.fabInkCustom}
                          onChange={(e) => {
                            const hex = normalizeFabHex(e.target.value);
                            if (!hex) {
                              patchAppearance({
                                fabInk: "white",
                                fabInkCustom: null,
                              });
                              return;
                            }
                            patchAppearance({
                              fabInk: "custom",
                              fabInkCustom: hex,
                            });
                          }}
                          placeholder="#FFFFFF"
                        />
                        <button
                          type="button"
                          className="text-[13px] font-semibold text-faint underline underline-offset-2 hover:text-text"
                          onClick={() =>
                            patchAppearance({
                              fabInk: "white",
                              fabInkCustom: null,
                            })
                          }
                        >
                          Törlés
                        </button>
                      </div>
                    ) : null}
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field title="Hol" dense>
                      <ChoiceGrid
                        cols={2}
                        value={positionId}
                        options={FAB_POSITION_PRESETS.map((p) => ({
                          id: p.id as FabPositionId,
                          label: p.label.replace(" lent", ""),
                        }))}
                        onChange={(id) =>
                          patchAppearance({ fabPosition: id })
                        }
                      />
                    </Field>
                    <Field title="Méret" dense>
                      <ChoiceGrid
                        cols={2}
                        value={settings.appearance.fabSize as FabSizeId}
                        options={FAB_SIZE_PRESETS.map((p) => ({
                          id: p.id as FabSizeId,
                          label:
                            p.id === "icon_label" ? "Teljes" : "Ikon",
                        }))}
                        onChange={(id) =>
                          patchAppearance({ fabSize: id })
                        }
                      />
                    </Field>
                  </div>
                </>
              ) : null}

              {tab === "extra" ? (
                <>
                  <Field
                    title="Kezdőlap"
                    hint="Újrarendelés és javaslatok a panel elején."
                    dense
                  >
                    <BigToggle
                      label={
                        settings.features.modules.includes("insights")
                          ? "Be van kapcsolva"
                          : "Ki van kapcsolva"
                      }
                      hint="Ki kapcsolva egyből a rendelés nézet nyílik."
                      checked={settings.features.modules.includes("insights")}
                      onChange={(v) => setModuleOn("insights", v)}
                    />
                  </Field>

                  <Field
                    title="Partner motiváció"
                    hint="Opcionális — a láblécben jelenik meg."
                    dense
                  >
                    <div className="space-y-1.5">
                      <BigToggle
                        label="Csoportnév"
                        hint="Melyik partnercsoportban van."
                        checked={settings.features.showCustomerGroupName}
                        onChange={(v) => {
                          setSettings((s) => ({
                            ...s,
                            features: {
                              ...s.features,
                              showCustomerGroupName: v,
                            },
                            launch: {
                              ...s.launch,
                              profileId: "custom",
                            },
                          }));
                          markDirty();
                        }}
                      />
                      <BigToggle
                        label="Következő szint"
                        hint="Mennyi van a következő ársávig."
                        checked={settings.features.showNextLevelProgress}
                        onChange={(v) => {
                          setSettings((s) => ({
                            ...s,
                            features: {
                              ...s.features,
                              showNextLevelProgress: v,
                            },
                            launch: {
                              ...s.launch,
                              profileId: "custom",
                            },
                          }));
                          markDirty();
                        }}
                      />
                    </div>
                  </Field>

                  {!isEmbed && snippet ? (
                    <Field
                      title="Telepítés"
                      hint="A kód a téma láblécébe kerül."
                      dense
                    >
                      <div id="widget-install" className="space-y-2">
                        <pre className="overflow-x-auto border-[1.5px] border-line-strong bg-surface-2 p-3 text-[11px] leading-relaxed text-text">
                          {snippet}
                        </pre>
                        <button
                          type="button"
                          className="tn-btn tn-btn-ghost !h-10 px-3 text-[13px]"
                          onClick={() => void copySnippet()}
                        >
                          {snippetCopied ? "Kész" : "Kód másolása"}
                        </button>
                      </div>
                    </Field>
                  ) : null}
                </>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
  );

  if (isEmbed) {
    return (
      <EmbedShell
        shopName={resolvedShopName}
        storeUrl={storeUrl}
        fullBleed
        saveSlot={saveSlot}
      >
        {editorBody}
      </EmbedShell>
    );
  }

  return editorBody;
}
