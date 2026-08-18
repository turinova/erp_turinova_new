"use client";

import {
  FAB_SIZE_PRESETS,
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
  showPanel: boolean;
  onTogglePanel: () => void;
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
    case "bottom_left_mobile_offset":
      return "left-4 bottom-20 right-auto top-auto";
    case "bottom_right_mobile_offset":
      return "right-4 bottom-20 left-auto top-auto";
    case "bottom_right_raised":
      return "right-4 bottom-24 left-auto top-auto";
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

export function WidgetLivePreview({
  buttonLabel,
  fabColor,
  fabInk = "auto",
  fabStyle,
  fabPosition,
  fabSize,
  panelTheme,
  modules,
  showTurinovaMark = true,
  showPanel,
  onTogglePanel,
}: Props) {
  const sizeMeta = FAB_SIZE_PRESETS.find((p) => p.id === fabSize)!;
  const visual = resolveFabVisual(fabStyle, fabColor, fabInk);
  const theme = resolvePanelThemeTokens(panelTheme, fabColor);
  const moduleOn = (id: WidgetModuleId) => modules.includes(id);

  const tabs = [
    moduleOn("insights") ? "Kezdőlap" : null,
    "Új megrendelés",
    moduleOn("orders") ? "Rendeléseim" : null,
  ].filter(Boolean) as string[];

  const showLabel = sizeMeta.showLabel;
  const compact = sizeMeta.compact;
  const isLarge = fabSize === "large";
  const labelOnly = fabSize === "label_only";

  return (
    <div className="flex h-full min-h-[420px] flex-col overflow-hidden border border-line-strong bg-surface">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-line-strong px-3">
        <p className="text-[11px] font-semibold text-faint">Élő előnézet</p>
        <button
          type="button"
          onClick={onTogglePanel}
          className="tn-btn tn-btn-ghost !h-7 !px-2.5 text-[11px]"
        >
          {showPanel ? "Sarokban" : "Megnyitás"}
        </button>
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
                  Cikkszám, gyártói szám vagy vonalkód — Enter, és bent van.
                </p>
                <p className="mt-1.5 text-[11px]" style={{ color: theme.muted }}>
                  Excel, lista vagy fotó a kereső mellett. Bezárás után a lista
                  megmarad.
                </p>
              </div>
              <div
                className="flex items-center justify-between border-t px-3 py-2"
                style={{ borderColor: theme.lineStrong, background: theme.bg }}
              >
                <span className="text-[11px]" style={{ color: theme.muted }}>
                  Cikkszám, majd Enter. Ha kész: Kosárba.
                </span>
                <span
                  className="inline-flex h-8 items-center px-3 text-[11px] font-semibold"
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
          {PANEL_THEME_PRESETS.find((p) => p.id === panelTheme)?.label ??
            panelTheme}
        </span>
        <span>·</span>
        <span>{modules.length} mód</span>
      </div>
    </div>
  );
}
