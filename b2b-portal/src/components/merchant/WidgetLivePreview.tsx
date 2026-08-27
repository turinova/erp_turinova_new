"use client";

import {
  FAB_SIZE_PRESETS,
  LOCKED_PANEL_THEME,
  PANEL_THEME_PRESETS,
  resolveFabVisual,
  resolvePanelThemeTokens,
  type FabInkId,
  type FabPositionId,
  type FabSizeId,
  type FabStyleId,
  type PanelThemeId,
  type WidgetModuleId,
} from "@/lib/widget/presets";

type Props = {
  buttonLabel: string;
  fabColor: string;
  fabInk?: FabInkId;
  fabStyle: FabStyleId;
  fabPosition: FabPositionId;
  fabSize: FabSizeId;
  panelTheme: PanelThemeId;
  modules: WidgetModuleId[];
  showTurinovaMark?: boolean;
  /** Mirror widget partner FOMO footer. */
  showCustomerGroupName?: boolean;
  showNextLevelProgress?: boolean;
  showPanel: boolean;
  onShowPanel: (open: boolean) => void;
};

const S = {
  bg: "#F7F7F5",
  surface: "#FFFFFF",
  ink: "#111111",
  muted: "#5C5C5C",
  faint: "#8A8A8A",
  line: "rgba(0,0,0,.1)",
  lineStrong: "rgba(0,0,0,.45)",
};

/** Unsplash — hardware / home fixtures (stable crop URLs) */
const HERO_IMG =
  "https://images.unsplash.com/photo-1556912173-46c336c7fd55?auto=format&fit=crop&w=1400&q=80";

const PRODUCTS = [
  {
    name: "Króm kilincs",
    price: "4.120 Ft",
    img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=600&q=80",
  },
  {
    name: "Zár 55 mm",
    price: "2.490 Ft",
    img: "https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=600&q=80",
  },
  {
    name: "Ajtópánt pár",
    price: "1.890 Ft",
    img: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=600&q=80",
  },
  {
    name: "Zárbetét",
    price: "3.650 Ft",
    img: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=600&q=80",
  },
  {
    name: "Fogantyú",
    price: "5.200 Ft",
    img: "https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=600&q=80",
  },
  {
    name: "Ajtóütköző",
    price: "980 Ft",
    img: "https://images.unsplash.com/photo-1565182999561-18d7dc61c393?auto=format&fit=crop&w=600&q=80",
  },
] as const;

function ListIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function fabPosClass(position: FabPositionId): string {
  switch (position) {
    case "bottom_left":
      return "left-4 bottom-4 right-auto top-auto";
    case "bottom_right":
    default:
      return "right-4 bottom-4 left-auto top-auto";
  }
}

