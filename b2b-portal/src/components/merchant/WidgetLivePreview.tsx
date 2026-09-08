"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FAB_SIZE_PRESETS,
  resolveFabVisual,
  type FabInkId,
  type FabPositionId,
  type FabSizeId,
  type FabStyleId,
  type PanelThemeId,
  type WidgetModuleId,
} from "@/lib/widget/presets";
import {
  PREVIEW_MESSAGE_SOURCE,
  type PreviewConfigPayload,
  type PreviewHostMessage,
  type PreviewSandboxMessage,
} from "@/lib/widget/preview-protocol";
import { WIDGET_JS_ASSET } from "@/lib/widget/asset-version";

/** Virtual laptop viewport so widget.js media queries stay desktop. */
const DESKTOP_W = 1200;
const DESKTOP_H = 780;

type Props = {
  buttonLabel: string;
  fabColor: string;
  fabInk?: FabInkId;
  fabInkCustom?: string | null;
  fabStyle: FabStyleId;
  fabPosition: FabPositionId;
  fabSize: FabSizeId;
  fabRingChase?: boolean;
  panelTheme: PanelThemeId;
  modules: WidgetModuleId[];
  showTurinovaMark?: boolean;
  showCustomerGroupName?: boolean;
  showNextLevelProgress?: boolean;
  showFreeShippingProgress?: boolean;
  freeShippingThresholdLabel?: string;
  freeShippingThresholdGross?: number | null;
  showPanel: boolean;
  onShowPanel: (open: boolean) => void;
  showFab?: boolean;
  presentation?: "auto" | "fullscreen" | "drawer";
};

const S = {
  bg: "#F7F7F5",
  surface: "#FFFFFF",
  ink: "#111111",
  muted: "#5C5C5C",
  faint: "#8A8A8A",
  line: "rgba(0,0,0,.1)",
};

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
      <div
        className="flex h-8 items-center justify-between px-4 text-[10px]"
        style={{ background: S.ink, color: "rgba(255,255,255,.75)" }}
      >
        <span>Demo bolt</span>
        <span>Belépés</span>
      </div>

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

function buildConfig(props: {
  buttonLabel: string;
  fabColor: string;
  fabInk?: FabInkId;
  fabInkCustom?: string | null;
  fabStyle: FabStyleId;
  fabPosition: FabPositionId;
  fabSize: FabSizeId;
  fabRingChase?: boolean;
  panelTheme: PanelThemeId;
  modules: WidgetModuleId[];
  showTurinovaMark?: boolean;
  showCustomerGroupName?: boolean;
  showNextLevelProgress?: boolean;
  showFreeShippingProgress?: boolean;
  freeShippingThresholdLabel?: string;
  freeShippingThresholdGross?: number | null;
  showFab?: boolean;
}): PreviewConfigPayload {
  const sizeMeta =
    FAB_SIZE_PRESETS.find((p) => p.id === props.fabSize) ?? FAB_SIZE_PRESETS[0];
  const threshold =
    typeof props.freeShippingThresholdGross === "number" &&
    props.freeShippingThresholdGross > 0
      ? props.freeShippingThresholdGross
      : 50_000;

  return {
    buttonLabel: props.buttonLabel || "Gyors rendelés",
    fabColor: props.fabColor,
    fabInk: props.fabInk ?? "auto",
    fabInkCustom: props.fabInkCustom ?? "",
    fabStyle: props.fabStyle,
    fabPosition: props.fabPosition,
    fabSize: props.fabSize,
    fabRingChase: props.fabRingChase === true,
    panelTheme: props.panelTheme,
    modules: props.modules,
    showTurinovaMark: props.showTurinovaMark !== false,
    showCustomerGroupName: !!props.showCustomerGroupName,
    showNextLevelProgress: !!props.showNextLevelProgress,
    /* FAB lives on React mock in Gomb mode; hide inside iframe always */
    showFab: false,
    hideFab: true,
    showLabel: sizeMeta.showLabel,
    compact: sizeMeta.compact,
    freeShipping: props.showFreeShippingProgress
      ? {
          enabled: true,
          thresholdGross: threshold,
          thresholdLabel: props.freeShippingThresholdLabel ?? null,
        }
      : null,
  };
}

function postToFrame(
  win: Window | null | undefined,
  msg: PreviewHostMessage,
) {
  if (!win) return;
  try {
    win.postMessage(msg, window.location.origin);
  } catch {
    /* ignore */
  }
}

