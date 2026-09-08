/** Widget appearance / feature presets — shared by portal UI + runtime config.
 * Color direction: Apple HIG + Notion neutrals + GitHub Primer (not purple SaaS).
 * Merchant picks one of 5 locked themes — not orthogonal color×ink×style.
 */

/** Letter color on solid/glass FAB. Legacy `auto` = contrast against fill. */
export const FAB_INK_PRESETS = [
  { id: "white", label: "Fehér", color: "#FFFFFF" },
  { id: "black", label: "Fekete", color: "#1C1C1E" },
] as const;

/** Includes legacy `auto` + `custom` (hex in fabInkCustom). */
export type FabInkId = "auto" | "white" | "black" | "custom";

/** Runtime FAB finishes — merchant picks separately from color theme. */
export const FAB_STYLE_PRESETS = [
  { id: "solid", label: "Tömör", hint: "Erős, egyértelmű" },
  { id: "glass", label: "Üveg", hint: "Liquid glass" },
  { id: "neon", label: "Neon", hint: "Izzó fény" },
] as const;

/**
 * Five curated color skins (Figma / Notion / GitHub).
 * Ink is "auto" → max WCAG contrast on the solid fill.
 * Finish (solid/glass/neon) is chosen separately.
 * Panel is always portal „Olvasó” (`high_contrast`) — themes only skin the FAB.
 */
export const WIDGET_THEME_PRESETS = [
  {
    id: "ocean",
    label: "Kék",
    hint: "Bizalom (iOS / Shoprenter)",
    fabColor: "#007AFF",
    fabInk: "auto" as const,
    panelTheme: "high_contrast" as const,
  },
  {
    id: "forest",
    label: "Zöld",
    hint: "Nyugodt (Notion teal)",
    fabColor: "#0F7B6C",
    fabInk: "auto" as const,
    panelTheme: "high_contrast" as const,
  },
  {
    id: "ink",
    label: "Éjjel",
    hint: "Sötét (GitHub Primer)",
    fabColor: "#24292F",
    fabInk: "auto" as const,
    panelTheme: "high_contrast" as const,
  },
  {
    id: "ember",
    label: "Nap",
    hint: "Meleg energia, sötét betű",
    fabColor: "#E8871E",
    fabInk: "auto" as const,
    panelTheme: "high_contrast" as const,
  },
  {
    id: "paper",
    label: "Papír",
    hint: "Minimal, fehér betű",
    fabColor: "#1C1C1E",
    fabInk: "auto" as const,
    panelTheme: "high_contrast" as const,
  },
] as const;

/** @deprecated Kept for DB migration / resolveFabColor fallback. */
export const FAB_COLOR_PRESETS = [
  { id: "shoprenter_blue", label: "Kék", color: "#007AFF" },
  { id: "platform_teal", label: "Zöld", color: "#0F7B6C" },
  { id: "charcoal", label: "Éjjel", color: "#24292F" },
  { id: "ember", label: "Nap", color: "#E8871E" },
  { id: "custom", label: "Saját", color: null as string | null },
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
] as const;

export const FAB_SIZE_PRESETS = [
  { id: "icon_label", label: "Teljes", showLabel: true, compact: false },
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
  { id: "email", label: "Beillesztés" },
  { id: "image", label: "Fotó" },
  { id: "orders", label: "Rendelések" },
  { id: "insights", label: "Javaslatok" },
] as const;

export type WidgetThemeId = (typeof WIDGET_THEME_PRESETS)[number]["id"];
export type FabColorPresetId = (typeof FAB_COLOR_PRESETS)[number]["id"];
export type FabStyleId = (typeof FAB_STYLE_PRESETS)[number]["id"];
export type FabPositionId = (typeof FAB_POSITION_PRESETS)[number]["id"];
export type FabSizeId = (typeof FAB_SIZE_PRESETS)[number]["id"];
export type PanelThemeId = (typeof PANEL_THEME_PRESETS)[number]["id"];
export type WidgetModuleId = (typeof WIDGET_MODULES)[number]["id"];