function StorefrontMock() {
  return (
    <div
      className="absolute inset-0 overflow-auto"
      style={{ background: S.bg, color: S.ink }}
      aria-hidden
    >
      {/* Top bar */}
      <div
        className="flex h-8 items-center justify-between px-4 text-[10px]"
        style={{ background: S.ink, color: "rgba(255,255,255,.75)" }}
      >
        <span>Ingyenes szállítás 25.000 Ft felett</span>
        <span>Belépés</span>
      </div>

      {/* Header */}
      <div
        className="flex h-12 items-center gap-3 border-b px-4"
        style={{ background: S.surface, borderColor: S.line }}
      >
        <span
          className="text-[15px] font-semibold tracking-tight"
          style={{ letterSpacing: "-0.03em" }}
        >
          Vasalat
        </span>
        <nav
          className="ml-4 hidden gap-4 text-[11px] font-medium sm:flex"
          style={{ color: S.muted }}
        >
          <span>Zárak</span>
          <span>Kilincsek</span>
          <span>Pántok</span>
          <span>Akció</span>
        </nav>
        <div
          className="ml-auto hidden h-8 w-36 items-center rounded-none border px-3 text-[11px] sm:flex"
          style={{ borderColor: S.line, color: S.faint, background: S.bg }}
        >
          Keresés…
        </div>
        <span
          className="ml-2 inline-flex h-8 items-center rounded-none px-3 text-[11px] font-semibold text-white"
          style={{ background: S.ink }}
        >
          Kosár · 2
        </span>
      </div>

      {/* Real hero — full-bleed photo + overlay */}
      <div className="relative mx-0 overflow-hidden" style={{ minHeight: 168 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_IMG}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(0,0,0,.72) 0%, rgba(0,0,0,.35) 55%, rgba(0,0,0,.15) 100%)",
          }}
        />
        <div className="relative flex min-h-[168px] flex-col justify-end px-5 py-5 text-white sm:min-h-[200px] sm:py-7">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/70">
            Új kollekció
          </p>
          <p
            className="mt-1 max-w-[16rem] text-[22px] font-semibold leading-[1.1] tracking-tight sm:text-[26px]"
            style={{ letterSpacing: "-0.04em" }}
          >
            Zárak és kilincsek otthonra
          </p>
          <span
            className="mt-3 inline-flex h-8 w-fit items-center rounded-none px-3.5 text-[12px] font-semibold"
            style={{ background: "#fff", color: S.ink }}
          >
            Megnézem
          </span>
        </div>
      </div>

      {/* Product grid with real photos */}
      <div className="px-3 pb-20 pt-4">
        <div className="mb-3 flex items-baseline justify-between px-1">
          <p className="text-[13px] font-semibold tracking-tight">
            Népszerű termékek
          </p>
          <span className="text-[11px]" style={{ color: S.faint }}>
            24 termék
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {PRODUCTS.map((p) => (
            <article
              key={p.name}
              className="overflow-hidden rounded-none border bg-white"
              style={{ borderColor: S.line }}
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-[#eee]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.img}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="p-2.5">
                <p className="text-[11px] font-semibold leading-snug">{p.name}</p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <p className="text-[12px] font-bold">{p.price}</p>
                  <span
                    className="inline-flex h-6 items-center rounded-none px-2 text-[9px] font-semibold text-white"
                    style={{ background: S.ink }}
                  >
                    Kosárba
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Demo partner progress — matches real widget FOMO footer layout. */
const PREVIEW_PARTNER = {
  groupName: "Asztalosok",
  remainingLabel: "184 200 Ft",
  nextGroupName: "Arany partner",
  progressPercent: 62,
  rewardHeadline: "−12% kedvezmény",
  rewardDetail: "Az árlistás termékekre",
  urgency: "mid" as const,
};

function PartnerFomoPreview({
  theme,
  showGroupName,
  showProgress,
}: {
  theme: ReturnType<typeof resolvePanelThemeTokens>;
  showGroupName: boolean;
  showProgress: boolean;
}) {
  if (!showGroupName && !showProgress) return null;
  const accent = theme.accent;
  const warn = theme.warn;
  const gapEmColor =
    PREVIEW_PARTNER.urgency === "mid" || PREVIEW_PARTNER.urgency === "high"
      ? warn
      : accent;

  return (
    <div
      className="flex min-w-0 flex-1 flex-col gap-1.5"
      style={{ maxWidth: 520 }}
      data-urgency={showProgress ? PREVIEW_PARTNER.urgency : undefined}
    >
      {showGroupName ? (
        <div className="flex min-w-0 items-center">
          <span
            className="inline-flex h-6 items-center whitespace-nowrap px-2.5 text-[11px] font-bold tracking-tight"
            style={{
              borderRadius: 6,
              background: "rgba(15,123,108,.12)",
              border: "1px solid rgba(15,123,108,.45)",
              color: accent,
            }}
          >
            {PREVIEW_PARTNER.groupName}
          </span>
        </div>
      ) : null}

      {showProgress ? (
        <>
          <p
            className="m-0 text-[15px] font-extrabold leading-tight tracking-tight"
            style={{ color: theme.text }}
          >
            Még{" "}
            <em className="not-italic font-extrabold" style={{ color: gapEmColor }}>
              {PREVIEW_PARTNER.remainingLabel}
            </em>
          </p>
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className="h-2.5 min-w-0 flex-1 overflow-hidden"
              style={{
                borderRadius: 5,
                background: "rgba(55,53,47,.12)",
              }}
            >
              <i
                className="block h-full not-italic"
                style={{
                  width: `${PREVIEW_PARTNER.progressPercent}%`,
                  borderRadius: 5,
                  background: accent,
                }}
              />
            </div>
            <span className="inline-flex max-w-[48%] shrink-0 items-center gap-1.5">
              <span
                className="shrink-0 text-[12px] font-bold"
                style={{ color: theme.faint }}
              >
                →
              </span>
              <span
                className="inline-flex h-6 max-w-full items-center truncate px-2.5 text-[11px] font-bold text-white"
                style={{
                  borderRadius: 6,
                  background: accent,
                  border: `1px solid ${accent}`,
                  boxShadow: `0 1px 2px ${accent}40`,
                }}
              >
                {PREVIEW_PARTNER.nextGroupName}
              </span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex h-7 items-center px-3 text-[12px] font-bold"
              style={{
                borderRadius: 6,
                background: "#FFF4E5",
                border: "1px solid #F5C57A",
                color: "#9A3412",
              }}
            >
              <em className="not-italic">{PREVIEW_PARTNER.rewardHeadline}</em>
            </span>
          </div>
          <p
            className="m-0 text-[11px] leading-snug"
            style={{ color: theme.muted }}
          >
            {PREVIEW_PARTNER.rewardDetail}
          </p>
        </>
      ) : null}
    </div>
  );
}

export function WidgetLivePreview({
  buttonLabel,
  fabColor,
  fabInk = "auto",
  fabStyle,
  fabPosition,
  fabSize,
  panelTheme: _panelTheme,
  modules,
  showTurinovaMark = true,
  showCustomerGroupName = false,
  showNextLevelProgress = false,
  showPanel,
  onShowPanel,
}: Props) {
  const sizeMeta =
    FAB_SIZE_PRESETS.find((p) => p.id === fabSize) ?? FAB_SIZE_PRESETS[0];
  const visual = resolveFabVisual(fabStyle, fabColor, fabInk);
  const theme = resolvePanelThemeTokens(LOCKED_PANEL_THEME, fabColor);
  const moduleOn = (id: WidgetModuleId) => modules.includes(id);

  const tabs = [
    moduleOn("insights") ? "Kezdőlap" : null,
    "Új megrendelés",
    moduleOn("orders") ? "Rendeléseim" : null,
  ].filter(Boolean) as string[];

  const showLabel = sizeMeta.showLabel;
  const compact = sizeMeta.compact;
  const isLarge = false;
  const labelOnly = false;

  return (
    <div className="flex h-full min-h-[420px] flex-col overflow-hidden border border-line-strong bg-surface">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b-[1.5px] border-line-strong bg-surface-2 px-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-text">Élő előnézet</p>
          <p className="truncate text-[10px] text-faint">
            Válts nézetet jobbra →
          </p>
        </div>
        <div
          className="inline-flex shrink-0 gap-0.5 border-[1.5px] border-text bg-bg p-1"
          role="tablist"
          aria-label="Előnézet nézet"
        >
          <button
            type="button"
            role="tab"
            aria-selected={!showPanel}
            onClick={() => onShowPanel(false)}
            className={
              !showPanel
                ? "h-8 min-w-[4.5rem] cursor-pointer bg-accent px-3 text-[12px] font-bold text-white"
                : "h-8 min-w-[4.5rem] cursor-pointer px-3 text-[12px] font-semibold text-faint hover:bg-surface-2 hover:text-text"
            }
          >
            Gomb
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={showPanel}
            onClick={() => onShowPanel(true)}
            className={
              showPanel
                ? "h-8 min-w-[4.5rem] cursor-pointer bg-accent px-3 text-[12px] font-bold text-white"
                : "h-8 min-w-[4.5rem] cursor-pointer px-3 text-[12px] font-semibold text-faint hover:bg-surface-2 hover:text-text"
            }
          >
            Widget
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <StorefrontMock />

        {!showPanel ? (
          <div
            className={`absolute z-[2] inline-flex items-center justify-center transition-[left,right,bottom,top,padding,min-height] duration-150 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${fabPosClass(fabPosition)}`}
            style={{
              gap: showLabel ? 8 : 0,
              minHeight: isLarge ? 52 : compact ? 40 : 44,
              minWidth: showLabel ? undefined : compact ? 40 : 44,
              padding: showLabel
                ? isLarge
                  ? "14px 20px"
                  : compact
                    ? "8px 12px"
                    : "10px 16px"
                : labelOnly
                  ? "12px 18px"
                  : "0",
              borderRadius: 999,
              background: visual.background,
              color: visual.color,
              border: visual.border,
              backdropFilter: visual.backdrop,
              WebkitBackdropFilter: visual.backdrop,
              boxShadow: visual.boxShadow,
              fontSize: compact ? 12 : 13,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              pointerEvents: "none",
            }}
            aria-hidden
          >
            {!labelOnly ? <ListIcon color="currentColor" /> : null}
            {showLabel ? <span>{buttonLabel || "Gyors rendelés"}</span> : null}
          </div>
        ) : (
          <div
            className="absolute inset-0 z-[3] flex flex-col overflow-hidden"
            style={{
              background: theme.bg,
              color: theme.text,
              ["--p-accent" as string]: theme.accent,
            }}
          >
            <div
              className="flex h-11 shrink-0 items-center gap-2 border-b px-3"
              style={{
                background: theme.topbar,
                borderColor: theme.lineStrong,
              }}
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-none"
                style={{
                  background: theme.accent,
                  color: "#fff",
                }}
              >
                <ListIcon color="#fff" />
              </span>
              <span className="text-[12px] font-semibold tracking-tight">
                {buttonLabel || "Gyors rendelés"}
              </span>
              <span
                className="ml-auto rounded-none border px-2 py-1 text-[11px] font-medium"
                style={{
                  color: theme.text,
                  background: theme.surface2,
                  borderColor: theme.lineStrong,
                }}
              >
                Kilépés
              </span>
            </div>
            <div
              className="flex justify-center border-b px-2 py-1.5"
              style={{
                background: theme.bg,
                borderColor: theme.line,
              }}
            >
              <div
                className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-none p-0.5"
                style={{ background: theme.navTrack }}
              >
                {tabs.map((tab, i) => (
                  <span
                    key={tab}
                    className="shrink-0 rounded-none px-2.5 py-1 text-[11px] font-semibold"
                    style={
                      i === (moduleOn("insights") ? 1 : 0)
                        ? {
                            background: theme.navActive,
                            color: theme.text,
                            boxShadow:
                              "0 0.5px 1px rgba(0,0,0,.18), 0 1px 3px rgba(0,0,0,.12)",
                          }
                        : { color: theme.muted, fontWeight: 500 }
                    }
                  >
                    {tab}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <div
                className="flex items-center gap-2 border-b px-3 py-2"
                style={{ borderColor: theme.line, background: theme.surface }}
              >
                <div
                  className="min-h-9 flex-1 px-3 py-2 text-[12px]"
                  style={{
                    background: theme.bg,
                    border: `0.5px solid ${theme.lineStrong}`,
                    color: theme.muted,
                  }}
                >
                  Cikkszám / gyártói / vonalkód
                </div>
                <span
                  className="inline-flex h-9 shrink-0 items-center px-3 text-[11px] font-semibold"
                  style={{
                    background: theme.accent,
                    color: "#fff",
                  }}
                >
                  Hozzáad
                </span>
              </div>
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <p
                  className="text-[13px] font-semibold"
                  style={{ color: theme.text }}
                >
                  Cikkszám, gyártói szám vagy vonalkód. Enter, és bent van.
                </p>
                <p className="mt-1.5 text-[11px]" style={{ color: theme.muted }}>
                  Excel, lista vagy fotó a kereső mellett. Bezárás után a lista
                  megmarad.
                </p>
              </div>
              <div
                className="flex items-end justify-between gap-3 border-t px-3 py-2.5"
                style={{
                  borderColor: theme.lineStrong,
                  background: theme.bg,
                  minHeight: showCustomerGroupName || showNextLevelProgress ? 96 : undefined,
                }}
              >
                {showCustomerGroupName || showNextLevelProgress ? (
                  <PartnerFomoPreview
                    theme={theme}
                    showGroupName={showCustomerGroupName}
                    showProgress={showNextLevelProgress}
                  />
                ) : (
                  <span className="text-[11px]" style={{ color: theme.muted }}>
                    Cikkszám, majd Enter. Ha kész: Kosárba.
                  </span>
                )}
                <span
                  className="inline-flex h-8 shrink-0 items-center self-center px-3 text-[11px] font-semibold"
                  style={{ background: theme.accent, color: "#fff" }}
                >
                  Kosárba rakom
                </span>
              </div>
            </div>
            {showTurinovaMark ? (
              <a
                href="https://turinova.hu"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Turinova"
                className="flex h-9 shrink-0 items-center justify-center border-t no-underline"
                style={{
                  borderColor: theme.line,
                  background: theme.bg,
                }}
                onClick={(e) => e.preventDefault()}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/turinova-logo.png"
                  alt="Turinova"
                  height={20}
                  style={{ height: 20, width: "auto", display: "block", opacity: 0.94 }}
                />
              </a>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-line-strong px-3 py-2 text-[10px] text-faint">
        <span className="font-mono">{fabColor}</span>
        <span>·</span>
        <span>
          {PANEL_THEME_PRESETS.find((p) => p.id === LOCKED_PANEL_THEME)?.label ??
            LOCKED_PANEL_THEME}
        </span>
        <span>·</span>
        <span>{modules.length} mód</span>
      </div>
    </div>
  );
}
