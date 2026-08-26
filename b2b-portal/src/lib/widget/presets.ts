/** Widget appearance / feature presets — shared by portal UI + runtime config.
 * Color direction: Apple HIG + Notion neutrals (not purple SaaS).
 */

/** Jobs / Apple / Notion — short labels, vivid fills that don’t look muddy. */
export const FAB_COLOR_PRESETS = [
  { id: "shoprenter_blue", label: "Kék", color: "#007AFF" },
  { id: "platform_teal", label: "Zöld", color: "#1A9B84" },
  { id: "charcoal", label: "Éjjel", color: "#000000" },
  { id: "ember", label: "Nap", color: "#FF9F0A" },
  { id: "custom", label: "Saját", color: null as string | null },
] as const;

/** Letter color on solid/glass FAB — Auto follows contrast. */
export const FAB_INK_PRESETS = [
  { id: "auto", label: "Auto" },
  { id: "white", label: "Fehér" },
  { id: "black", label: "Fekete" },
] as const;

export const FAB_STYLE_PRESETS = [
  { id: "solid", label: "Tömör", hint: "Erős, egyértelmű" },
  { id: "glass", label: "Üveg", hint: "Áttetsző, selymes" },
  { id: "outline", label: "Keret", hint: "Világos háttéren" },
  { id: "soft", label: "Lágy", hint: "Halvány szín" },
  { id: "contrast", label: "Éles", hint: "Fekete-fehér" },
] as const;

export const FAB_POSITION_PRESETS = [
  {
    id: "bottom_right",
    label: "Jobb lent",
    css: {
      right: "20px",
      left: "auto",
      bottom: "max(20px, env(safe-area-inset-bottom, 0px))",
      top: "auto",
    },
  },
  {
    id: "bottom_left",
    label: "Bal lent",
    css: {
      left: "20px",
      right: "auto",
      bottom: "max(20px, env(safe-area-inset-bottom, 0px))",
      top: "auto",
    },
  },
  {
    id: "bottom_right_mobile_offset",
    label: "Jobb, kosár fölött",
    css: {
      right: "20px",
      left: "auto",
      bottom: "max(80px, calc(20px + env(safe-area-inset-bottom, 0px)))",
      top: "auto",
    },
  },
  {
    id: "bottom_left_mobile_offset",
    label: "Bal, kosár fölött",
    css: {
      left: "20px",
      right: "auto",
      bottom: "max(80px, calc(20px + env(safe-area-inset-bottom, 0px)))",
      top: "auto",
    },
  },
  {
    id: "bottom_right_raised",
    label: "Jobb, magasan",
    css: {
      right: "20px",
      left: "auto",
      bottom: "max(96px, calc(72px + env(safe-area-inset-bottom, 0px)))",
      top: "auto",
    },
  },
] as const;

export const FAB_SIZE_PRESETS = [
  { id: "icon_label", label: "Teljes", showLabel: true, compact: false },
  { id: "compact", label: "Kicsi", showLabel: true, compact: true },
  { id: "large", label: "Nagy", showLabel: true, compact: false },
  { id: "label_only", label: "Szöveg", showLabel: true, compact: false },
  { id: "icon_only", label: "Ikon", showLabel: false, compact: true },
] as const;

export const PANEL_THEME_PRESETS = [
  { id: "light_glass", label: "Papír" },
  { id: "light_flat", label: "Tiszta" },
  { id: "dark", label: "Éjjel" },
  { id: "high_contrast", label: "Olvasó" },
  { id: "brand_tinted", label: "Márka" },
] as const;

export const WIDGET_MODULES = [
  { id: "search", label: "Kereső" },
  { id: "excel", label: "Excel" },
  { id: "email", label: "Lista" },
  { id: "image", label: "Kép" },
  { id: "orders", label: "Rendelések" },
  { id: "insights", label: "Javaslatok" },
] as const;