/** Always on for every tenant — not merchant/embed toggleable. */
export const LOCKED_IMPORT_MODULES: WidgetModuleId[] = [
  "excel",
  "email",
  "image",
];

/** Ensure search + import modules; keep optional orders/insights from input. */
export function ensureLockedWidgetModules(
  raw: WidgetModuleId[] | undefined | null,
): WidgetModuleId[] {
  const set = new Set<WidgetModuleId>(["search", ...LOCKED_IMPORT_MODULES]);
  for (const m of raw || []) {
    if (m === "orders" || m === "insights") set.add(m);
  }
  const order: WidgetModuleId[] = [
    "search",
    "excel",
    "email",
    "image",
    "orders",
    "insights",
  ];
  return order.filter((id) => set.has(id));
}

/** Panel chrome = portal app („Olvasó”) — never follows FAB theme. */
export const LOCKED_PANEL_THEME: PanelThemeId = "high_contrast";
/** Portal signal blue — same as globals.css --accent. */
export const LOCKED_PANEL_ACCENT = "#0B6BCB";
export const LOCKED_PANEL_ACCENT_SOFT = "#E8F3FC";

export type WidgetAppearance = {
  /** Locked skin — drives FAB color / ink. Panel stays portal „Olvasó”. */
  themeId: WidgetThemeId;
  /** @deprecated Derived from themeId for older readers. */
  fabColorPreset: FabColorPresetId;
  fabColorCustom: string | null;
  fabInk: FabInkId;
  /** Used when fabInk === "custom". */
  fabInkCustom: string | null;
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
  /** Show free-shipping threshold progress in footer + receipt. */
  showFreeShippingProgress: boolean;
};

export type WidgetFreeShippingSettings = {
  /** Manual free-shipping threshold in HUF gross. */
  manualGross: number | null;
};

export type WidgetLaunchSettings = {
  showFab: boolean;
  presentation: "auto" | "fullscreen" | "drawer";
  profileId: "visible" | "clean_b2b" | "discreet" | "custom";
  panelTitle: string;
  emptyMessage: string;
  loginMessage: string;
  homeView: "search" | "orders" | "empty";
  autoOpen: "never" | "hash";
};

export type WidgetSettingsPayload = {
  appearance: WidgetAppearance;
  features: WidgetFeatures;
  freeShipping: WidgetFreeShippingSettings;
  launch: WidgetLaunchSettings;
};

/** Resolved free-shipping FOMO for the storefront widget. */
export type PublicFreeShipping = {
  enabled: boolean;
  thresholdGross: number;
  thresholdLabel: string;
};

export type PublicWidgetConfig = {
  enabled: boolean;
  buttonLabel: string;
  allowedGroupIds: number[];
  requireLogin: boolean;
  fabColor: string;
  fabInk: FabInkId;
  /** Hex when fabInk is custom; otherwise null. */
  fabInkCustom?: string | null;
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
  freeShipping?: PublicFreeShipping | null;
  /** When false, storefront hides the FAB (menu/hash still open). */
  showFab?: boolean;
  /** Alias for widget.js (`hideFab`). */
  hideFab?: boolean;
  presentation?: WidgetLaunchSettings["presentation"];
  panelTitle?: string;
  emptyMessage?: string;
  loginMessage?: string;
  homeView?: WidgetLaunchSettings["homeView"];
  autoOpen?: WidgetLaunchSettings["autoOpen"];
};

export const DEFAULT_WIDGET_SETTINGS: WidgetSettingsPayload = {
  appearance: {
    themeId: "ocean",
    fabColorPreset: "shoprenter_blue",
    fabColorCustom: null,
    fabInk: "white",
    fabInkCustom: null,
    fabStyle: "glass",
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
    showFreeShippingProgress: false,
  },
  freeShipping: {
    manualGross: null,
  },
  launch: {
    showFab: true,
    presentation: "fullscreen",
    profileId: "visible",
    panelTitle: "Gyors rendelés",
    emptyMessage: "Írd be a cikkszámot, vagy tölts fel listát.",
    loginMessage: "Jelentkezz be a gyors rendeléshez.",
    homeView: "search",
    autoOpen: "hash",
  },
};

