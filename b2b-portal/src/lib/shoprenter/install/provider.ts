import { getInstallMode } from "@/lib/shoprenter/install/mode";
import {
  clearScriptInstalled,
  getScriptInstallState,
  loadShopConfigByShopId,
  setScriptInstalled,
} from "@/lib/shoprenter/install/shop-script-state";
import { buildWidgetLoaderUrl } from "@/lib/shoprenter/install/snippet";
import {
  createScriptTag,
  deleteScriptTag,
  findProgateScriptTag,
  listScriptTags,
} from "@/lib/shoprenter/install/script-tag";
import type { InstallResult } from "@/lib/shoprenter/install/types";

export async function installWidgetScript(opts: {
  shopId: string;
  publicId: string;
  apiBase: string;
  /** When true, also flip shops.widget_enabled. */
  enableWidget?: boolean;
}): Promise<InstallResult> {
  const mode = getInstallMode();
  const enableWidget = opts.enableWidget !== false;
  const src = buildWidgetLoaderUrl({
    apiBase: opts.apiBase,
    publicId: opts.publicId,
  });

  if (mode === "stub_success") {
    await setScriptInstalled(opts.shopId, {
      method: "stub",
      scriptTagId: "stub-success",
      enableWidget,
    });
    return { ok: true, method: "stub", scriptTagId: "stub-success" };
  }

  if (mode === "stub_fail") {
    return {
      ok: false,
      error: "Stub: ScriptTag telepítés sikertelen (teszt mód).",
      fallback: true,
    };
  }

  if (mode === "manual") {
    return {
      ok: false,
      error: "Másold be a scriptet a témába (egy kattintásos API még nincs bekapcsolva).",
      fallback: true,
    };
  }

  // script_tag
  const loaded = await loadShopConfigByShopId(opts.shopId);
  if (!loaded) {
    return {
      ok: false,
      error: "Nincs Shoprenter API hitelesítés — előbb kösd a boltot a portálon.",
      fallback: true,
    };
  }

  try {
    const existing = await listScriptTags(loaded.config);
    const found = findProgateScriptTag(existing, opts.publicId);
    if (found) {
      await setScriptInstalled(opts.shopId, {
        method: "script_tag",
        scriptTagId: found.id,
        enableWidget,
      });
      return { ok: true, method: "script_tag", scriptTagId: found.id };
    }

    const created = await createScriptTag(loaded.config, {
      src,
      displayScope: "FRONTEND",
      displayArea: "BODY",
    });
    await setScriptInstalled(opts.shopId, {
      method: "script_tag",
      scriptTagId: created.id,
      enableWidget,
    });
    return { ok: true, method: "script_tag", scriptTagId: created.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "ScriptTag hiba";
    console.error("[installWidgetScript]", msg);
    return {
      ok: false,
      error: msg,
      fallback: true,
    };
  }
}

/** Merchant confirmed they pasted the manual snippet. */
export async function confirmManualInstall(opts: {
  shopId: string;
  enableWidget?: boolean;
}): Promise<InstallResult> {
  await setScriptInstalled(opts.shopId, {
    method: "manual",
    scriptTagId: null,
    enableWidget: opts.enableWidget !== false,
  });
  return { ok: true, method: "manual", scriptTagId: null };
}

export async function removeWidgetScript(opts: {
  shopId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const state = await getScriptInstallState(opts.shopId);
  if (state.method === "script_tag" && state.scriptTagId) {
    const loaded = await loadShopConfigByShopId(opts.shopId);
    if (loaded) {
      try {
        await deleteScriptTag(loaded.config, state.scriptTagId);
      } catch (err) {
        console.error("[removeWidgetScript]", err);
        return {
          ok: false,
          error: err instanceof Error ? err.message : "ScriptTag törlés sikertelen",
        };
      }
    }
  }
  await clearScriptInstalled(opts.shopId);
  return { ok: true };
}