export type FabColorPresetId = (typeof FAB_COLOR_PRESETS)[number]["id"];
export type FabInkId = (typeof FAB_INK_PRESETS)[number]["id"];
export type FabStyleId = (typeof FAB_STYLE_PRESETS)[number]["id"];
export type FabPositionId = (typeof FAB_POSITION_PRESETS)[number]["id"];
export type FabSizeId = (typeof FAB_SIZE_PRESETS)[number]["id"];
export type PanelThemeId = (typeof PANEL_THEME_PRESETS)[number]["id"];
export type WidgetModuleId = (typeof WIDGET_MODULES)[number]["id"];

export type WidgetAppearance = {
  fabColorPreset: FabColorPresetId;
  fabColorCustom: string | null;
  fabInk: FabInkId;
  fabStyle: FabStyleId;
  fabPosition: FabPositionId;
  fabSize: FabSizeId;
  panelTheme: PanelThemeId;
};

export type WidgetFeatures = {
  requireLogin: boolean;
  modules: WidgetModuleId[];
  /** Preference only — public config ignores unless paid Pro and not trial. */
  hideTurinovaMark: boolean;
  /** Show SR customer group name in the widget panel. */
  showCustomerGroupName: boolean;
  /** Show “még X a következő csoporthoz” progress (FOMO). */
  showNextLevelProgress: boolean;
};

export type WidgetSettingsPayload = {
  appearance: WidgetAppearance;
  features: WidgetFeatures;
};

export type PublicWidgetConfig = {
  enabled: boolean;
  buttonLabel: string;
  allowedGroupIds: number[];
  requireLogin: boolean;
  fabColor: string;
  fabInk: FabInkId;
  fabStyle: FabStyleId;
  fabPosition: FabPositionId;
  fabSize: FabSizeId;
  panelTheme: PanelThemeId;
  modules: WidgetModuleId[];
  showLabel: boolean;
  compact: boolean;
  catalogStatus?: string;
  catalogReady?: boolean;
  showTurinovaMark?: boolean;
  showCustomerGroupName?: boolean;
  showNextLevelProgress?: boolean;
};

export const DEFAULT_WIDGET_SETTINGS: WidgetSettingsPayload = {
  appearance: {
    fabColorPreset: "shoprenter_blue",
    fabColorCustom: null,
    fabInk: "auto",
    fabStyle: "solid",
    fabPosition: "bottom_right",
    fabSize: "icon_label",
    panelTheme: "high_contrast",
  },
  features: {
    requireLogin: true,
    modules: ["search", "excel", "email", "image", "orders", "insights"],
    hideTurinovaMark: false,
    showCustomerGroupName: false,
    showNextLevelProgress: false,
  },
};

function isHexColor(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v.trim());
}

function pickId<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function normalizeWidgetSettings(
  raw: unknown,
  buttonLabelFallback = "Gyors rendelés",
): WidgetSettingsPayload {
  const obj =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const appearanceRaw =
    obj.appearance && typeof obj.appearance === "object"
      ? (obj.appearance as Record<string, unknown>)
      : obj;
  const featuresRaw =
    obj.features && typeof obj.features === "object"
      ? (obj.features as Record<string, unknown>)
      : {};

  const colorIds = FAB_COLOR_PRESETS.map((p) => p.id);
  const inkIds = FAB_INK_PRESETS.map((p) => p.id);
  const styleIds = FAB_STYLE_PRESETS.map((p) => p.id);
  const posIds = FAB_POSITION_PRESETS.map((p) => p.id);
  const sizeIds = FAB_SIZE_PRESETS.map((p) => p.id);
  const custom = appearanceRaw.fabColorCustom;
  // Login + modules are product core — not merchant-configurable.

  return {
    appearance: {
      fabColorPreset: pickId(
        appearanceRaw.fabColorPreset,
        colorIds,
        DEFAULT_WIDGET_SETTINGS.appearance.fabColorPreset,
      ),
      fabColorCustom: isHexColor(custom) ? custom.trim() : null,
      fabInk: pickId(
        appearanceRaw.fabInk,
        inkIds,
        DEFAULT_WIDGET_SETTINGS.appearance.fabInk,
      ),
      fabStyle: pickId(
        appearanceRaw.fabStyle,
        styleIds,
        DEFAULT_WIDGET_SETTINGS.appearance.fabStyle,
      ),
      fabPosition: pickId(
        (() => {
          const raw = appearanceRaw.fabPosition;
          if (raw === "middle_left") return "bottom_right";
          if (raw === "middle_right") return "bottom_right";
          return raw;
        })(),
        posIds,
        DEFAULT_WIDGET_SETTINGS.appearance.fabPosition,
      ),
      fabSize: pickId(
        appearanceRaw.fabSize,
        sizeIds,
        DEFAULT_WIDGET_SETTINGS.appearance.fabSize,
      ),
      panelTheme: "high_contrast",
    },
    features: {
      requireLogin: true,
      modules: [...DEFAULT_WIDGET_SETTINGS.features.modules],
      hideTurinovaMark: featuresRaw.hideTurinovaMark === true,
      showCustomerGroupName: featuresRaw.showCustomerGroupName === true,
      showNextLevelProgress: featuresRaw.showNextLevelProgress === true,
    },
  };
}