function formatThresholdHuf(amount: number): string {
  return (
    Math.round(amount).toLocaleString("hu-HU", { maximumFractionDigits: 0 }) +
    " Ft"
  );
}

function parsePositiveInt(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw);
  }
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return null;
}

/**
 * Resolve free-shipping FOMO from merchant manual threshold only.
 */
export function resolveFreeShippingPublic(input: {
  settings: WidgetSettingsPayload;
}): PublicFreeShipping | null {
  const { settings } = input;
  if (!settings.features.showFreeShippingProgress) return null;
  const threshold = settings.freeShipping.manualGross;
  if (threshold == null || threshold <= 0) return null;

  return {
    enabled: true,
    thresholdGross: threshold,
    thresholdLabel: formatThresholdHuf(threshold),
  };
}

function themeById(id: WidgetThemeId) {
  return WIDGET_THEME_PRESETS.find((t) => t.id === id) ?? WIDGET_THEME_PRESETS[0];
}

/** Map legacy color preset / hex → theme. */
function inferThemeId(appearanceRaw: Record<string, unknown>): WidgetThemeId {
  const rawTheme = appearanceRaw.themeId;
  if (
    typeof rawTheme === "string" &&
    WIDGET_THEME_PRESETS.some((t) => t.id === rawTheme)
  ) {
    return rawTheme as WidgetThemeId;
  }
  const colorPreset = appearanceRaw.fabColorPreset;
  if (colorPreset === "shoprenter_blue") return "ocean";
  if (colorPreset === "platform_teal") return "forest";
  if (colorPreset === "charcoal") return "ink";
  if (colorPreset === "ember") return "ember";
  if (colorPreset === "custom") {
    const custom =
      typeof appearanceRaw.fabColorCustom === "string"
        ? appearanceRaw.fabColorCustom.trim().toLowerCase()
        : "";
    if (custom === "#0f7b6c" || custom === "#1a9b84") return "forest";
    if (custom === "#24292f" || custom === "#000000") return "ink";
    if (custom === "#e8871e" || custom === "#ff9f0a") return "ember";
    if (custom === "#1c1c1e") return "paper";
  }
  return "ocean";
}

function mapPositionId(raw: unknown): FabPositionId {
  if (raw === "bottom_left" || raw === "bottom_left_mobile_offset") {
    return "bottom_left";
  }
  if (
    raw === "bottom_right" ||
    raw === "bottom_right_mobile_offset" ||
    raw === "bottom_right_raised" ||
    raw === "middle_left" ||
    raw === "middle_right"
  ) {
    return "bottom_right";
  }
  if (raw === "bottom_left") return "bottom_left";
  return "bottom_right";
}

function mapSizeId(raw: unknown): FabSizeId {
  if (raw === "icon_only") return "icon_only";
  /* compact / large / label_only / icon_label → Teljes */
  return "icon_label";
}

function mapStyleId(raw: unknown): FabStyleId {
  if (raw === "glass" || raw === "neon" || raw === "solid") return raw;
  /* Legacy finishes → closest new finish */
  if (raw === "soft" || raw === "outline") return "glass";
  if (raw === "contrast") return "neon";
  return DEFAULT_WIDGET_SETTINGS.appearance.fabStyle;
}

function themeToColorPreset(themeId: WidgetThemeId): FabColorPresetId {
  switch (themeId) {
    case "forest":
      return "platform_teal";
    case "ink":
      return "charcoal";
    case "ember":
      return "ember";
    case "paper":
      return "charcoal";
    default:
      return "shoprenter_blue";
  }
}

