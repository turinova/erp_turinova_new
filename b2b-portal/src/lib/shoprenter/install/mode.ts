import type { InstallCapability, InstallMode } from "@/lib/shoprenter/install/types";

export function getInstallMode(): InstallMode {
  const raw = (process.env.SR_INSTALL_MODE || "manual").trim().toLowerCase();
  if (
    raw === "script_tag" ||
    raw === "stub_success" ||
    raw === "stub_fail" ||
    raw === "manual"
  ) {
    return raw;
  }
  return "manual";
}

export function getInstallCapability(): InstallCapability {
  const mode = getInstallMode();
  if (mode === "script_tag") {
    return {
      mode,
      oneClick: true,
      label: "ScriptTag API",
    };
  }
  if (mode === "stub_success" || mode === "stub_fail") {
    return {
      mode,
      oneClick: true,
      label: mode === "stub_success" ? "Stub (siker)" : "Stub (hiba)",
    };
  }
  return {
    mode: "manual",
    oneClick: false,
    label: "Manuális snippet",
  };
}