export function resolveFabColor(appearance: WidgetAppearance): string {
  if (appearance.fabColorPreset === "custom" && appearance.fabColorCustom) {
    return appearance.fabColorCustom;
  }
  const preset = FAB_COLOR_PRESETS.find((p) => p.id === appearance.fabColorPreset);
  return preset?.color ?? "#007AFF";
}

/** Resolve letter color for solid/glass fills. */
export function resolveFabInk(mode: FabInkId, bgHex: string): string {
  if (mode === "white") return "#FFFFFF";
  if (mode === "black") return "#1C1C1E";
  return contrastingInk(bgHex);
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  if (full.length !== 6) return `rgba(0,122,255,${alpha})`;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Relative luminance 0–1 (sRGB). */
export function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  if (full.length !== 6) return 0;
  const toLin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = toLin(parseInt(full.slice(0, 2), 16));
  const g = toLin(parseInt(full.slice(2, 4), 16));
  const b = toLin(parseInt(full.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(hexA: string, hexB: string): number {
  const L1 = relativeLuminance(hexA);
  const L2 = relativeLuminance(hexB);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

/** Pick white or near-black label for solid/glass FAB — max contrast, not a fixed L cut. */
export function contrastingInk(bgHex: string): string {
  const white = contrastRatio("#FFFFFF", bgHex);
  const dark = contrastRatio("#1C1C1E", bgHex);
  return dark >= white ? "#1C1C1E" : "#FFFFFF";
}

export type PanelThemeTokens = {
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  muted: string;
  faint: string;
  line: string;
  lineStrong: string;
  accent: string;
  accentSoft: string;
  /** Frosted top chrome */
  topbar: string;
  /** Segmented control track */
  navTrack: string;
  /** Active nav chip */
  navActive: string;
  ok: string;
  warn: string;
  danger: string;
};

/**
 * Apple HIG + Notion neutrals.
 * Dark: system backgrounds (#000 / #1C1C1E / #2C2C2E), secondary label #98989D.
 */
export function resolvePanelThemeTokens(
  theme: PanelThemeId,
  brandAccent: string,
): PanelThemeTokens {
  const brand = brandAccent || "#0F7B6C";
  switch (theme) {
    case "light_flat":
      // Apple light grouped background — muted darkened past system gray for AA
      return {
        bg: "#F2F2F7",
        surface: "#FFFFFF",
        surface2: "#E5E5EA",
        text: "#1C1C1E",
        muted: "#636366",
        faint: "#8E8E93",
        line: "rgba(60,60,67,.12)",
        lineStrong: "rgba(60,60,67,.29)",
        accent: brand,
        accentSoft: hexToRgba(brand, 0.12),
        topbar: "rgba(242,242,247,.92)",
        navTrack: "rgba(118,118,128,.12)",
        navActive: "#FFFFFF",
        ok: "#248A3D",
        warn: "#C2410C",
        danger: "#D70015",
      };
    case "dark":
      // Apple dark — lighter muted so inactive nav chips read on the track
      return {
        bg: "#000000",
        surface: "#1C1C1E",
        surface2: "#2C2C2E",
        text: "#F5F5F7",
        muted: "#AEAEB2",
        faint: "#8E8E93",
        line: "rgba(84,84,88,.65)",
        lineStrong: "rgba(142,142,147,.45)",
        accent: "#0A84FF",
        accentSoft: "rgba(10,132,255,.22)",
        topbar: "rgba(28,28,30,.92)",
        navTrack: "rgba(118,118,128,.24)",
        navActive: "#636366",
        ok: "#30D158",
        warn: "#FF9F0A",
        danger: "#FF453A",
      };
    case "high_contrast":
      return {
        bg: "#FFFFFF",
        surface: "#FFFFFF",
        surface2: "#F2F2F2",
        text: "#000000",
        muted: "#1C1C1E",
        faint: "#3A3A3C",
        line: "rgba(0,0,0,.45)",
        lineStrong: "rgba(0,0,0,.75)",
        accent: "#000000",
        accentSoft: "rgba(0,0,0,.08)",
        topbar: "#FFFFFF",
        navTrack: "rgba(0,0,0,.08)",
        navActive: "#FFFFFF",
        ok: "#008009",
        warn: "#A05000",
        danger: "#D70015",
      };
    case "brand_tinted":
      return {
        bg: "#F7F6F3",
        surface: "#FFFFFF",
        surface2: "#EFEEE9",
        text: "#37352F",
        muted: "#5F5E5A",
        faint: "#9B9A97",
        line: "rgba(55,53,47,.09)",
        lineStrong: "rgba(55,53,47,.16)",
        accent: brand,
        accentSoft: hexToRgba(brand, 0.12),
        topbar: "rgba(247,246,243,.9)",
        navTrack: "rgba(55,53,47,.08)",
        navActive: "#FFFFFF",
        ok: "#0F7B6C",
        warn: "#C2410C",
        danger: "#E03E3E",
      };
    case "light_glass":
    default:
      // Notion default canvas
      return {
        bg: "#F7F6F3",
        surface: "#FFFFFF",
        surface2: "#EFEEE9",
        text: "#37352F",
        muted: "#5F5E5A",
        faint: "#9B9A97",
        line: "rgba(55,53,47,.09)",
        lineStrong: "rgba(55,53,47,.16)",
        accent: brand,
        accentSoft: hexToRgba(brand, 0.1),
        topbar: "rgba(247,246,243,.86)",
        navTrack: "rgba(55,53,47,.08)",
        navActive: "#FFFFFF",
        ok: "#0F7B6C",
        warn: "#C2410C",
        danger: "#E03E3E",
      };
  }
}

export type FabVisual = {
  background: string;
  color: string;
  border: string;
  backdrop: string;
  boxShadow: string;
};

export function resolveFabVisual(
  style: FabStyleId,
  color: string,
  inkMode: FabInkId = "auto",
): FabVisual {
  const ink = resolveFabInk(inkMode, color);
  if (style === "outline") {
    return {
      background: "#FFFFFF",
      color,
      border: `1.5px solid ${color}`,
      backdrop: "none",
      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    };
  }
  if (style === "soft") {
    return {
      background: hexToRgba(color, 0.12),
      color,
      border: `0.5px solid ${hexToRgba(color, 0.28)}`,
      backdrop: "none",
      boxShadow: "none",
    };
  }
  if (style === "contrast") {
    return {
      background: "#000000",
      color: "#FFFFFF",
      border: "0.5px solid rgba(255,255,255,0.45)",
      backdrop: "none",
      boxShadow: "0 8px 20px rgba(0,0,0,0.28)",
    };
  }
  if (style === "solid") {
    return {
      background: color,
      color: ink,
      border: "0.5px solid transparent",
      backdrop: "none",
      boxShadow: "0 6px 16px rgba(0,0,0,0.14)",
    };
  }
  // glass — slightly clearer, less muddy
  return {
    background: hexToRgba(color, 0.92),
    color: ink,
    border: "0.5px solid rgba(255,255,255,0.35)",
    backdrop: "saturate(1.2) blur(14px)",
    boxShadow:
      "0 8px 20px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.22)",
  };
}

/** Stress-test theme × fab style readability (WCAG AA ~4.5 for text). */
export function stressTestThemeCombos(): {
  theme: PanelThemeId;
  check: string;
  ratio: number;
  ok: boolean;
}[] {
  const themes: PanelThemeId[] = [
    "light_glass",
    "light_flat",
    "dark",
    "high_contrast",
    "brand_tinted",
  ];
  const brands = FAB_COLOR_PRESETS.filter((p) => p.color).map((p) => p.color!);
  const out: {
    theme: PanelThemeId;
    check: string;
    ratio: number;
    ok: boolean;
  }[] = [];
  for (const theme of themes) {
    for (const brand of brands) {
      const t = resolvePanelThemeTokens(theme, brand);
      const pairs: [string, string, string][] = [
        ["text/bg", t.text, t.bg],
        ["text/surface", t.text, t.surface],
        ["muted/surface", t.muted, t.surface],
        [
          "muted/navTrackApprox",
          t.muted,
          theme === "dark" ? "#3A3A3C" : t.surface2,
        ],
        ["navActiveText", t.text, t.navActive],
      ];
      for (const [check, fg, bg] of pairs) {
        const ratio = contrastRatio(fg, bg);
        // muted secondary UI: AA large text (3:1); primary text: AA normal (4.5:1)
        const min = check.startsWith("muted/") ? 3 : 4.5;
        out.push({
          theme,
          check: `${check}@${brand}`,
          ratio: Math.round(ratio * 100) / 100,
          ok: ratio >= min,
        });
      }
      for (const style of ["solid", "glass", "outline", "soft"] as const) {
        const fab = resolveFabVisual(style, brand, "auto");
        const fg = fab.color;
        const bg =
          style === "outline" || style === "soft" ? "#FFFFFF" : brand;
        const fabRatio = contrastRatio(fg, bg);
        out.push({
          theme,
          check: `fab${style}@${brand}`,
          ratio: Math.round(fabRatio * 100) / 100,
          ok: fabRatio >= 3,
        });
      }
    }
  }
  return out;
}

export function resolvePublicWidgetConfig(input: {
  enabled: boolean;
  buttonLabel: string;
  allowedGroupIds: number[];
  settings: unknown;
}): PublicWidgetConfig {
  const normalized = normalizeWidgetSettings(input.settings, input.buttonLabel);
  const size = FAB_SIZE_PRESETS.find(
    (p) => p.id === normalized.appearance.fabSize,
  )!;
  return {
    enabled: input.enabled,
    buttonLabel: input.buttonLabel || "Gyors rendelés",
    allowedGroupIds: input.allowedGroupIds,
    requireLogin: normalized.features.requireLogin,
    fabColor: resolveFabColor(normalized.appearance),
    fabInk: normalized.appearance.fabInk,
    fabStyle: normalized.appearance.fabStyle,
    fabPosition: normalized.appearance.fabPosition,
    fabSize: normalized.appearance.fabSize,
    panelTheme: normalized.appearance.panelTheme,
    modules: normalized.features.modules,
    showLabel: size.showLabel,
    compact: size.compact,
    showTurinovaMark: true,
    showCustomerGroupName: normalized.features.showCustomerGroupName,
    showNextLevelProgress: normalized.features.showNextLevelProgress,
  };
}

export function positionCss(position: FabPositionId): Record<string, string> {
  const preset = FAB_POSITION_PRESETS.find((p) => p.id === position);
  return { ...(preset?.css ?? FAB_POSITION_PRESETS[0].css) };
}