export function normalizeWidgetSettings(
  raw: unknown,
  buttonLabelFallback = "Gyors rendelés",
): WidgetSettingsPayload {
  void buttonLabelFallback;
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
  const freeShipRaw =
    obj.freeShipping && typeof obj.freeShipping === "object"
      ? (obj.freeShipping as Record<string, unknown>)
      : {};
  const launchRaw =
    obj.launch && typeof obj.launch === "object"
      ? (obj.launch as Record<string, unknown>)
      : {};

  const themeId = inferThemeId(appearanceRaw);
  const theme = themeById(themeId);

  const fabColorCustom = normalizeFabHex(appearanceRaw.fabColorCustom);
  const fabInkCustom = normalizeFabHex(appearanceRaw.fabInkCustom);
  const fabInkRaw = appearanceRaw.fabInk;
  let fabInk: FabInkId =
    fabInkRaw === "white" ||
    fabInkRaw === "black" ||
    fabInkRaw === "auto" ||
    fabInkRaw === "custom"
      ? fabInkRaw
      : theme.fabInk;
  if (fabInk === "custom" && !fabInkCustom) {
    fabInk = "white";
  }
  if (fabInkCustom && fabInkRaw !== "white" && fabInkRaw !== "black" && fabInkRaw !== "auto") {
    fabInk = "custom";
  }

  const panelThemeRaw = appearanceRaw.panelTheme;
  const panelTheme =
    typeof panelThemeRaw === "string" &&
    PANEL_THEME_PRESETS.some((p) => p.id === panelThemeRaw)
      ? (panelThemeRaw as PanelThemeId)
      : LOCKED_PANEL_THEME;

  const allowedModules = new Set(
    WIDGET_MODULES.map((m) => m.id as WidgetModuleId),
  );
  let modules: WidgetModuleId[] = [
    ...DEFAULT_WIDGET_SETTINGS.features.modules,
  ];
  if (Array.isArray(featuresRaw.modules)) {
    const parsed = featuresRaw.modules
      .filter((m): m is string => typeof m === "string")
      .filter((m): m is WidgetModuleId =>
        allowedModules.has(m as WidgetModuleId),
      );
    if (parsed.length) {
      modules = parsed.includes("search")
        ? parsed
        : (["search", ...parsed] as WidgetModuleId[]);
    }
  }
  modules = ensureLockedWidgetModules(modules);

  const presentation =
    launchRaw.presentation === "auto" ||
    launchRaw.presentation === "fullscreen" ||
    launchRaw.presentation === "drawer"
      ? launchRaw.presentation
      : DEFAULT_WIDGET_SETTINGS.launch.presentation;
  const profileId =
    launchRaw.profileId === "visible" ||
    launchRaw.profileId === "clean_b2b" ||
    launchRaw.profileId === "discreet" ||
    launchRaw.profileId === "custom"
      ? launchRaw.profileId
      : DEFAULT_WIDGET_SETTINGS.launch.profileId;
  const homeView =
    launchRaw.homeView === "search" ||
    launchRaw.homeView === "orders" ||
    launchRaw.homeView === "empty"
      ? launchRaw.homeView
      : DEFAULT_WIDGET_SETTINGS.launch.homeView;
  const autoOpen =
    launchRaw.autoOpen === "never" || launchRaw.autoOpen === "hash"
      ? launchRaw.autoOpen
      : DEFAULT_WIDGET_SETTINGS.launch.autoOpen;
  const launchStr = (key: string, fallback: string) => {
    const v = launchRaw[key];
    return typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : fallback;
  };

  return {
    appearance: {
      themeId,
      fabColorPreset: fabColorCustom
        ? ("custom" as FabColorPresetId)
        : themeToColorPreset(themeId),
      fabColorCustom,
      fabInk,
      fabInkCustom: fabInk === "custom" ? fabInkCustom : null,
      fabStyle: mapStyleId(appearanceRaw.fabStyle),
      fabPosition: mapPositionId(appearanceRaw.fabPosition),
      fabSize: mapSizeId(appearanceRaw.fabSize),
      panelTheme,
    },
    features: {
      requireLogin: featuresRaw.requireLogin === false ? false : true,
      modules,
      hideTurinovaMark: featuresRaw.hideTurinovaMark === true,
      showCustomerGroupName: featuresRaw.showCustomerGroupName === true,
      showNextLevelProgress: featuresRaw.showNextLevelProgress === true,
      showFreeShippingProgress: featuresRaw.showFreeShippingProgress === true,
    },
    freeShipping: {
      manualGross: parsePositiveInt(freeShipRaw.manualGross),
    },
    launch: {
      showFab: launchRaw.showFab === false ? false : true,
      presentation,
      profileId,
      panelTitle: launchStr(
        "panelTitle",
        DEFAULT_WIDGET_SETTINGS.launch.panelTitle,
      ),
      emptyMessage: launchStr(
        "emptyMessage",
        DEFAULT_WIDGET_SETTINGS.launch.emptyMessage,
      ),
      loginMessage: launchStr(
        "loginMessage",
        DEFAULT_WIDGET_SETTINGS.launch.loginMessage,
      ),
      homeView,
      autoOpen,
    },
  };
}

