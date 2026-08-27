"use client";

import { useEffect, useMemo, useState } from "react";
import { WidgetLivePreview } from "@/components/merchant/WidgetLivePreview";
import { isLocalAppUrl } from "@/lib/public-app-url";
import type { MerchantWidgetDto } from "@/lib/widget/settings";
import {
  applyWidgetTheme,
  contrastingInk,
  DEFAULT_WIDGET_SETTINGS,
  FAB_POSITION_PRESETS,
  FAB_SIZE_PRESETS,
  FAB_STYLE_PRESETS,
  normalizeWidgetSettings,
  resolveFabColor,
  WIDGET_THEME_PRESETS,
  type FabPositionId,
  type FabSizeId,
  type FabStyleId,
  type WidgetSettingsPayload,
  type WidgetThemeId,
} from "@/lib/widget/presets";

type Props = { initial: MerchantWidgetDto; apiBase: string };
type TabId = "appear" | "install";

/** Notion/Apple: short chips, clear selected state — no purple SaaS pills. */
function ChipRow<T extends string>({
  label,
  value,
  options,
  onChange,
  segmented,
}: {
  label: string;
  value: T;
  options: { id: T; label: string; hint?: string }[];
  onChange: (id: T) => void;
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
  const [settings, setSettings] = useState<WidgetSettingsPayload>(() =>
    normalizeWidgetSettings(initial.settings),
  );
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

  /* Partner FOMO only visible in open panel — open preview when toggled on. */
  useEffect(() => {
    if (showCustomerGroupName || showNextLevelProgress) {
      setShowPanel(true);
    }
  }, [showCustomerGroupName, showNextLevelProgress]);

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

  function selectTheme(themeId: WidgetThemeId) {
    setSettings((s) => ({
      ...s,
      appearance: applyWidgetTheme(s.appearance, themeId),
    }));
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);

    const payload: WidgetSettingsPayload = {
      appearance: applyWidgetTheme(
        {
          ...settings.appearance,
        },
        settings.appearance.themeId,
      ),
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
      setSettings(normalizeWidgetSettings(data.widget.settings));
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
      setError("A másolás nem sikerült. Jelöld ki a kódot kézzel.");
    }
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "appear", label: "Nézet" },
    { id: "install", label: "Telepítés" },
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
          panelTheme={settings.appearance.panelTheme}
          modules={[...DEFAULT_WIDGET_SETTINGS.features.modules]}
          showTurinovaMark={
            initial.canHideTurinovaMark ? !hideTurinovaMark : true
          }
          showCustomerGroupName={showCustomerGroupName}
          showNextLevelProgress={showNextLevelProgress}
          showPanel={showPanel}
          onShowPanel={setShowPanel}
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
            !showPanel ? (
              <>
                <div>
                  <p className="text-[13px] font-semibold text-text">Gomb</p>
                  <p className="mt-0.5 text-[11px] text-faint">
                    Sarokban megjelenő gomb. A Widget nézetben a panel.
                  </p>
                </div>

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
                  <p className="text-[11px] font-semibold tracking-[-0.01em] text-muted">
                    Megjelenés
                  </p>
                  <p className="mt-0.5 text-[11px] text-faint">
                    Csak a gomb színe. A panel a portal kinézete.
                  </p>
                  <div
                    className="mt-2 grid grid-cols-5 gap-1.5"
                    role="radiogroup"
                    aria-label="Megjelenés"
                  >
                    {WIDGET_THEME_PRESETS.map((t) => {
                      const active = settings.appearance.themeId === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          title={t.hint}
                          onClick={() => selectTheme(t.id)}
                          className={
                            active
                              ? "flex cursor-pointer flex-col items-center gap-1.5 border-[1.5px] border-text bg-surface px-1 py-2"
                              : "flex cursor-pointer flex-col items-center gap-1.5 border-[0.5px] border-line bg-surface px-1 py-2 hover:border-line-strong"
                          }
                        >
                          <span
                            className="relative flex h-7 w-7 items-center justify-center border-[0.5px] border-black/15 text-[11px] font-bold"
                            style={{
                              background: t.fabColor,
                              color: contrastingInk(t.fabColor),
                            }}
                            aria-hidden
                          >
                            A
                          </span>
                          <span
                            className={
                              active
                                ? "text-[10px] font-semibold text-text"
                                : "text-[10px] font-medium text-faint"
                            }
                          >
                            {t.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <ChipRow
                  label="Gomb stílus"
                  segmented
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
                  label="Elhelyezés"
                  segmented
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
                  segmented
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
            ) : (
              <>
                <div>
                  <p className="text-[13px] font-semibold text-text">Widget</p>
                  <p className="mt-0.5 text-[11px] text-faint">
                    Mi jelenjen meg a megnyitott panelen.
                  </p>
                </div>

                <div className="border-[1.5px] border-line-strong bg-surface p-3">
                  <p className="text-[11px] font-semibold text-muted">
                    Partner a panelen
                  </p>
                  <div className="mt-2 space-y-2.5">
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
                        <span className="font-semibold">Csoportnév</span>
                        <span className="mt-0.5 block text-[11px] text-faint">
                          Pl. „Csoportod: Asztalosok”.
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
                        <span className="font-semibold">Következő szint</span>
                        <span className="mt-0.5 block text-[11px] text-faint">
                          „Még X Ft…” az Automatizmus szabályokból.
                        </span>
                      </span>
                    </label>
                    <label
                      className={
                        initial.canHideTurinovaMark
                          ? "flex cursor-pointer items-start gap-2 text-[12px]"
                          : "flex items-start gap-2 text-[12px] text-faint"
                      }
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 accent-[var(--accent)]"
                        checked={
                          initial.canHideTurinovaMark ? !hideTurinovaMark : true
                        }
                        disabled={!initial.canHideTurinovaMark}
                        onChange={(e) => setHideTurinovaMark(!e.target.checked)}
                      />
                      <span>
                        <span className="font-semibold">
                          Turinova logó a panel alján
                        </span>
                        <span className="mt-0.5 block text-[11px] text-faint">
                          {initial.canHideTurinovaMark
                            ? "Kapcsold ki, ha a Turinova logó ne jelenjen meg (saját márka csomag)."
                            : initial.isTrial
                              ? "Próba alatt a logó ott marad. Fizetés után a saját márka (9999 Ft bruttó) opcióval leveheted."
                              : "A saját márka előfizetéssel (Előfizetésem) elrejtheted."}{" "}
                          {!initial.canHideTurinovaMark ? (
                            <a
                              href="/csomag"
                              className="font-semibold underline underline-offset-2"
                            >
                              Előfizetésem
                            </a>
                          ) : null}
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
              </>
            )
          ) : null}

          {tab === "install" ? (
            <div className="space-y-4">
              <div>
                <p className="text-[13px] font-semibold text-text">Telepítés</p>
                <p className="mt-0.5 text-[11px] text-faint">
                  A kód a téma láblécébe kerül. Utána megjelenik a gomb.
                </p>
              </div>

              {apiBaseLocal ? (
                <div className="border-[1.5px] border-line-strong bg-surface-2 p-3">
                  <p className="text-[13px] font-semibold">Még teszt mód</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-faint">
                    A valódi bolt nem fogadja a localhostot. Használd a{" "}
                    <span className="font-semibold text-text">
                      b2b.turinova.hu
                    </span>{" "}
                    címet, vagy futtasd:{" "}
                    <code className="rounded-none bg-surface px-1 font-mono text-[11px] text-text">
                      npm run tunnel
                    </code>
                    .
                  </p>
                </div>
              ) : null}

              <div>
                <p className="text-[11px] font-semibold text-muted">3 lépés</p>
                <ol className="mt-1.5 list-decimal space-y-1.5 pl-4 text-[12px] text-faint">
                  <li>
                    Shoprenter → Megjelenés →{" "}
                    <span className="font-semibold text-text">
                      Téma fájlkeresztő
                    </span>
                  </li>
                  <li>
                    Nyisd meg:{" "}
                    <code className="rounded-none bg-surface-2 px-1 font-mono text-[11px] text-text">
                      footer_scripts.tpl
                    </code>
                  </li>
                  <li>Illeszd be a kódot a fájl aljára → Mentés</li>
                </ol>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-muted">
                    A kód
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

              <div>
                <p className="text-[11px] font-semibold text-muted">
                  Menüpont is? (opcionális)
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-faint">
                  Új menü: név{" "}
                  <span className="font-semibold text-text">Gyors rendelés</span>
                  , link{" "}
                  <code className="rounded-none bg-surface-2 px-1 font-mono text-[11px] text-text">
                    #sr-b2b-qo
                  </code>
                  .
                </p>
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
