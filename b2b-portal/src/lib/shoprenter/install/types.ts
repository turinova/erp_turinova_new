export type InstallMethod = "manual" | "script_tag" | "stub";

/** SR_INSTALL_MODE — default manual until store.scriptTag:write is granted. */
export type InstallMode =
  | "manual"
  | "script_tag"
  | "stub_success"
  | "stub_fail";

export type ScriptInstallState = {
  method: InstallMethod | null;
  scriptTagId: string | null;
  installedAt: string | null;
  verifiedAt: string | null;
};

export type InstallCapability = {
  mode: InstallMode;
  /** True when one-click API path is attempted (script_tag or stubs). */
  oneClick: boolean;
  label: string;
};

export type InstallResult =
  | {
      ok: true;
      method: InstallMethod;
      scriptTagId: string | null;
      fallback?: false;
    }
  | {
      ok: false;
      error: string;
      /** Show copy-snippet UI after failed API. */
      fallback: true;
      method?: InstallMethod;
    };