export function resolveFabColor(appearance: WidgetAppearance): string {
  const custom = appearance.fabColorCustom?.trim();
  if (custom && /^#[0-9a-fA-F]{6}$/.test(custom)) {
    return custom.toUpperCase();
  }
  if (custom && /^#[0-9a-fA-F]{3}$/.test(custom)) {
    const h = custom.slice(1);
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toUpperCase();
  }
  return themeById(appearance.themeId).fabColor;
}

/** Normalize merchant-picked hex or return null. */
export function normalizeFabHex(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let h = raw.trim().toLowerCase();
  if (!h) return null;
  if (h[0] !== "#") h = `#${h}`;
  if (/^#[0-9a-f]{3}$/.test(h)) {
    h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  if (!/^#[0-9a-f]{6}$/.test(h)) return null;
  return h.toUpperCase();
}

export function applyWidgetTheme(
  appearance: WidgetAppearance,
  themeId: WidgetThemeId,
): WidgetAppearance {
  const theme = themeById(themeId);
  return {
    ...appearance,
    themeId,
    fabColorPreset: themeToColorPreset(themeId),
    fabColorCustom: null,
    fabInk: theme.fabInk,
    fabInkCustom: null,
    /* Keep merchant-chosen finish + panel skin. */
    panelTheme: appearance.panelTheme ?? LOCKED_PANEL_THEME,
  };
}

/** Resolve letter color for solid/glass fills. */
export function resolveFabInk(
  mode: FabInkId,
  bgHex: string,
  customHex?: string | null,
): string {
  if (mode === "white") return "#FFFFFF";
  if (mode === "black") return "#1C1C1E";
  if (mode === "custom") {
    const c = normalizeFabHex(customHex);
    if (c) return c;
  }
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
      // Apple light grouped (legacy — locked panel uses high_contrast)
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
      // Portal „Olvasó” — white canvas, strong lines, signal blue (globals.css)
      return {
        bg: "#FFFFFF",
        surface: "#FFFFFF",
        surface2: "#F2F2F2",
        text: "#000000",
        muted: "#1C1C1E",
        faint: "#3A3A3C",
        line: "rgba(0,0,0,.45)",
        lineStrong: "rgba(0,0,0,.75)",
        accent: LOCKED_PANEL_ACCENT,
        accentSoft: LOCKED_PANEL_ACCENT_SOFT,
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
  inkCustom?: string | null,
): FabVisual {
  const ink = resolveFabInk(inkMode, color, inkCustom);

  if (style === "neon") {
    return {
      background: "#0A0A0C",
      color: "#FFFFFF",
      border: `1px solid ${hexToRgba(color, 0.9)}`,
      backdrop: "none",
      boxShadow: [
        `0 0 6px ${hexToRgba(color, 0.95)}`,
        `0 0 18px ${hexToRgba(color, 0.55)}`,
        `0 0 36px ${hexToRgba(color, 0.28)}`,
        `inset 0 0 14px ${hexToRgba(color, 0.18)}`,
      ].join(", "),
    };
  }

  if (style === "glass") {
    return {
      background: [
        `linear-gradient(155deg, ${hexToRgba("#FFFFFF", 0.48)} 0%, ${hexToRgba(color, 0.38)} 42%, ${hexToRgba(color, 0.72)} 100%)`,
      ].join(""),
      color: ink,
      border: `1px solid ${hexToRgba("#FFFFFF", 0.55)}`,
      backdrop: "saturate(180%) blur(18px)",
      boxShadow: [
        `0 10px 28px ${hexToRgba(color, 0.32)}`,
        "0 2px 8px rgba(0,0,0,0.12)",
        "inset 0 1px 0 rgba(255,255,255,0.55)",
        `inset 0 -1px 0 ${hexToRgba(color, 0.22)}`,
      ].join(", "),
    };
  }

  /* solid — slight top sheen so it isn’t a flat sticker */
  return {
    background: `linear-gradient(180deg, ${hexToRgba("#FFFFFF", 0.18)} 0%, transparent 42%), ${color}`,
    color: ink,
    border: `0.5px solid ${hexToRgba("#000000", 0.12)}`,
    backdrop: "none",
    boxShadow: [
      `0 8px 20px ${hexToRgba(color, 0.35)}`,
      "0 2px 6px rgba(0,0,0,0.12)",
      "inset 0 1px 0 rgba(255,255,255,0.28)",
    ].join(", "),
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
  const brands = WIDGET_THEME_PRESETS.map((p) => p.fabColor);
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
      for (const style of ["solid", "glass", "neon"] as const) {
        const fab = resolveFabVisual(style, brand, "auto");
        const fg = fab.color;
        const bg =
          style === "neon"
            ? "#0A0A0C"
            : style === "glass"
              ? brand
              : brand;
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
  ) ?? FAB_SIZE_PRESETS[0];
  const showFab = normalized.launch.showFab !== false;
  return {
    enabled: input.enabled,
    buttonLabel: input.buttonLabel || "Gyors rendelés",
    allowedGroupIds: input.allowedGroupIds,
    requireLogin: normalized.features.requireLogin,
    fabColor: resolveFabColor(normalized.appearance),
    fabInk: normalized.appearance.fabInk,
    fabInkCustom:
      normalized.appearance.fabInk === "custom"
        ? normalized.appearance.fabInkCustom
        : null,
    fabStyle: normalized.appearance.fabStyle,
    fabPosition: normalized.appearance.fabPosition,
    fabSize: normalized.appearance.fabSize,
    panelTheme: normalized.appearance.panelTheme || LOCKED_PANEL_THEME,
    modules: normalized.features.modules,
    showLabel: size.showLabel,
    compact: size.compact,
    // Overridden by loadPublicWidgetConfig from org plan + settings.
    showTurinovaMark: !normalized.features.hideTurinovaMark,
    showCustomerGroupName: normalized.features.showCustomerGroupName,
    showNextLevelProgress: normalized.features.showNextLevelProgress,
    freeShipping: resolveFreeShippingPublic({ settings: normalized }),
    showFab,
    hideFab: !showFab,
    presentation: normalized.launch.presentation,
    panelTitle: normalized.launch.panelTitle,
    emptyMessage: normalized.launch.emptyMessage,
    loginMessage: normalized.launch.loginMessage,
    homeView: normalized.launch.homeView,
    autoOpen: normalized.launch.autoOpen,
  };
}

export function positionCss(position: FabPositionId): Record<string, string> {
  const preset = FAB_POSITION_PRESETS.find((p) => p.id === position);
  return { ...(preset?.css ?? FAB_POSITION_PRESETS[0].css) };
}
