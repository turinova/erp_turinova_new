/** postMessage protocol between WidgetLivePreview host and /widget-preview iframe. */

export const PREVIEW_MESSAGE_SOURCE = "progate-widget-preview" as const;

export type PreviewConfigPayload = {
  buttonLabel?: string;
  fabColor?: string;
  fabInk?: string;
  fabInkCustom?: string | null;
  fabStyle?: string;
  fabPosition?: string;
  fabSize?: string;
  panelTheme?: string;
  modules?: string[];
  showTurinovaMark?: boolean;
  showCustomerGroupName?: boolean;
  showNextLevelProgress?: boolean;
  showFab?: boolean;
  hideFab?: boolean;
  showLabel?: boolean;
  compact?: boolean;
  freeShipping?: {
    enabled: boolean;
    thresholdGross: number;
    thresholdLabel?: string | null;
  } | null;
};

export type PreviewHostMessage =
  | {
      source: typeof PREVIEW_MESSAGE_SOURCE;
      type: "configure";
      config: PreviewConfigPayload;
    }
  | {
      source: typeof PREVIEW_MESSAGE_SOURCE;
      type: "setPanel";
      open: boolean;
    };

export type PreviewSandboxMessage =
  | { source: typeof PREVIEW_MESSAGE_SOURCE; type: "ready" }
  | { source: typeof PREVIEW_MESSAGE_SOURCE; type: "panelClosed" }
  | {
      source: typeof PREVIEW_MESSAGE_SOURCE;
      type: "error";
      message: string;
    };
