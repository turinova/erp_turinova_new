import {
  DEFAULT_WIDGET_SETTINGS,
  ensureLockedWidgetModules,
  type FabSizeId,
  type FabStyleId,
  type PanelThemeId,
  type WidgetModuleId,
  type WidgetSettingsPayload,
  type WidgetThemeId,
} from "@/lib/widget/presets";

export type EmbedProfileId = "visible" | "clean_b2b" | "discreet";

export type WidgetPresentationMode = "auto" | "fullscreen" | "drawer";
export type WidgetHomeView = "search" | "orders" | "empty";
export type WidgetAutoOpen = "never" | "hash";

export type WidgetLaunchSettings = {
  showFab: boolean;
  presentation: WidgetPresentationMode;
  profileId: EmbedProfileId | "custom";
  panelTitle: string;
  emptyMessage: string;
  loginMessage: string;
  homeView: WidgetHomeView;
  autoOpen: WidgetAutoOpen;
};

export const DEFAULT_LAUNCH_SETTINGS: WidgetLaunchSettings = {
  showFab: true,
  presentation: "fullscreen",
  profileId: "visible",
  panelTitle: "Gyors rendelés",
  emptyMessage: "Írd be a cikkszámot, vagy tölts fel listát.",
  loginMessage: "Jelentkezz be a gyors rendeléshez.",
  homeView: "search",
  autoOpen: "hash",
};

export const EMBED_PROFILES: {
  id: EmbedProfileId;
  label: string;
  hint: string;
  launch: Partial<WidgetLaunchSettings>;
  appearance: Partial<WidgetSettingsPayload["appearance"]>;
  modules: WidgetModuleId[];
}[] = [
  {
    id: "visible",
    label: "Látható",
    hint: "FAB + teljes képernyő, minden modul",
    launch: {
      showFab: true,
      presentation: "fullscreen",
      profileId: "visible",
      autoOpen: "hash",
      homeView: "search",
    },
    appearance: {
      themeId: "ocean" as WidgetThemeId,
      fabStyle: "glass" as FabStyleId,
      fabSize: "icon_label" as FabSizeId,
      fabPosition: "bottom_right",
      panelTheme: "high_contrast" as PanelThemeId,
    },
    modules: [...DEFAULT_WIDGET_SETTINGS.features.modules],
  },
  {
    id: "clean_b2b",
    label: "Tiszta B2B",
    hint: "Nincs FAB — menü / hash nyit",
    launch: {
      showFab: false,
      presentation: "fullscreen",
      profileId: "clean_b2b",
      autoOpen: "hash",
      homeView: "search",
    },
    appearance: {
      themeId: "ocean" as WidgetThemeId,
      fabStyle: "solid" as FabStyleId,
      fabSize: "icon_label" as FabSizeId,
      fabPosition: "bottom_right",
      panelTheme: "high_contrast" as PanelThemeId,
    },
    modules: [...DEFAULT_WIDGET_SETTINGS.features.modules],
  },
  {
    id: "discreet",
    label: "Diszkrét",
    hint: "Ikon-only FAB + oldalsáv",
    launch: {
      showFab: true,
      presentation: "drawer",
      profileId: "discreet",
      autoOpen: "never",
      homeView: "search",
    },
    appearance: {
      themeId: "ink" as WidgetThemeId,
      fabStyle: "solid" as FabStyleId,
      fabSize: "icon_only" as FabSizeId,
      fabPosition: "bottom_right",
      panelTheme: "light_flat" as PanelThemeId,
    },
    modules: ["search", "excel", "email", "image", "orders"],
  },
];

export function applyEmbedProfile(
  settings: WidgetSettingsPayload,
  profileId: EmbedProfileId,
): WidgetSettingsPayload {
  const profile = EMBED_PROFILES.find((p) => p.id === profileId);
  if (!profile) return settings;
  return {
    ...settings,
    appearance: {
      ...settings.appearance,
      ...profile.appearance,
    },
    features: {
      ...settings.features,
      modules: ensureLockedWidgetModules([...profile.modules]),
    },
    launch: {
      ...settings.launch,
      ...profile.launch,
      profileId,
    },
  };
}

export function normalizeLaunchSettings(raw: unknown): WidgetLaunchSettings {
  const obj =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const presentation =
    obj.presentation === "auto" ||
    obj.presentation === "fullscreen" ||
    obj.presentation === "drawer"
      ? obj.presentation
      : DEFAULT_LAUNCH_SETTINGS.presentation;

  const profileId =
    obj.profileId === "visible" ||
    obj.profileId === "clean_b2b" ||
    obj.profileId === "discreet" ||
    obj.profileId === "custom"
      ? obj.profileId
      : DEFAULT_LAUNCH_SETTINGS.profileId;

  const homeView =
    obj.homeView === "search" ||
    obj.homeView === "orders" ||
    obj.homeView === "empty"
      ? obj.homeView
      : DEFAULT_LAUNCH_SETTINGS.homeView;

  const autoOpen =
    obj.autoOpen === "never" || obj.autoOpen === "hash"
      ? obj.autoOpen
      : DEFAULT_LAUNCH_SETTINGS.autoOpen;

  const str = (key: keyof WidgetLaunchSettings, fallback: string) => {
    const v = obj[key];
    return typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : fallback;
  };

  return {
    showFab: obj.showFab === false ? false : true,
    presentation,
    profileId,
    panelTitle: str("panelTitle", DEFAULT_LAUNCH_SETTINGS.panelTitle),
    emptyMessage: str("emptyMessage", DEFAULT_LAUNCH_SETTINGS.emptyMessage),
    loginMessage: str("loginMessage", DEFAULT_LAUNCH_SETTINGS.loginMessage),
    homeView,
    autoOpen,
  };
}