/**
 * Hybrid preview:
 * - Gomb: rich storefront mock + FAB (laptop-facing shop context)
 * - Widget: real widget.js in a scaled 1200px desktop viewport
 */
export function WidgetLivePreview(props: Props) {
  const { showPanel, onShowPanel, showFab = true } = props;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const [frameReady, setFrameReady] = useState(false);
  const [frameError, setFrameError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const lastPanelRef = useRef<boolean | null>(null);
  const configRef = useRef<PreviewConfigPayload | null>(null);
  const showPanelRef = useRef(showPanel);
  const onShowPanelRef = useRef(onShowPanel);

  useEffect(() => {
    const id = "sr-fab-ring-chase-css";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent =
      "@keyframes sr-fab-ring-chase{to{transform:rotate(360deg)}}" +
      "@media (prefers-reduced-motion:reduce){.sr-fab-ring-chase-el{animation:none!important}}";
    document.head.appendChild(style);
  }, []);

  const sizeMeta =
    FAB_SIZE_PRESETS.find((p) => p.id === props.fabSize) ?? FAB_SIZE_PRESETS[0];
  const visual = resolveFabVisual(
    props.fabStyle,
    props.fabColor,
    props.fabInk ?? "auto",
    props.fabInkCustom,
  );
  const showLabel = sizeMeta.showLabel;
  const compact = sizeMeta.compact;

  const config = useMemo(
    () =>
      buildConfig({
        buttonLabel: props.buttonLabel,
        fabColor: props.fabColor,
        fabInk: props.fabInk,
        fabInkCustom: props.fabInkCustom,
        fabStyle: props.fabStyle,
        fabPosition: props.fabPosition,
        fabSize: props.fabSize,
        fabRingChase: props.fabRingChase,
        panelTheme: props.panelTheme,
        modules: props.modules,
        showTurinovaMark: props.showTurinovaMark,
        showCustomerGroupName: props.showCustomerGroupName,
        showNextLevelProgress: props.showNextLevelProgress,
        showFreeShippingProgress: props.showFreeShippingProgress,
        freeShippingThresholdLabel: props.freeShippingThresholdLabel,
        freeShippingThresholdGross: props.freeShippingThresholdGross,
        showFab: props.showFab,
      }),
    [
      props.buttonLabel,
      props.fabColor,
      props.fabInk,
      props.fabInkCustom,
      props.fabStyle,
      props.fabPosition,
      props.fabSize,
      props.fabRingChase,
      props.panelTheme,
      props.modules,
      props.showTurinovaMark,
      props.showCustomerGroupName,
      props.showNextLevelProgress,
      props.showFreeShippingProgress,
      props.freeShippingThresholdLabel,
      props.freeShippingThresholdGross,
      props.showFab,
    ],
  );

  configRef.current = config;
  showPanelRef.current = showPanel;
  onShowPanelRef.current = onShowPanel;

  const previewSrc = `/widget-preview?v=${WIDGET_JS_ASSET}`;

  useEffect(() => {
    setFrameReady(false);
    setFrameError(null);
    lastPanelRef.current = null;
  }, [previewSrc]);

  useEffect(() => {
    const el = paneRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      const next = Math.min(box.width / DESKTOP_W, box.height / DESKTOP_H, 1);
      setScale(Number.isFinite(next) && next > 0 ? next : 1);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      const data = ev.data as PreviewSandboxMessage | null;
      if (!data || data.source !== PREVIEW_MESSAGE_SOURCE) return;

      if (data.type === "ready") {
        setFrameReady(true);
        setFrameError(null);
        const win = iframeRef.current?.contentWindow;
        const cfg = configRef.current;
        if (cfg) {
          postToFrame(win, {
            source: PREVIEW_MESSAGE_SOURCE,
            type: "configure",
            config: cfg,
          });
        }
        postToFrame(win, {
          source: PREVIEW_MESSAGE_SOURCE,
          type: "setPanel",
          open: showPanelRef.current,
        });
        lastPanelRef.current = showPanelRef.current;
        return;
      }
      if (data.type === "panelClosed") {
        lastPanelRef.current = false;
        onShowPanelRef.current(false);
        return;
      }
      if (data.type === "error") {
        setFrameError(data.message || "Előnézet hiba");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!frameReady) return;
    const win = iframeRef.current?.contentWindow;
    const t = window.setTimeout(() => {
      postToFrame(win, {
        source: PREVIEW_MESSAGE_SOURCE,
        type: "configure",
        config,
      });
    }, 80);
    return () => window.clearTimeout(t);
  }, [config, frameReady]);

  useEffect(() => {
    if (!frameReady) return;
    if (lastPanelRef.current === showPanel) return;
    lastPanelRef.current = showPanel;
    postToFrame(iframeRef.current?.contentWindow, {
      source: PREVIEW_MESSAGE_SOURCE,
      type: "setPanel",
      open: showPanel,
    });
  }, [showPanel, frameReady]);

  return (
    <div className="flex h-full min-h-[420px] flex-col overflow-hidden border border-line-strong bg-surface">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b-[1.5px] border-line-strong bg-surface-2 px-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-text">Élő előnézet</p>
          <p className="truncate text-[10px] text-faint">
            {showPanel
              ? "Laptop nézet · csak kinézet"
              : "Webshop + gomb · így látja a partner"}
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

      <div ref={paneRef} className="relative min-h-0 flex-1 overflow-hidden bg-[#E8E8E4]">
        {/* Gomb: rich storefront + FAB */}
        {!showPanel ? (
          <div className="absolute inset-0 z-[2]">
            <StorefrontMock />
            {showFab ? (
              <button
                type="button"
                onClick={() => onShowPanel(true)}
                className={`absolute z-[3] inline-flex cursor-pointer items-center justify-center transition-[left,right,bottom,top,padding,min-height] duration-150 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${fabPosClass(props.fabPosition)}`}
                style={{
                  gap: showLabel ? 8 : 0,
                  minHeight: compact ? 40 : 44,
                  minWidth: showLabel ? undefined : compact ? 40 : 44,
                  padding: showLabel
                    ? compact
                      ? "8px 12px"
                      : "10px 16px"
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
                  overflow: props.fabRingChase ? "visible" : undefined,
                  isolation: "isolate",
                  // CSS var for ring color
                  ["--sr-qo-ring" as string]: props.fabColor,
                }}
                aria-label={`${props.buttonLabel || "Gyors rendelés"} megnyitása`}
              >
                {props.fabRingChase ? (
                  <span
                    aria-hidden
                    className="sr-fab-ring-chase-el pointer-events-none absolute z-0 rounded-[inherit]"
                    style={{
                      inset: -3,
                      padding: 2,
                      background: `conic-gradient(from 0deg, transparent 0 58%, ${props.fabColor} 72%, #fff 86%, ${props.fabColor} 94%, transparent 100%)`,
                      WebkitMask:
                        "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                      WebkitMaskComposite: "xor",
                      mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                      maskComposite: "exclude",
                      animation: "sr-fab-ring-chase 1.85s linear infinite",
                    }}
                  />
                ) : null}
                <span className="relative z-[1] inline-flex items-center justify-center gap-[inherit]">
                  <ListIcon color="currentColor" />
                  {showLabel ? (
                    <span>{props.buttonLabel || "Gyors rendelés"}</span>
                  ) : null}
                </span>
              </button>
            ) : (
              <p className="absolute bottom-4 left-4 right-4 z-[3] text-center text-[11px] text-faint">
                A lebegő gomb ki van kapcsolva — a Widget fülön az ablakot látod.
              </p>
            )}
          </div>
        ) : null}

        {/* Widget: scaled desktop iframe (kept mounted) */}
        <div
          className={
            showPanel
              ? "absolute inset-0 z-[1] flex items-start justify-center overflow-hidden"
              : "invisible absolute inset-0 z-0 overflow-hidden"
          }
          aria-hidden={!showPanel}
        >
          {showPanel && !frameReady && !frameError ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface/80 text-[13px] text-faint">
              Widget betöltése…
            </div>
          ) : null}
          {showPanel && frameError ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface px-4 text-center text-[13px] text-danger">
              {frameError}
            </div>
          ) : null}
          <div
            style={{
              width: DESKTOP_W * scale,
              height: DESKTOP_H * scale,
              position: "relative",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: DESKTOP_W,
                height: DESKTOP_H,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                pointerEvents: "none",
              }}
            >
              <iframe
                ref={iframeRef}
                title="ProGate widget élő előnézet"
                src={previewSrc}
                className="border-0"
                style={{ width: DESKTOP_W, height: DESKTOP_H }}
                tabIndex={-1}
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
            {showPanel ? (
              <div
                className="pointer-events-none absolute inset-0 z-[2] flex items-start justify-end p-2"
                aria-hidden
              >
                <span className="border border-line-strong bg-surface/95 px-2 py-1 text-[10px] font-semibold text-faint shadow-sm">
                  Csak kinézet
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
