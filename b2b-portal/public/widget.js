/**
 * Shoprenter B2B gyors rendelés — storefront widget
 *
 * Config (before this script):
 *   window.SR_B2B_QUICKORDER = {
 *     apiBase: 'https://b2b.turinova.hu',
 *     shopId: '…' // shops.public_id — appearance loaded from portal
 *   };
 * Then: <script src="https://b2b.turinova.hu/widget.js?v=…"></script>
 * Optional overrides: buttonLabel, fabColor, requireLogin
 * (allowedGroupIds empty = everyone; do not use for access control)
 * Menüpont: href="#sr-b2b-qo"
 */
(function () {
  const cfg = Object.assign(
    {
      apiBase: "",
      shopId: "",
      allowedGroupIds: [],
      requireLogin: true,
      buttonLabel: "Gyors rendelés",
      fabColor: "",
      fabInk: "auto",
      fabStyle: "solid",
      fabPosition: "bottom_right",
      fabSize: "icon_label",
      panelTheme: "high_contrast",
      catalogReady: true,
      catalogStatus: "",
      showTurinovaMark: true,
      showCustomerGroupName: false,
      showNextLevelProgress: false,
      modules: null,
      showLabel: true,
      compact: false,
      positionCss: null,
      enabled: true,
      mountId: "sr-b2b-quickorder-root",
    },
    typeof window !== "undefined" ? window.SR_B2B_QUICKORDER || {} : {},
  );

  function apiBase() {
    if (cfg.apiBase) return String(cfg.apiBase).replace(/\/$/, "");
    // same origin if hosted on Next public/
    return "";
  }

  function showTurinovaMark() {
    return cfg.showTurinovaMark !== false;
  }

  function turinovaCredit(className) {
    if (!showTurinovaMark()) return null;
    return el(
      "a",
      {
        className: className || "sr-qo-credit",
        href: "https://turinova.hu",
        target: "_blank",
        rel: "noopener noreferrer",
        "aria-label": "Turinova",
      },
      [
        el("img", {
          className: "sr-qo-credit-logo",
          src: apiBase() + "/brand/turinova-logo.png",
          alt: "Turinova",
        }),
      ],
    );
  }

  /** Append shopId (public_id) so portal resolves the right tenant. */
  function apiUrl(pathAndQuery) {
    var base = apiBase();
    var path = String(pathAndQuery || "");
    if (path.charAt(0) !== "/") path = "/" + path;
    var id = cfg.shopId || cfg.publicId || "";
    if (!id) return base + path;
    var sep = path.indexOf("?") >= 0 ? "&" : "?";
    return base + path + sep + "shopId=" + encodeURIComponent(String(id));
  }

  function loadRemoteConfig() {
    var id = cfg.shopId || cfg.publicId || "";
    if (!id) return Promise.resolve(false);
    return fetch(apiUrl("/api/widget/config"), { credentials: "omit", cache: "no-store" })
      .then(function (r) {
        return r.json().then(function (data) {
          return { ok: r.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok || !result.data || !result.data.config) return false;
        var c = result.data.config;
        if (typeof c.showTurinovaMark === "boolean") {
          cfg.showTurinovaMark = c.showTurinovaMark;
        }
        if (typeof c.showCustomerGroupName === "boolean") {
          cfg.showCustomerGroupName = c.showCustomerGroupName;
        }
        if (typeof c.showNextLevelProgress === "boolean") {
          cfg.showNextLevelProgress = c.showNextLevelProgress;
        }
        if (c.enabled === false) {
          cfg.enabled = false;
          return true;
        }
        cfg.enabled = true;
        if (c.buttonLabel) cfg.buttonLabel = c.buttonLabel;
        if (Array.isArray(c.allowedGroupIds)) cfg.allowedGroupIds = c.allowedGroupIds;
        if (typeof c.requireLogin === "boolean") cfg.requireLogin = c.requireLogin;
        if (c.fabColor) cfg.fabColor = c.fabColor;
        if (c.fabInk === "auto" || c.fabInk === "white" || c.fabInk === "black") {
          cfg.fabInk = c.fabInk;
        }
        if (c.fabStyle) cfg.fabStyle = c.fabStyle;
        if (c.fabPosition) cfg.fabPosition = c.fabPosition;
        if (c.fabSize) cfg.fabSize = c.fabSize;
        if (c.panelTheme) cfg.panelTheme = c.panelTheme;
        if (Array.isArray(c.modules)) cfg.modules = c.modules;
        if (typeof c.showLabel === "boolean") cfg.showLabel = c.showLabel;
        if (typeof c.compact === "boolean") cfg.compact = c.compact;
        if (c.positionCss) cfg.positionCss = c.positionCss;
        if (typeof c.catalogReady === "boolean") cfg.catalogReady = c.catalogReady;
        if (c.catalogStatus) cfg.catalogStatus = c.catalogStatus;
        return true;
      })
      .catch(function () {
        return false;
      });
  }

  function moduleOn(id) {
    if (!cfg.modules || !cfg.modules.length) return true;
    return cfg.modules.indexOf(id) >= 0;
  }

  function hexToRgba(hex, alpha) {
    var h = String(hex || "").replace("#", "");
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    if (h.length !== 6) return "rgba(0,122,255," + alpha + ")";
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function applyPanelTheme(root) {
    if (!root) return;
    /* Panel = portal „Olvasó” — FAB theme must not change it. */
    var theme = "high_contrast";
    var brand = "#0B6BCB";
    var presets = {
      light_glass: {
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
      },
      light_flat: {
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
      },
      dark: {
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
      },
      high_contrast: {
        bg: "#FFFFFF",
        surface: "#FFFFFF",
        surface2: "#F2F2F2",
        text: "#000000",
        muted: "#1C1C1E",
        faint: "#3A3A3C",
        line: "rgba(0,0,0,.45)",
        lineStrong: "rgba(0,0,0,.75)",
        accent: "#0B6BCB",
        accentSoft: "#E8F3FC",
        topbar: "#FFFFFF",
        navTrack: "rgba(0,0,0,.08)",
        navActive: "#FFFFFF",
        ok: "#008009",
        warn: "#A05000",
        danger: "#D70015",
      },
      brand_tinted: {
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
      },
    };
    var c = presets[theme] || presets.light_glass;
    if (theme === "brand_tinted" || theme === "light_glass" || theme === "light_flat") {
      c.accent = brand;
      c.accentSoft = hexToRgba(brand, theme === "light_glass" ? 0.1 : 0.12);
    }
    root.setAttribute("data-theme", theme);
    root.style.setProperty("--sr-qo-bg", c.bg);
    root.style.setProperty("--sr-qo-surface", c.surface);
    root.style.setProperty("--sr-qo-surface-2", c.surface2);
    root.style.setProperty("--sr-qo-text", c.text);
    root.style.setProperty("--sr-qo-muted", c.muted);
    root.style.setProperty("--sr-qo-faint", c.faint);
    root.style.setProperty("--sr-qo-line", c.line);
    root.style.setProperty("--sr-qo-line-strong", c.lineStrong);
    root.style.setProperty("--sr-qo-accent", c.accent);
    root.style.setProperty("--sr-qo-accent-soft", c.accentSoft);
    root.style.setProperty("--sr-qo-topbar", c.topbar);
    root.style.setProperty("--sr-qo-nav-track", c.navTrack);
    root.style.setProperty("--sr-qo-nav-active", c.navActive);
    root.style.setProperty("--sr-qo-ok", c.ok);
    root.style.setProperty("--sr-qo-warn", c.warn);
    root.style.setProperty("--sr-qo-danger", c.danger);
    root.style.setProperty("--sr-qo-radius", "0px");
  }

  function isLoggedIn() {
    try {
      return !!(window.ShopRenter && ShopRenter.customer && ShopRenter.customer.userId);
    } catch {
      return false;
    }
  }

  function getCustomerUserId() {
    try {
      var id = window.ShopRenter && ShopRenter.customer && ShopRenter.customer.userId;
      return id ? String(id) : "";
    } catch {
      return "";
    }
  }

  function getCustomerGroupId() {
    try {
      var gid =
        window.ShopRenter &&
        ShopRenter.customer &&
        ShopRenter.customer.userGroupId;
      if (gid == null || gid === "") return null;
      var n = Number(gid);
      return Number.isFinite(n) ? n : null;
    } catch (e) {
      return null;
    }
  }

  /** Active Partner fact — fire after kosárba rakás; never blocks checkout. */
  function recordWidgetOrder(okLines) {
    var userId = getCustomerUserId();
    if (!userId || !okLines || !okLines.length) return Promise.resolve();
    var payload = {
      userId: userId,
      userGroupId: getCustomerGroupId(),
      lines: okLines.map(function (l) {
        return {
          sku: l.sku,
          name: l.name,
          qty: l.quantity,
          unit_net: l.priceNet != null ? l.priceNet : l.price,
          unit_gross: l.priceGross,
          vat_rate: l.vatRate,
        };
      }),
    };
    return fetch(apiUrl("/api/orders"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      keepalive: true,
      body: JSON.stringify(payload),
    }).catch(function () {});
  }

  function groupAllowed() {
    const allowed = cfg.allowedGroupIds || [];
    // Üres lista = minden bejelentkezett vevő látja (nincs csoport-kapu)
    if (!allowed.length) return true;
    try {
      const gid = ShopRenter.customer.userGroupId;
      return allowed.map(Number).includes(Number(gid));
    } catch {
      return false;
    }
  }

  function parseCsv(text) {
    const lines = [];
    text.split(/\r?\n/).forEach(function (row) {
      const t = row.trim();
      if (!t || /^sku\b/i.test(t) || /^ean\b/i.test(t)) return;
      const parts = t.split(/[,;\t]/);
      const sku = (parts[0] || "").trim();
      const qty = Math.max(1, parseInt(parts[1] || "1", 10) || 1);
      if (sku) lines.push({ sku: sku, quantity: qty });
    });
    return lines;
  }

  /**
   * Shoprenter storefront uses AjaxCart → module/cart/callback (not checkout/cart/add).
   * Proven on vasalatmester.hu: JSON with countProducts, total, message, products.
   */
  function addToCart(productId, quantity) {
    return new Promise(function (resolve, reject) {
      const body =
        "product_id=" +
        encodeURIComponent(String(productId)) +
        "&quantity=" +
        encodeURIComponent(String(quantity));

      fetch("index.php?route=module/cart/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "same-origin",
        body: body,
      })
        .then(function (r) {
          return r.text().then(function (text) {
            var json = null;
            try {
              json = JSON.parse(text);
            } catch (e) {
              reject({
                error: "non-json cart response",
                status: r.status,
                preview: text.slice(0, 200),
              });
              return null;
            }
            return { ok: r.ok, json: json };
          });
        })
        .then(function (result) {
          if (!result) return;
          var json = result.json;
          var looksOk =
            json &&
            (typeof json.countProducts !== "undefined" ||
              typeof json.total !== "undefined" ||
              (typeof json.message === "string" &&
                json.message.indexOf("Kosárba") !== -1) ||
              (json.products && json.products.length));
          if (result.ok && looksOk) {
            resolve(json);
          } else {
            reject(json || { error: "add failed" });
          }
        })
        .catch(reject);
    });
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "style" && typeof attrs[k] === "object") {
          Object.assign(node.style, attrs[k]);
        } else if (k === "className") {
          node.className = attrs[k];
        } else if (k === "checked" || k === "disabled" || k === "selected") {
          node[k] = Boolean(attrs[k]);
        } else if (k.startsWith("on") && typeof attrs[k] === "function") {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else {
          node.setAttribute(k, attrs[k]);
        }
      });
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  var DRAFT_KEY = "sr-b2b-qo-draft-v1";

  function loadDraft() {
    try {
      var raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(function (l) {
          return l && typeof l.sku === "string" && l.sku.trim();
        })
        .map(function (l) {
          return {
            sku: String(l.sku).trim(),
            quantity: Math.max(1, parseInt(l.quantity, 10) || 1),
            productId: l.productId,
            name: l.name,
            modelNumber: l.modelNumber,
            gtin: l.gtin,
            price: l.price,
            priceNet: l.priceNet,
            priceGross: l.priceGross,
            priceNetFormatted: l.priceNetFormatted,
            priceGrossFormatted: l.priceGrossFormatted,
            listPriceNet: l.listPriceNet,
            listPriceGross: l.listPriceGross,
            listPriceNetFormatted: l.listPriceNetFormatted,
            listPriceGrossFormatted: l.listPriceGrossFormatted,
            vatRate: l.vatRate,
            vatAmountFormatted: l.vatAmountFormatted,
            discountPercent: l.discountPercent,
            discountAmountNetFormatted: l.discountAmountNetFormatted,
            priceSource: l.priceSource,
            stockQty: l.stockQty,
            stockLabel: l.stockLabel,
            stockTone: l.stockTone,
            inStock: l.inStock,
            orderable: l.orderable,
            minQty: l.minQty,
            qtyStep: l.qtyStep,
            maxQty: l.maxQty,
            packLabel: l.packLabel,
            imageUrl: l.imageUrl,
            productUrl: l.productUrl,
            found: l.found,
            error: l.error,
          };
        });
    } catch (e) {
      return [];
    }
  }

  function saveDraft(lines) {
    try {
      if (!lines.length) {
        sessionStorage.removeItem(DRAFT_KEY);
        return;
      }
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(lines));
    } catch (e) {
      /* private mode / quota */
    }
  }

  function ensurePanelStyles() {
    [
      "sr-b2b-qo-panel-css-v1",
      "sr-b2b-qo-panel-css-v2",
      "sr-b2b-qo-panel-css-v3",
      "sr-b2b-qo-panel-css-v4",
      "sr-b2b-qo-panel-css-v5",
      "sr-b2b-qo-panel-css-v6",
      "sr-b2b-qo-panel-css-v7",
      "sr-b2b-qo-panel-css-v8",
      "sr-b2b-qo-panel-css-v9",
      "sr-b2b-qo-panel-css-v10",
      "sr-b2b-qo-panel-css-v11",
      "sr-b2b-qo-panel-css-v12",
      "sr-b2b-qo-panel-css-v13",
      "sr-b2b-qo-panel-css-v14",
      "sr-b2b-qo-panel-css-v15",
      "sr-b2b-qo-panel-css-v16",
      "sr-b2b-qo-panel-css-v17",
      "sr-b2b-qo-panel-css-v18",
      "sr-b2b-qo-panel-css-v19",
      "sr-b2b-qo-panel-css-v20",
      "sr-b2b-qo-panel-css-v21",
      "sr-b2b-qo-panel-css-v22",
      "sr-b2b-qo-panel-css-v23",
      "sr-b2b-qo-panel-css-v24",
      "sr-b2b-qo-panel-css-v25",
      "sr-b2b-qo-panel-css-v26",
      "sr-b2b-qo-panel-css-v27",
      "sr-b2b-qo-panel-css-v28",
      "sr-b2b-qo-panel-css-v29",
      "sr-b2b-qo-panel-css-v30",
      "sr-b2b-qo-panel-css-v31",
      "sr-b2b-qo-panel-css-v32",
      "sr-b2b-qo-panel-css-v33",
      "sr-b2b-qo-panel-css-v34",
      "sr-b2b-qo-panel-css-v35",
      "sr-b2b-qo-panel-css-v36",
      "sr-b2b-qo-panel-css-v37",
      "sr-b2b-qo-panel-css-v38",
      "sr-b2b-qo-panel-css-v39",
      "sr-b2b-qo-panel-css-v40",
      "sr-b2b-qo-panel-css-v41",
      "sr-b2b-qo-panel-css-v42",
      "sr-b2b-qo-panel-css-v43",
      "sr-b2b-qo-panel-css-v44",
      "sr-b2b-qo-panel-css-v45",
      "sr-b2b-qo-panel-css-v46",
      "sr-b2b-qo-panel-css-v47",
      "sr-b2b-qo-panel-css-v48",
    ].forEach(function (id) {
      var n = document.getElementById(id);
      if (n) n.remove();
    });
    if (document.getElementById("sr-b2b-qo-panel-css-v49")) return;
    var style = document.createElement("style");
    style.id = "sr-b2b-qo-panel-css-v49";
    style.textContent = [
      "#sr-b2b-quickorder-root{",
      "  --sr-qo-bg:#FFFFFF;--sr-qo-surface:#FFFFFF;--sr-qo-surface-2:#F2F2F2;",
      "  --sr-qo-text:#000000;--sr-qo-muted:#1C1C1E;--sr-qo-faint:#3A3A3C;",
      "  --sr-qo-line:rgba(0,0,0,.45);--sr-qo-line-strong:rgba(0,0,0,.75);",
      "  --sr-qo-accent:#0B6BCB;--sr-qo-accent-soft:#E8F3FC;",
      "  --sr-qo-topbar:#FFFFFF;--sr-qo-nav-track:rgba(0,0,0,.08);--sr-qo-nav-active:#FFFFFF;",
      "  --sr-qo-ok:#008009;--sr-qo-warn:#A05000;--sr-qo-danger:#D70015;",
      "  --sr-qo-radius:0px;--sr-qo-ease:cubic-bezier(.2,.8,.2,1);",
      "  /* Shoprenter cookie/chat/admin sávok fölé — max signed 32-bit z-index */",
      "  --sr-qo-z-fab:2147483000;--sr-qo-z-backdrop:2147483646;--sr-qo-z-shell:2147483647;",
      "  position:relative;z-index:var(--sr-qo-z-shell);isolation:isolate;",
      "  font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',system-ui,sans-serif;",
      "  color:var(--sr-qo-text);",
      "  -webkit-font-smoothing:antialiased;",
      "}",
      "@keyframes sr-qo-app-in{",
      "  from{opacity:0}",
      "  to{opacity:1}",
      "}",
      "@keyframes sr-qo-view-in{",
      "  from{opacity:0;transform:translateY(4px)}",
      "  to{opacity:1;transform:none}",
      "}",
      "@keyframes sr-qo-row-flash{",
      "  from{background:var(--sr-qo-accent-soft)}",
      "  to{background:transparent}",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-backdrop{",
      "  position:fixed;inset:0;z-index:var(--sr-qo-z-backdrop);",
      "  background:var(--sr-qo-bg);",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-shell{",
      "  position:fixed;inset:0;z-index:var(--sr-qo-z-shell);display:flex;flex-direction:column;",
      "  width:100%;height:100%;max-width:none;max-height:100dvh;margin:0;",
      "  background:var(--sr-qo-surface);",
      "  border:none;border-radius:0;box-shadow:none;",
      "  overflow:hidden;",
      "  animation:sr-qo-app-in 180ms var(--sr-qo-ease) both;",
      "}",
      /* Compact top chrome — max width for content */
      "#sr-b2b-quickorder-root .sr-qo-topbar{",
      "  display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);",
      "  align-items:center;gap:10px;",
      "  min-height:48px;padding:6px 14px;",
      "  background:var(--sr-qo-topbar, rgba(247,246,243,.86));",
      "  backdrop-filter:saturate(1.6) blur(20px);-webkit-backdrop-filter:saturate(1.6) blur(20px);",
      "  border-bottom:0.5px solid var(--sr-qo-line-strong);",
      "  flex-shrink:0;",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-brand{",
      "  display:flex;align-items:center;gap:8px;min-width:0;justify-self:start",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-app-mark{",
      "  width:22px;height:22px;border-radius:6px;flex-shrink:0;",
      "  background:var(--sr-qo-accent);color:#fff;",
      "  display:flex;align-items:center;justify-content:center;",
      "  box-shadow:inset 0 1px 0 rgba(255,255,255,.18)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-app-mark svg{display:block;width:14px;height:14px}",
      "#sr-b2b-quickorder-root .sr-qo-title{",
      "  margin:0;font-size:13px;font-weight:600;letter-spacing:-.01em;line-height:1.2;",
      "  white-space:nowrap;overflow:hidden;text-overflow:ellipsis",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-topbar-right{",
      "  display:flex;align-items:center;justify-content:flex-end;justify-self:end;gap:8px;min-width:0",
      "}",
      /* Apple-style segmented control */
      "#sr-b2b-quickorder-root .sr-qo-nav{",
      "  display:inline-flex;align-items:center;gap:1px;padding:2px;",
      "  background:var(--sr-qo-nav-track, rgba(55,53,47,.08));border-radius:9px;",
      "  max-width:100%;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-nav::-webkit-scrollbar{display:none}",
      "#sr-b2b-quickorder-root .sr-qo-nav-btn{",
      "  appearance:none;border:none;background:transparent;cursor:pointer;",
      "  height:28px;padding:0 12px;border-radius:7px;",
      "  font-family:inherit;font-size:12px;font-weight:500;letter-spacing:-.01em;",
      "  color:var(--sr-qo-muted);white-space:nowrap;flex-shrink:0;",
      "  transition:color .12s ease,background .12s ease,box-shadow .12s ease",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-nav-btn:hover{color:var(--sr-qo-text)}",
      "#sr-b2b-quickorder-root .sr-qo-nav-btn:focus{outline:none}",
      "#sr-b2b-quickorder-root .sr-qo-nav-btn:focus-visible{",
      "  outline:2px solid var(--sr-qo-accent);outline-offset:1px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-nav-btn.is-active{",
      "  background:var(--sr-qo-nav-active, var(--sr-qo-surface));color:var(--sr-qo-text);font-weight:600;",
      "  box-shadow:0 0.5px 1px rgba(0,0,0,.18),0 1px 3px rgba(0,0,0,.12)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-badge{",
      "  font-size:11px;font-weight:500;padding:0;border:none;border-radius:0;",
      "  background:transparent;color:var(--sr-qo-muted)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-badge-ok{color:var(--sr-qo-ok)}",
      "#sr-b2b-quickorder-root .sr-qo-badge-err{color:var(--sr-qo-danger)}",
      "#sr-b2b-quickorder-root .sr-qo-badge-save{color:var(--sr-qo-accent)}",
      "#sr-b2b-quickorder-root .sr-qo-badge-warn{color:var(--sr-qo-warn)}",
      "#sr-b2b-quickorder-root .sr-qo-badge-pill{",
      "  display:inline-flex;align-items:center;gap:4px;",
      "  height:22px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:600;",
      "  background:var(--sr-qo-surface-2);color:var(--sr-qo-text);white-space:nowrap",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-badge-pill.up{background:rgba(163,45,45,.1);color:var(--sr-qo-danger)}",
      "#sr-b2b-quickorder-root .sr-qo-badge-pill.down{background:rgba(47,111,78,.1);color:var(--sr-qo-ok)}",
      "#sr-b2b-quickorder-root .sr-qo-badge-pill.miss{background:rgba(154,103,0,.12);color:var(--sr-qo-warn)}",
      "#sr-b2b-quickorder-root .sr-qo-badge-pill.stock{background:rgba(163,45,45,.08);color:var(--sr-qo-danger)}",
      "#sr-b2b-quickorder-root .sr-qo-diff-up{font-size:11px;font-weight:600;color:var(--sr-qo-danger);margin-top:2px}",
      "#sr-b2b-quickorder-root .sr-qo-diff-down{font-size:11px;font-weight:600;color:var(--sr-qo-ok);margin-top:2px}",
      "#sr-b2b-quickorder-root .sr-qo-diff-same{font-size:11px;color:var(--sr-qo-faint);margin-top:2px}",
      "#sr-b2b-quickorder-root .sr-qo-orders-search{",
      "  box-sizing:border-box;height:28px;min-width:160px;max-width:240px;flex:1;",
      "  padding:0 10px;border:0.5px solid var(--sr-qo-line-strong);border-radius:8px;",
      "  font-size:12px;background:var(--sr-qo-surface-2);color:var(--sr-qo-text)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-orders-search:focus{",
      "  outline:2px solid var(--sr-qo-accent-soft);outline-offset:0;border-color:var(--sr-qo-accent);background:var(--sr-qo-surface)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-orders-count{font-size:11px;color:var(--sr-qo-faint);white-space:nowrap}",
      "#sr-b2b-quickorder-root .sr-qo-orders-filters{",
      "  display:flex;align-items:center;gap:8px;flex-wrap:wrap;width:100%;",
      "  padding:8px 16px;border-bottom:0.5px solid var(--sr-qo-line);",
      "  background:var(--sr-qo-surface);flex-shrink:0",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-orders-filters .sr-qo-filter-lab{",
      "  font-size:11px;font-weight:600;color:var(--sr-qo-faint);white-space:nowrap",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-qty-menu{position:relative}",
      "#sr-b2b-quickorder-root .sr-qo-qty-menu-panel{",
      "  display:none;position:absolute;bottom:calc(100% + 6px);right:0;z-index:8;",
      "  min-width:220px;padding:6px;border-radius:12px;",
      "  background:var(--sr-qo-surface);border:0.5px solid var(--sr-qo-line-strong);",
      "  box-shadow:0 10px 28px rgba(26,25,23,.14)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-qty-menu.is-open .sr-qo-qty-menu-panel{display:flex;flex-direction:column;gap:2px}",
      "#sr-b2b-quickorder-root .sr-qo-home .sr-qo-qty-menu-panel{",
      "  bottom:auto;top:calc(100% + 6px);right:auto;left:0",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-qty-menu-item{",
      "  appearance:none;border:none;background:transparent;text-align:left;",
      "  padding:10px 12px;border-radius:8px;cursor:pointer;font:inherit;",
      "  font-size:13px;font-weight:550;color:var(--sr-qo-text)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-qty-menu-item:hover{background:var(--sr-qo-accent-soft)}",
      "#sr-b2b-quickorder-root .sr-qo-qty-menu-item small{",
      "  display:block;font-size:11px;font-weight:450;color:var(--sr-qo-muted);margin-top:2px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-orders-foot{gap:10px}",
      "#sr-b2b-quickorder-root .sr-qo-orders-table th.actions,",
      "#sr-b2b-quickorder-root .sr-qo-orders-table td.actions{width:1%;padding-left:4px;padding-right:10px}",
      "#sr-b2b-quickorder-root .sr-qo-orders-filter{",
      "  box-sizing:border-box;height:28px;padding:0 8px;border:0.5px solid var(--sr-qo-line-strong);",
      "  border-radius:8px;font-size:12px;background:var(--sr-qo-surface-2);color:var(--sr-qo-text)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-orders-filter:focus{",
      "  outline:2px solid var(--sr-qo-accent-soft);border-color:var(--sr-qo-accent);background:var(--sr-qo-surface)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-orders-selbar{",
      "  display:none;align-items:center;gap:8px;flex-wrap:wrap;",
      "  padding:8px 16px;border-bottom:0.5px solid var(--sr-qo-line);",
      "  background:var(--sr-qo-accent-soft);flex-shrink:0",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-orders-selbar.is-on{display:flex}",
      "#sr-b2b-quickorder-root .sr-qo-orders-selcount{",
      "  font-size:12px;font-weight:600;color:var(--sr-qo-accent);margin-right:4px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-orders-table th.check,",
      "#sr-b2b-quickorder-root .sr-qo-orders-table td.check{",
      "  width:36px;padding-left:12px;padding-right:4px;text-align:center",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-orders-table tbody tr.is-selected{",
      "  background:var(--sr-qo-accent-soft)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-orders-table input[type=checkbox]{",
      "  width:15px;height:15px;accent-color:var(--sr-qo-accent);cursor:pointer",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-toast.info{background:var(--sr-qo-text)}",
      "#sr-b2b-quickorder-root .sr-qo-toast.warn{background:var(--sr-qo-warn)}",
      /* Start chooser + ingest + review */
      "#sr-b2b-quickorder-root .sr-qo-order-stack{",
      "  flex:1;min-height:0;display:flex;flex-direction:column;position:relative",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-order-pane{",
      "  display:none;flex:1;min-height:0;flex-direction:column",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-order-pane.is-on{display:flex}",
      "#sr-b2b-quickorder-root .sr-qo-start{",
      "  flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;",
      "  padding:40px 20px;background:var(--sr-qo-bg);gap:28px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-start-title{",
      "  margin:0;font-size:22px;font-weight:600;letter-spacing:-.03em;text-align:center",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-start-sub{",
      "  margin:-16px 0 0;max-width:420px;font-size:14px;line-height:1.45;color:var(--sr-qo-muted);text-align:center",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-start-grid{",
      "  display:grid;grid-template-columns:repeat(2,minmax(0,220px));gap:10px;width:100%;max-width:460px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-start-card{",
      "  appearance:none;border:0.5px solid var(--sr-qo-line-strong);border-radius:14px;",
      "  background:var(--sr-qo-surface);padding:18px 14px;text-align:left;cursor:pointer;",
      "  transition:background .12s ease,border-color .12s ease,transform .12s var(--sr-qo-ease)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-start-card:hover{",
      "  background:var(--sr-qo-surface);border-color:var(--sr-qo-accent);transform:translateY(-1px)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-start-card:focus{outline:none}",
      "#sr-b2b-quickorder-root .sr-qo-start-card:focus-visible{outline:2px solid var(--sr-qo-accent);outline-offset:2px}",
      "#sr-b2b-quickorder-root .sr-qo-start-card strong{",
      "  display:block;font-size:14px;font-weight:600;letter-spacing:-.01em;margin-bottom:4px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-start-card span{",
      "  display:block;font-size:12px;line-height:1.4;color:var(--sr-qo-muted)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-ingest{",
      "  flex:1;display:flex;flex-direction:column;min-height:0;background:var(--sr-qo-bg)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-ingest-bar{",
      "  display:flex;align-items:center;gap:10px;padding:10px 16px;",
      "  border-bottom:0.5px solid var(--sr-qo-line);background:var(--sr-qo-surface);flex-shrink:0",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-ingest-bar h3{margin:0;font-size:15px;font-weight:600;flex:1}",
      "#sr-b2b-quickorder-root .sr-qo-ingest-body{",
      "  flex:1;min-height:0;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:12px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-ingest-hint{margin:0;font-size:13px;color:var(--sr-qo-muted);line-height:1.45}",
      "#sr-b2b-quickorder-root .sr-qo-file-btn, #sr-b2b-quickorder-root a.sr-qo-file-btn{",
      "  display:inline-flex;align-items:center;justify-content:center;height:36px;padding:0 14px;",
      "  border-radius:10px;border:0.5px solid var(--sr-qo-line-strong);background:var(--sr-qo-surface);",
      "  font-size:13px;font-weight:600;cursor:pointer;text-decoration:none;color:inherit",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-drop{",
      "  border:1px dashed var(--sr-qo-line-strong);border-radius:14px;padding:28px 16px;",
      "  text-align:center;background:var(--sr-qo-surface);color:var(--sr-qo-muted);font-size:13px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-drop.is-over{border-color:var(--sr-qo-accent);background:var(--sr-qo-accent-soft)}",
      "#sr-b2b-quickorder-root .sr-qo-review-preview{",
      "  max-height:160px;object-fit:contain;border-radius:10px;border:0.5px solid var(--sr-qo-line);",
      "  background:var(--sr-qo-surface);align-self:flex-start",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-conf{",
      "  display:inline-block;font-size:11px;font-weight:600;padding:2px 6px;border-radius:6px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-conf-hi{background:rgba(47,111,78,.12);color:var(--sr-qo-ok)}",
      "#sr-b2b-quickorder-root .sr-qo-conf-mid{background:rgba(154,103,0,.12);color:var(--sr-qo-warn)}",
      "#sr-b2b-quickorder-root .sr-qo-conf-lo{background:rgba(163,45,45,.1);color:var(--sr-qo-danger)}",
      "@keyframes sr-qo-spin{to{transform:rotate(360deg)}}",
      "#sr-b2b-quickorder-root .sr-qo-ingest{position:relative}",
      "#sr-b2b-quickorder-root .sr-qo-busy{",
      "  position:absolute;inset:0;z-index:6;display:none;align-items:center;justify-content:center;",
      "  padding:24px;background:rgba(247,246,243,.9);backdrop-filter:blur(5px)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-busy.is-on{display:flex}",
      "#sr-b2b-quickorder-root .sr-qo-busy-card{",
      "  max-width:300px;text-align:center;padding:8px 12px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-spinner{",
      "  width:28px;height:28px;margin:0 auto 14px;border-radius:50%;",
      "  border:2.5px solid var(--sr-qo-line-strong);border-top-color:var(--sr-qo-accent);",
      "  animation:sr-qo-spin .75s linear infinite",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-busy-title{",
      "  margin:0;font-size:15px;font-weight:600;letter-spacing:-.02em",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-busy-sub{",
      "  margin:8px 0 0;font-size:13px;line-height:1.45;color:var(--sr-qo-muted)",
      "}",

      "#sr-b2b-quickorder-root .sr-qo-home{",
      "  flex:1;min-height:0;overflow:auto;padding:20px 20px 28px;background:",
      "  radial-gradient(1200px 480px at 10% -10%,var(--sr-qo-accent-soft),transparent 55%),var(--sr-qo-bg)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-home-hero{",
      "  display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px;",
      "  margin-bottom:18px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-home-hero h3{",
      "  margin:0;font-size:24px;font-weight:650;letter-spacing:-.035em",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-home-hero p{",
      "  margin:6px 0 0;max-width:520px;font-size:14px;line-height:1.45;color:var(--sr-qo-muted)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-home-meta{",
      "  margin:0 0 14px;font-size:13px;color:var(--sr-qo-muted);line-height:1.4",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-home-meta strong{color:var(--sr-qo-text);font-weight:600}",
      "#sr-b2b-quickorder-root .sr-qo-home-grid{",
      "  display:flex;flex-direction:column;gap:12px;max-width:720px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-home-actions{",
      "  display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:12px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-prod-row.is-plain{",
      "  padding-right:0",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-card{",
      "  background:var(--sr-qo-surface);border:0.5px solid var(--sr-qo-line);border-radius:16px;",
      "  padding:14px 14px 12px;min-height:0",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-card h4{",
      "  margin:0 0 4px;font-size:15px;font-weight:650;letter-spacing:-.02em",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-card .sub{",
      "  margin:0 0 12px;font-size:12.5px;color:var(--sr-qo-muted);line-height:1.4",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-prod-row{",
      "  display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;",
      "  padding:8px 0;border-top:0.5px solid var(--sr-qo-line)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-prod-row:first-of-type{border-top:none}",
      "#sr-b2b-quickorder-root .sr-qo-prod-row .t{",
      "  font-size:13px;font-weight:600;line-height:1.3;overflow-wrap:anywhere",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-prod-row .m{",
      "  font-size:11px;color:var(--sr-qo-muted);margin-top:2px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-chip-row{display:flex;flex-wrap:wrap;gap:6px}",
      "#sr-b2b-quickorder-root .sr-qo-chip{",
      "  appearance:none;border:0.5px solid var(--sr-qo-line-strong);background:var(--sr-qo-surface);",
      "  border-radius:999px;padding:5px 10px;font-size:11px;font-weight:600;cursor:pointer",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-chip.primary{",
      "  background:var(--sr-qo-accent);border-color:var(--sr-qo-accent);color:#fff",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-chip:hover{filter:brightness(1.03)}",
      "#sr-b2b-quickorder-root .sr-qo-incentive{",
      "  margin-top:12px;padding:12px;border-radius:12px;",
      "  background:linear-gradient(180deg,var(--sr-qo-surface),var(--sr-qo-accent-soft));",
      "  border:0.5px solid var(--sr-qo-accent)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-incentive .ttl{font-size:12px;font-weight:650;margin:0 0 6px}",
      "#sr-b2b-quickorder-root .sr-qo-incentive .msg{font-size:12px;color:var(--sr-qo-muted);margin:0 0 8px;line-height:1.35}",
      "#sr-b2b-quickorder-root .sr-qo-bar{",
      "  height:8px;border-radius:99px;background:var(--sr-qo-surface-2);overflow:hidden",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-bar > i{",
      "  display:block;height:100%;width:0;background:var(--sr-qo-accent);border-radius:99px;",
      "  transition:width .25s var(--sr-qo-ease)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-incentive.ok{",
      "  background:rgba(47,111,78,.1);border-color:rgba(47,111,78,.28)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-lists{",
      "  flex:1;min-height:0;overflow:auto;padding:24px 20px;",
      "  background:radial-gradient(900px 420px at 90% 0%,var(--sr-qo-accent-soft),transparent 50%),var(--sr-qo-bg)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-lists-head{max-width:520px;margin:0 auto 18px;text-align:center}",
      "#sr-b2b-quickorder-root .sr-qo-lists-head h3{",
      "  margin:0;font-size:24px;font-weight:650;letter-spacing:-.03em",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-lists-head p{",
      "  margin:8px 0 0;font-size:14px;color:var(--sr-qo-muted);line-height:1.45",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-lists-empty{",
      "  max-width:520px;margin:0 auto;text-align:center;",
      "  padding:28px 20px;border-radius:16px;",
      "  background:var(--sr-qo-surface);border:0.5px solid var(--sr-qo-line)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-lists-empty-note{",
      "  margin:0 0 16px;font-size:13px;color:var(--sr-qo-faint);line-height:1.45",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-lists-empty .sr-qo-home-actions{justify-content:center}",
      "#sr-b2b-quickorder-root .sr-qo-lists-grid{",
      "  max-width:720px;margin:0 auto;display:none;gap:12px;grid-template-columns:repeat(3,minmax(0,1fr))",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-list-card{",
      "  position:relative;border-radius:16px;padding:16px;min-height:170px;",
      "  background:var(--sr-qo-surface);border:0.5px solid var(--sr-qo-line);",
      "  display:flex;flex-direction:column;gap:8px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-list-card .soon{",
      "  align-self:flex-start;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;",
      "  padding:3px 8px;border-radius:999px;background:var(--sr-qo-accent-soft);color:var(--sr-qo-accent)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-list-card strong{font-size:15px;letter-spacing:-.02em}",
      "#sr-b2b-quickorder-root .sr-qo-list-card span{font-size:12.5px;color:var(--sr-qo-muted);line-height:1.4;flex:1}",
      "#sr-b2b-quickorder-root .sr-qo-qty-suggest{",
      "  display:flex;flex-wrap:wrap;gap:4px;margin-top:4px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-qty-suggest button{",
      "  appearance:none;border:0.5px solid var(--sr-qo-line-strong);background:var(--sr-qo-surface);",
      "  border-radius:6px;padding:2px 6px;font-size:10px;font-weight:650;cursor:pointer",
      "}",
      "@media (max-width:900px){",
      "  #sr-b2b-quickorder-root .sr-qo-home-grid{max-width:none}",
      "  #sr-b2b-quickorder-root .sr-qo-lists-grid{grid-template-columns:1fr}",
      "}",


      "#sr-b2b-quickorder-root .sr-qo-safety{",
      "  display:none;margin:0 0 8px;padding:6px 8px;border-radius:8px;",
      "  border:0.5px solid rgba(154,103,0,.3);background:rgba(154,103,0,.07);",
      "  align-items:center;gap:8px;flex-wrap:wrap",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-safety.is-on{display:flex}",
      "#sr-b2b-quickorder-root .sr-qo-safety.is-danger{",
      "  border-color:rgba(163,45,45,.3);background:rgba(163,45,45,.07)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-safety-msg{",
      "  margin:0;flex:1;min-width:140px;font-size:12px;font-weight:600;line-height:1.3",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-safety-actions{",
      "  display:flex;flex-wrap:wrap;gap:4px",
      "}",
      "#sr-b2b-quickorder-root table.sr-qo-table tr.sr-qo-row-warn{",
      "  box-shadow:inset 2px 0 0 var(--sr-qo-warn)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-remind{",
      "  display:none;margin:0 0 10px;padding:10px 12px;border-radius:12px;",
      "  border:0.5px solid var(--sr-qo-accent);background:var(--sr-qo-accent-soft)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-remind.is-on{display:flex;align-items:center;gap:10px;flex-wrap:wrap}",
      "#sr-b2b-quickorder-root .sr-qo-remind p{margin:0;flex:1;font-size:13px;line-height:1.4;font-weight:550}",
      "#sr-b2b-quickorder-root .sr-qo-source-btns{display:flex;gap:6px;flex-wrap:wrap}",
      "#sr-b2b-quickorder-root .sr-qo-import{position:relative;flex-shrink:0}",
      "#sr-b2b-quickorder-root .sr-qo-import-menu{",
      "  display:none;position:absolute;top:calc(100% + 4px);right:0;z-index:8;",
      "  min-width:200px;padding:6px;border-radius:12px;",
      "  background:var(--sr-qo-surface);border:0.5px solid var(--sr-qo-line-strong);",
      "  box-shadow:0 10px 28px rgba(26,25,23,.14)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-import.is-open .sr-qo-import-menu{display:flex;flex-direction:column;gap:2px}",
      "#sr-b2b-quickorder-root .sr-qo-import-item{",
      "  appearance:none;border:none;background:transparent;text-align:left;",
      "  padding:10px 12px;border-radius:8px;cursor:pointer;font:inherit;",
      "  font-size:13px;font-weight:550;color:var(--sr-qo-text)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-import-item:hover{background:var(--sr-qo-accent-soft)}",
      "#sr-b2b-quickorder-root .sr-qo-import-item small{",
      "  display:block;font-size:11px;font-weight:450;color:var(--sr-qo-muted);margin-top:2px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-toolbar-hint{display:none}",
      "#sr-b2b-quickorder-root .sr-qo-list-filters{",
      "  display:none;align-items:center;gap:6px;flex-wrap:wrap;",
      "  padding:6px 16px;border-bottom:0.5px solid var(--sr-qo-line);",
      "  background:var(--sr-qo-surface);flex-shrink:0",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-list-filters.is-on{display:flex}",
      "#sr-b2b-quickorder-root .sr-qo-filter-chip{",
      "  appearance:none;border:0.5px solid var(--sr-qo-line-strong);background:var(--sr-qo-surface-2);",
      "  height:26px;padding:0 10px;border-radius:999px;font-size:12px;font-weight:550;",
      "  color:var(--sr-qo-muted);cursor:pointer",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-filter-chip.is-on{",
      "  background:var(--sr-qo-accent-soft);border-color:transparent;color:var(--sr-qo-accent);font-weight:600",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-filter-empty{",
      "  display:none;padding:28px 16px;text-align:center;font-size:13px;color:var(--sr-qo-muted)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-filter-empty.is-on{display:block}",
      "#sr-b2b-quickorder-root .sr-qo-empty{",
      "  padding:48px 24px;text-align:center;color:var(--sr-qo-muted);font-size:14px;line-height:1.45",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-empty-title{",
      "  margin:0;font-size:16px;font-weight:650;color:var(--sr-qo-text)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-empty-sub{",
      "  margin:8px 0 0;font-size:13px;color:var(--sr-qo-muted)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-empty-actions{",
      "  margin-top:18px;display:flex;flex-wrap:wrap;gap:8px;justify-content:center",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-aside{",
      "  width:280px;flex-shrink:0;border-left:0.5px solid var(--sr-qo-line-strong);",
      "  background:var(--sr-qo-bg);",
      "  padding:14px 12px;overflow:auto;display:flex;flex-direction:column;gap:0",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-aside-stats{display:flex;flex-direction:column;flex:1;min-height:0}",
      "#sr-b2b-quickorder-root .sr-qo-receipt{",
      "  display:flex;flex-direction:column;gap:0;flex:1;",
      "  background:var(--sr-qo-surface);",
      "  border:0.5px solid var(--sr-qo-line-strong);border-radius:8px;overflow:hidden",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-receipt-head{",
      "  padding:10px 12px;border-bottom:0.5px solid var(--sr-qo-line);",
      "  font-size:12px;font-weight:650;color:var(--sr-qo-text)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-receipt-body{padding:4px 0;flex:1}",
      "#sr-b2b-quickorder-root .sr-qo-receipt-row{",
      "  display:flex;align-items:baseline;justify-content:space-between;gap:10px;",
      "  padding:6px 12px;font-size:13px;line-height:1.35",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-receipt-row .k{",
      "  color:var(--sr-qo-muted);font-weight:500;flex-shrink:0",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-receipt-row .v{",
      "  font-variant-numeric:tabular-nums;font-weight:600;color:var(--sr-qo-text);",
      "  text-align:right",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-receipt-row.is-total .k{",
      "  color:var(--sr-qo-text);font-weight:650",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-receipt-row.is-total .v{",
      "  font-size:16px;font-weight:700;letter-spacing:-.02em",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-receipt-row.is-save{",
      "  flex-direction:column;align-items:stretch;gap:6px;padding:8px 12px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-receipt-row.is-save .k{",
      "  color:var(--sr-qo-ok);font-weight:650",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-receipt-row.is-save .v{",
      "  min-width:0;width:100%;text-align:left",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-receipt-save-chip{",
      "  display:flex;align-items:center;justify-content:center;gap:6px;",
      "  box-sizing:border-box;width:100%;min-width:0;",
      "  min-height:30px;padding:6px 10px;border-radius:8px;",
      "  font-size:12px;font-weight:700;letter-spacing:-0.01em;",
      "  background:rgba(47,111,78,.14);color:var(--sr-qo-ok)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-receipt-save-amt{white-space:nowrap}",
      "#sr-b2b-quickorder-root .sr-qo-receipt-save-pct{",
      "  font-weight:650;opacity:.9;white-space:nowrap",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-receipt-row.is-muted .k,",
      "#sr-b2b-quickorder-root .sr-qo-receipt-row.is-muted .v{",
      "  color:var(--sr-qo-faint);font-weight:500;font-size:12px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-receipt-row.is-warn .v{color:var(--sr-qo-danger);font-weight:650}",
      "#sr-b2b-quickorder-root .sr-qo-receipt-rule{",
      "  height:0;margin:4px 12px;border:0;border-top:0.5px solid var(--sr-qo-line-strong)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-receipt-foot{",
      "  padding:10px 12px 12px;border-top:0.5px solid var(--sr-qo-line);",
      "  background:var(--sr-qo-surface-2)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-receipt-foot .sr-qo-btn-success{",
      "  width:100%;min-width:0;border-radius:8px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-aside-cart{display:none}",
      "#sr-b2b-quickorder-root .sr-qo-aside-note{display:none}",
      "#sr-b2b-quickorder-root table.sr-qo-table{",
      "  width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed",
      "}",
      "#sr-b2b-quickorder-root table.sr-qo-table th,",
      "#sr-b2b-quickorder-root table.sr-qo-table td{",
      "  padding:6px 8px;border-bottom:0.5px solid var(--sr-qo-line);vertical-align:middle",
      "}",
      "#sr-b2b-quickorder-root table.sr-qo-table th{",
      "  text-align:left;background:var(--sr-qo-surface-2);",
      "  border-bottom:0.5px solid var(--sr-qo-line-strong);",
      "  font-size:11px;font-weight:600;color:var(--sr-qo-muted);position:sticky;top:0;z-index:1;",
      "  white-space:nowrap",
      "}",
      "#sr-b2b-quickorder-root table.sr-qo-table th.sr-qo-th-num,",
      "#sr-b2b-quickorder-root table.sr-qo-table td.sr-qo-num,",
      "#sr-b2b-quickorder-root table.sr-qo-table td.sr-qo-line-total{",
      "  text-align:right",
      "}",
      "#sr-b2b-quickorder-root table.sr-qo-table th.sr-qo-th-stock,",
      "#sr-b2b-quickorder-root table.sr-qo-table td.sr-qo-stock{text-align:center;width:118px;padding-left:4px;padding-right:4px}",
      "#sr-b2b-quickorder-root table.sr-qo-table th.sr-qo-th-qty,",
      "#sr-b2b-quickorder-root table.sr-qo-table td.sr-qo-qty-td{text-align:center;width:64px}",
      "#sr-b2b-quickorder-root table.sr-qo-table th.sr-qo-th-action,",
      "#sr-b2b-quickorder-root table.sr-qo-table td.sr-qo-td-action{width:36px;padding-left:4px;padding-right:4px}",
      "#sr-b2b-quickorder-root table.sr-qo-table col.sr-qo-col-product{width:auto}",
      "#sr-b2b-quickorder-root table.sr-qo-table col.sr-qo-col-stock{width:118px}",
      "#sr-b2b-quickorder-root table.sr-qo-table col.sr-qo-col-qty{width:64px}",
      "#sr-b2b-quickorder-root table.sr-qo-table col.sr-qo-col-price{width:92px}",
      "#sr-b2b-quickorder-root table.sr-qo-table col.sr-qo-col-total{width:100px}",
      "#sr-b2b-quickorder-root table.sr-qo-table col.sr-qo-col-action{width:36px}",
      "#sr-b2b-quickorder-root .sr-qo-stock-chip{",
      "  display:inline-flex;align-items:center;justify-content:center;",
      "  height:22px;padding:0 8px;border-radius:999px;",
      "  font-size:11px;font-weight:650;line-height:1;white-space:nowrap",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-stock-chip.is-ok{",
      "  background:rgba(47,111,78,.12);color:var(--sr-qo-ok)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-stock-chip.is-out,",
      "#sr-b2b-quickorder-root .sr-qo-stock-chip.is-blocked{",
      "  background:rgba(163,45,45,.1);color:var(--sr-qo-danger)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-stock-chip.is-pending{",
      "  background:var(--sr-qo-surface-2);color:var(--sr-qo-muted)",
      "}",
      "#sr-b2b-quickorder-root table.sr-qo-table tbody tr{transition:background .15s ease}",
      "#sr-b2b-quickorder-root table.sr-qo-table tbody tr:hover{background:var(--sr-qo-accent-soft)}",
      "#sr-b2b-quickorder-root table.sr-qo-table tr.sr-qo-row-flash{animation:sr-qo-row-flash .45s ease}",
      "#sr-b2b-quickorder-root table.sr-qo-table tr.sr-qo-row-err{",
      "  box-shadow:inset 2px 0 0 var(--sr-qo-danger)",
      "}",
      "#sr-b2b-quickorder-root table.sr-qo-table tr.sr-qo-row-oos{",
      "  background:rgba(163,45,45,.07);",
      "  box-shadow:inset 2px 0 0 rgba(163,45,45,.45)",
      "}",
      "#sr-b2b-quickorder-root table.sr-qo-table tr.sr-qo-row-oos:hover{",
      "  background:rgba(163,45,45,.11)",
      "}",
      "#sr-b2b-quickorder-root table.sr-qo-table tr.sr-qo-row-ok{",
      "  box-shadow:inset 2px 0 0 transparent",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-mono{",
      "  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums;font-size:12px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-name{",
      "  max-width:420px;white-space:normal;overflow-wrap:anywhere;word-break:break-word;",
      "  line-height:1.35;cursor:default",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-product.sr-qo-name{",
      "  max-width:none;overflow:hidden",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-name a.sr-qo-name-link{",
      "  color:inherit;text-decoration:underline;text-decoration-color:rgba(55,53,47,.28);",
      "  text-underline-offset:2px;cursor:pointer",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-name a.sr-qo-name-link:hover{",
      "  color:var(--sr-qo-accent);text-decoration-color:var(--sr-qo-accent)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-name.has-img{",
      "  cursor:zoom-in;text-decoration:none",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-name.has-img a.sr-qo-name-link{",
      "  cursor:pointer",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-num{",
      "  font-variant-numeric:tabular-nums;font-weight:600;font-size:13px;",
      "  white-space:nowrap",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-num.is-muted{font-weight:500;color:var(--sr-qo-muted)}",
      "#sr-b2b-quickorder-root .sr-qo-num.is-deal{font-weight:700;color:var(--sr-qo-ok)}",
      "#sr-b2b-quickorder-root .sr-qo-qty-wrap{",
      "  display:flex;flex-direction:column;align-items:center;gap:3px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-tier-nudge{",
      "  appearance:none;border:0;background:transparent;padding:0;margin:0;",
      "  max-width:100%;font-size:10px;font-weight:600;line-height:1.2;",
      "  color:var(--sr-qo-muted);cursor:pointer;text-align:center;",
      "  text-decoration:underline;text-decoration-color:rgba(55,53,47,.25);",
      "  text-underline-offset:2px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-tier-nudge.is-near{",
      "  font-weight:650;color:var(--sr-qo-ok);",
      "  text-decoration-color:rgba(47,111,78,.35)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-tier-nudge:hover{",
      "  color:var(--sr-qo-accent);text-decoration-color:var(--sr-qo-accent)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-receipt-row.is-tier .k{",
      "  color:var(--sr-qo-muted);font-weight:600",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-receipt-row.is-tier .v{",
      "  color:var(--sr-qo-text);font-weight:600;font-size:12px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-receipt-row.is-tier.is-near .k,",
      "#sr-b2b-quickorder-root .sr-qo-receipt-row.is-tier.is-near .v{",
      "  color:var(--sr-qo-ok);font-weight:650",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-product-name{",
      "  font-weight:600;line-height:1.25;font-size:13px;",
      "  overflow:hidden;text-overflow:ellipsis;white-space:nowrap",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-product-meta{",
      "  margin-top:1px;font-size:10px;font-weight:500;color:var(--sr-qo-muted);",
      "  font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-line-total{",
      "  font-variant-numeric:tabular-nums;font-weight:700;white-space:nowrap;font-size:13px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-qty-input{",
      "  width:52px;height:26px;padding:0 4px;border:0.5px solid var(--sr-qo-line-strong);border-radius:6px;",
      "  font-size:12px;font-variant-numeric:tabular-nums;background:var(--sr-qo-surface-2);text-align:center",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-qty-input.sr-qo-qty-over{",
      "  border-color:var(--sr-qo-danger);outline:2px solid rgba(163,45,45,.2);background:#FDF2F2",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-status{",
      "  display:inline-block;padding:0;border-radius:0;font-size:11px;font-weight:600;background:transparent",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-status-ok{color:var(--sr-qo-ok)}",
      "#sr-b2b-quickorder-root .sr-qo-status-err{color:var(--sr-qo-danger)}",
      "#sr-b2b-quickorder-root .sr-qo-status-wait{color:var(--sr-qo-faint)}",
      "#sr-b2b-quickorder-root .sr-qo-del{",
      "  border:none;background:transparent;color:var(--sr-qo-faint);cursor:pointer;",
      "  width:28px;height:28px;padding:0;border-radius:8px;",
      "  display:inline-flex;align-items:center;justify-content:center;flex-shrink:0",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-del svg{display:block;width:15px;height:15px}",
      "#sr-b2b-quickorder-root .sr-qo-del:hover{color:var(--sr-qo-danger);background:rgba(163,45,45,.08)}",
      "#sr-b2b-quickorder-root .sr-qo-del:focus-visible{outline:2px solid rgba(163,45,45,.35);outline-offset:1px}",
      "#sr-b2b-quickorder-root .sr-qo-footer{",
      "  display:flex;flex-direction:column;gap:0;flex-shrink:0;",
      "  background:var(--sr-qo-bg);",
      "  border-top:0.5px solid var(--sr-qo-line-strong)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-footer-main{",
      "  display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;",
      "  min-height:96px;padding:12px 16px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-footer-msg{",
      "  flex:1;min-width:120px;font-size:12px;color:var(--sr-qo-muted)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-footer-msg.err{color:var(--sr-qo-danger);font-weight:600}",
      "#sr-b2b-quickorder-root .sr-qo-footer-msg[hidden]{display:none!important}",
      "#sr-b2b-quickorder-root .sr-qo-footer-actions{display:flex;gap:8px;align-items:center;flex-shrink:0;align-self:center}",
      "#sr-b2b-quickorder-root .sr-qo-foot-progress{",
      "  flex:1;min-width:min(100%,280px);max-width:520px;display:flex;flex-direction:column;gap:6px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-foot-progress[hidden]{display:none!important}",
      "#sr-b2b-quickorder-root .sr-qo-foot-top{",
      "  display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-foot-chip{",
      "  display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:6px;",
      "  font-size:11.5px;font-weight:750;letter-spacing:-.01em;white-space:nowrap;",
      "  background:var(--sr-qo-surface-2);border:1px solid var(--sr-qo-line-strong);color:var(--sr-qo-text)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-foot-chip.is-current{",
      "  background:rgba(15,123,108,.12);border-color:rgba(15,123,108,.45);color:var(--sr-qo-accent)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-foot-chip.is-next{",
      "  background:var(--sr-qo-accent);border-color:var(--sr-qo-accent);color:#fff;",
      "  box-shadow:0 1px 2px rgba(15,123,108,.25)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-foot-pct{",
      "  margin:0;font-size:12px;font-weight:700;color:var(--sr-qo-muted);",
      "  font-variant-numeric:tabular-nums;letter-spacing:-.02em;flex-shrink:0",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-foot-gap{",
      "  margin:0;font-size:17px;font-weight:800;line-height:1.15;",
      "  letter-spacing:-.03em;color:var(--sr-qo-text);font-variant-numeric:tabular-nums",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-foot-gap em{",
      "  font-style:normal;font-weight:800;color:var(--sr-qo-accent)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-foot-progress[data-urgency='high'] .sr-qo-foot-gap em{",
      "  color:var(--sr-qo-warn)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-foot-progress[data-urgency='high'] .sr-qo-foot-pct{",
      "  color:var(--sr-qo-warn)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-foot-progress[data-urgency='done'] .sr-qo-foot-gap{",
      "  color:var(--sr-qo-ok);font-weight:700;font-size:15px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-foot-progress[data-urgency='done'] .sr-qo-foot-chip.is-current{",
      "  border-color:rgba(47,111,78,.45);background:rgba(47,111,78,.14);color:var(--sr-qo-ok)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-foot-progress[data-urgency='done'] .sr-qo-foot-pct{",
      "  color:var(--sr-qo-ok)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-foot-bar-row{",
      "  display:flex;align-items:center;gap:10px;min-width:0",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-foot-bar{",
      "  flex:1;min-width:0;height:10px;border-radius:5px;background:rgba(55,53,47,.12);overflow:hidden",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-foot-bar[hidden]{display:none!important}",
      "#sr-b2b-quickorder-root .sr-qo-foot-bar > i{",
      "  display:block;height:100%;width:0;border-radius:5px;",
      "  background:var(--sr-qo-accent);",
      "  transition:width .35s var(--sr-qo-ease)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-foot-progress[data-urgency='done'] .sr-qo-foot-bar > i{",
      "  background:var(--sr-qo-ok);width:100%!important",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-foot-target{",
      "  margin:0;flex-shrink:0;display:inline-flex;align-items:center;gap:6px;max-width:48%;min-width:0",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-foot-target[hidden]{display:none!important}",
      "#sr-b2b-quickorder-root .sr-qo-foot-target-arrow{",
      "  font-size:13px;font-weight:700;color:var(--sr-qo-faint);flex-shrink:0",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-foot-reward{",
      "  margin:0;display:flex;flex-wrap:wrap;align-items:center;gap:8px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-foot-reward[hidden]{display:none!important}",
      "#sr-b2b-quickorder-root .sr-qo-foot-deal{",
      "  display:inline-flex;align-items:center;height:28px;padding:0 12px;border-radius:6px;",
      "  font-size:13.5px;font-weight:800;letter-spacing:-.02em;white-space:nowrap;",
      "  color:#9A3412;background:#FFEDD5;border:1px solid #FDBA74;",
      "  box-shadow:0 1px 2px rgba(194,65,12,.12)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-foot-deal em{",
      "  font-style:normal;font-weight:900;color:#C2410C",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-foot-detail{",
      "  margin:0;font-size:12px;font-weight:550;line-height:1.3;color:var(--sr-qo-muted)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-foot-detail[hidden]{display:none!important}",
      "@media (prefers-reduced-motion:reduce){",
      "  #sr-b2b-quickorder-root .sr-qo-foot-bar > i{transition:none}",
      "}",
      "@media (max-width:560px){",
      "  #sr-b2b-quickorder-root .sr-qo-start-grid{grid-template-columns:1fr;max-width:320px}",
      "  #sr-b2b-quickorder-root .sr-qo-foot-gap{font-size:15px}",
      "  #sr-b2b-quickorder-root .sr-qo-foot-reward{font-size:13px}",
      "  #sr-b2b-quickorder-root .sr-qo-footer-main{min-height:88px;padding:10px 12px}",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-close{",
      "  height:28px;padding:0 10px;border:0.5px solid var(--sr-qo-line-strong);border-radius:8px;",
      "  background:var(--sr-qo-surface-2);cursor:pointer;font-size:12px;font-weight:550;color:var(--sr-qo-text);",
      "  display:inline-flex;align-items:center;gap:6px;white-space:nowrap",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-close:hover{background:var(--sr-qo-surface)}",
      "#sr-b2b-quickorder-root .sr-qo-views{",
      "  flex:1;min-height:0;display:flex;flex-direction:column;position:relative",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-view{",
      "  display:none;flex:1;min-height:0;flex-direction:column",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-view.is-active{",
      "  display:flex;animation:sr-qo-view-in 160ms var(--sr-qo-ease) both",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-placeholder{",
      "  flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;",
      "  padding:48px 24px;text-align:center;background:var(--sr-qo-bg)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-placeholder-title{",
      "  margin:0;font-size:22px;font-weight:600;letter-spacing:-.03em;line-height:1.2;color:var(--sr-qo-text)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-placeholder-sub{",
      "  margin:8px 0 0;max-width:340px;font-size:15px;font-weight:400;line-height:1.45;color:var(--sr-qo-muted)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-orders{",
      "  flex:1;min-height:0;display:flex;flex-direction:column;background:var(--sr-qo-bg)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-orders-pane{",
      "  flex:1;min-height:0;display:none;flex-direction:column",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-orders-pane.is-on{display:flex}",
      "#sr-b2b-quickorder-root .sr-qo-orders-toolbar{",
      "  display:flex;align-items:center;gap:10px;flex-wrap:wrap;",
      "  padding:10px 16px;border-bottom:0.5px solid var(--sr-qo-line);",
      "  background:var(--sr-qo-surface);flex-shrink:0",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-orders-toolbar h3{",
      "  margin:0;font-size:15px;font-weight:600;letter-spacing:-.02em;flex:1",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-orders-scroll{",
      "  flex:1;min-height:0;overflow:auto",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-orders-table{width:100%;border-collapse:collapse;font-size:13px;background:var(--sr-qo-surface)}",
      "#sr-b2b-quickorder-root .sr-qo-orders-table th{",
      "  text-align:left;padding:8px 14px;background:var(--sr-qo-surface-2);",
      "  border-bottom:0.5px solid var(--sr-qo-line-strong);",
      "  font-size:11px;font-weight:600;color:var(--sr-qo-muted);position:sticky;top:0;z-index:1",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-orders-table td{",
      "  padding:10px 14px;border-bottom:0.5px solid var(--sr-qo-line);vertical-align:middle",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-orders-table tbody tr{",
      "  cursor:pointer;transition:background .12s ease",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-orders-table tbody tr:hover{background:var(--sr-qo-accent-soft)}",
      "#sr-b2b-quickorder-root .sr-qo-orders-table .num{font-variant-numeric:tabular-nums;font-weight:600}",
      "#sr-b2b-quickorder-root .sr-qo-orders-table .muted{color:var(--sr-qo-muted);font-size:12px}",
      "#sr-b2b-quickorder-root .sr-qo-st{",
      "  display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:550;color:var(--sr-qo-text)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-st-dot{",
      "  width:7px;height:7px;border-radius:50%;background:var(--sr-qo-faint);flex-shrink:0",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-orders-actions{display:flex;gap:6px;justify-content:flex-end}",
      "#sr-b2b-quickorder-root .sr-qo-btn-sm{",
      "  height:28px;padding:0 10px;border-radius:8px;font-size:12px;font-weight:600;",
      "  border:0.5px solid var(--sr-qo-line-strong);background:var(--sr-qo-surface);color:var(--sr-qo-text);cursor:pointer",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-btn-sm:hover{background:var(--sr-qo-surface-2)}",
      "#sr-b2b-quickorder-root .sr-qo-btn-sm:disabled{",
      "  opacity:.45;cursor:not-allowed;pointer-events:none",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-btn-sm-primary{",
      "  background:var(--sr-qo-accent);color:#fff;border-color:transparent",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-btn-sm-primary:hover,",
      "#sr-b2b-quickorder-root .sr-qo-btn-sm-primary:focus-visible{",
      "  background:var(--sr-qo-accent);color:#fff;border-color:transparent;filter:brightness(1.08)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-btn-sm-primary:disabled{",
      "  background:var(--sr-qo-accent);color:#fff;opacity:.45;filter:none",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-orders-selbar .sr-qo-btn-sm:hover{",
      "  background:var(--sr-qo-surface)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-orders-selbar .sr-qo-btn-sm-primary:hover,",
      "#sr-b2b-quickorder-root .sr-qo-orders-selbar .sr-qo-btn-sm-primary:focus-visible{",
      "  background:var(--sr-qo-accent);color:#fff;filter:brightness(1.08)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-orders-detail-meta{",
      "  display:flex;flex-wrap:wrap;gap:8px 16px;padding:10px 16px;",
      "  border-bottom:0.5px solid var(--sr-qo-line);background:var(--sr-qo-surface);",
      "  font-size:12px;color:var(--sr-qo-muted);flex-shrink:0",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-orders-detail-meta strong{color:var(--sr-qo-text);font-weight:600}",
      "#sr-b2b-quickorder-root .sr-qo-orders-foot{",
      "  display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;",
      "  min-height:52px;padding:10px 16px;background:var(--sr-qo-bg);",
      "  border-top:0.5px solid var(--sr-qo-line-strong);flex-shrink:0",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-check{width:16px;height:16px;accent-color:var(--sr-qo-accent)}",
      "#sr-b2b-quickorder-root .sr-qo-toolbar{",
      "  display:flex;align-items:center;gap:8px;flex-wrap:wrap;",
      "  padding:10px 16px;border-bottom:0.5px solid var(--sr-qo-line);flex-shrink:0;",
      "  background:var(--sr-qo-surface)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-toolbar-spacer{flex:1;min-width:8px}",
      "#sr-b2b-quickorder-root .sr-qo-header-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap}",
      "#sr-b2b-quickorder-root .sr-qo-input{",
      "  box-sizing:border-box;height:36px;padding:0 11px;border:0.5px solid var(--sr-qo-line-strong);",
      "  border-radius:10px;font-size:13px;background:var(--sr-qo-surface-2);color:var(--sr-qo-text)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-input:focus{",
      "  outline:2px solid var(--sr-qo-accent-soft);outline-offset:0;border-color:var(--sr-qo-accent);background:var(--sr-qo-surface)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-input.sr-qo-input-err{",
      "  border-color:var(--sr-qo-danger);outline:2px solid rgba(163,45,45,.25);background:#FDF2F2",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-toast{",
      "  position:absolute;left:50%;top:56px;transform:translateX(-50%) translateY(-6px);",
      "  z-index:5;max-width:min(420px,calc(100% - 32px));",
      "  padding:10px 14px;border-radius:12px;font-size:13px;font-weight:600;",
      "  background:var(--sr-qo-text);color:#fff;",
      "  box-shadow:0 12px 32px rgba(26,25,23,.28);",
      "  opacity:0;pointer-events:none;transition:opacity .15s ease,transform .15s var(--sr-qo-ease)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-toast.is-on{",
      "  opacity:1;transform:translateX(-50%) translateY(0);pointer-events:auto",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-toast.err{background:var(--sr-qo-danger)}",
      "#sr-b2b-quickorder-root .sr-qo-toast.ok{background:var(--sr-qo-accent)}",
      "#sr-b2b-quickorder-root .sr-qo-sku-wrap{",
      "  position:relative;flex:1;min-width:160px;display:flex;flex-direction:column",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-sku-input{width:100%;min-width:0}",
      "#sr-b2b-quickorder-root .sr-qo-suggest{",
      "  display:none;position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:40;",
      "  max-height:280px;overflow:auto;background:var(--sr-qo-surface);",
      "  border:1px solid var(--sr-qo-line-strong);border-radius:12px;",
      "  box-shadow:0 12px 28px rgba(26,25,23,.12)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-suggest.is-on{display:block}",
      "#sr-b2b-quickorder-root .sr-qo-suggest-item{",
      "  display:flex;flex-direction:row;align-items:center;gap:10px;width:100%;text-align:left;",
      "  padding:8px 10px;border:0;border-bottom:1px solid var(--sr-qo-line);",
      "  background:transparent;cursor:pointer;font:inherit;color:var(--sr-qo-text)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-suggest-item:last-child{border-bottom:0}",
      "#sr-b2b-quickorder-root .sr-qo-suggest-item:hover,",
      "#sr-b2b-quickorder-root .sr-qo-suggest-item.is-active{",
      "  background:var(--sr-qo-accent-soft)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-suggest-thumb{",
      "  width:36px;height:36px;flex-shrink:0;overflow:hidden;",
      "  background:var(--sr-qo-surface-2);border:0.5px solid var(--sr-qo-line);",
      "  display:flex;align-items:center;justify-content:center",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-suggest-thumb img{",
      "  width:100%;height:100%;object-fit:cover;display:block",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-suggest-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}",
      "#sr-b2b-quickorder-root .sr-qo-suggest-sku{",
      "  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;font-weight:600;",
      "  display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 10px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-suggest-model{",
      "  font-weight:500;color:var(--sr-qo-muted);font-size:11px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-suggest-meta{",
      "  font-size:11px;color:var(--sr-qo-muted);line-height:1.35;",
      "  display:flex;flex-wrap:wrap;gap:6px 10px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-suggest-price{",
      "  flex-shrink:0;font-size:12px;font-weight:650;font-variant-numeric:tabular-nums;",
      "  color:var(--sr-qo-text);text-align:right;max-width:42%",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-suggest-empty{",
      "  padding:10px 12px;font-size:12px;color:var(--sr-qo-muted)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-qty-toolbar{width:72px}",
      "#sr-b2b-quickorder-root .sr-qo-qty-cell{display:flex;flex-direction:column;gap:2px;align-items:flex-start}",
      "#sr-b2b-quickorder-root .sr-qo-pack-hint{font-size:10px;color:var(--sr-qo-muted);line-height:1.2;max-width:88px}",
      "#sr-b2b-quickorder-root .sr-qo-line-total-cell{display:flex;flex-direction:column;gap:1px;align-items:flex-end}",
      "#sr-b2b-quickorder-root .sr-qo-line-total-meta{font-size:10px;color:var(--sr-qo-faint);font-weight:500}",
      "#sr-b2b-quickorder-root .sr-qo-btn{",
      "  height:36px;padding:0 14px;border:none;border-radius:10px;font-size:13px;",
      "  font-weight:600;cursor:pointer;touch-action:manipulation;white-space:nowrap;",
      "  transition:background .15s ease,opacity .15s ease,transform .15s var(--sr-qo-ease)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-btn:disabled{opacity:.5;cursor:not-allowed}",
      "#sr-b2b-quickorder-root .sr-qo-btn-primary{background:var(--sr-qo-accent);color:#fff}",
      "#sr-b2b-quickorder-root .sr-qo-btn-primary:hover{filter:brightness(1.06)}",
      "#sr-b2b-quickorder-root .sr-qo-btn-success{",
      "  background:var(--sr-qo-accent);color:#fff;min-width:140px;",
      "  box-shadow:inset 0 1px 0 rgba(255,255,255,.12)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-btn-success:hover{",
      "  background:var(--sr-qo-accent);color:#fff;filter:brightness(1.08)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-btn-ghost{",
      "  background:var(--sr-qo-surface-2);color:var(--sr-qo-text);",
      "  border:0.5px solid var(--sr-qo-line-strong)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-btn-link{",
      "  background:transparent;border:none;color:var(--sr-qo-accent);font-size:12px;",
      "  font-weight:600;cursor:pointer;padding:0 4px;height:36px",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-csv-wrap{width:100%;display:none;padding:0 20px 10px}",
      "#sr-b2b-quickorder-root .sr-qo-csv-wrap.is-open{display:block}",
      "#sr-b2b-quickorder-root .sr-qo-textarea{",
      "  width:100%;box-sizing:border-box;height:72px;padding:8px 10px;",
      "  border:0.5px solid var(--sr-qo-line-strong);border-radius:10px;",
      "  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;",
      "  resize:vertical;background:var(--sr-qo-surface-2)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-main{",
      "  flex:1;min-height:0;display:flex;flex-direction:row;background:var(--sr-qo-surface)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-body{flex:1;min-width:0;min-height:0;overflow:auto}",
      "#sr-b2b-quickorder-root .sr-qo-cart-confirm,",
      "#sr-b2b-quickorder-root .sr-qo-undo-bar{",
      "  display:none;width:100%;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;",
      "  padding:8px 12px;border:0.5px solid var(--sr-qo-line-strong);background:var(--sr-qo-surface-2)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-cart-confirm.is-on,",
      "#sr-b2b-quickorder-root .sr-qo-undo-bar.is-on{display:flex}",
      "#sr-b2b-quickorder-root .sr-qo-cart-confirm p,",
      "#sr-b2b-quickorder-root .sr-qo-undo-bar p{",
      "  margin:0;flex:1;min-width:160px;font-size:12px;font-weight:600;line-height:1.4;color:var(--sr-qo-text)",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-cart-confirm .sr-qo-confirm-actions,",
      "#sr-b2b-quickorder-root .sr-qo-undo-bar .sr-qo-confirm-actions{display:flex;gap:8px;flex-wrap:wrap}",
      "#sr-b2b-quickorder-root .sr-qo-tip{",
      "  position:fixed;z-index:var(--sr-qo-z-shell);pointer-events:none;padding:8px;",
      "  background:rgba(255,255,255,.88);",
      "  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);",
      "  border:0.5px solid rgba(255,255,255,.65);border-radius:14px;",
      "  box-shadow:0 16px 40px rgba(26,25,23,.2);display:none",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-tip.is-on{display:block}",
      "#sr-b2b-quickorder-root .sr-qo-tip img{display:block;width:160px;height:160px;object-fit:contain}",
      "@media (max-width:900px){",
      "  #sr-b2b-quickorder-root .sr-qo-topbar{",
      "    grid-template-columns:1fr auto;grid-template-rows:auto auto;padding:8px 12px;gap:8px",
      "  }",
      "  #sr-b2b-quickorder-root .sr-qo-brand{grid-column:1;grid-row:1}",
      "  #sr-b2b-quickorder-root .sr-qo-topbar-right{grid-column:2;grid-row:1}",
      "  #sr-b2b-quickorder-root .sr-qo-nav{",
      "    grid-column:1 / -1;grid-row:2;justify-self:stretch;width:100%;",
      "    display:flex",
      "  }",
      "  #sr-b2b-quickorder-root .sr-qo-nav-btn{flex:1;padding:0 8px;text-align:center}",
      "  #sr-b2b-quickorder-root .sr-qo-toolbar{padding:10px 12px}",
      "  #sr-b2b-quickorder-root .sr-qo-footer-main{padding:8px 12px}",
      "  #sr-b2b-quickorder-root .sr-qo-main{flex-direction:column}",
      "  #sr-b2b-quickorder-root .sr-qo-aside{",
      "    width:100%;border-left:none;border-top:0.5px solid var(--sr-qo-line-strong);",
      "    flex-direction:column;gap:10px;padding:14px 12px",
      "  }",
      "  #sr-b2b-quickorder-root .sr-qo-aside-stats{",
      "    display:flex;flex-direction:column;gap:8px",
      "  }",
      "  #sr-b2b-quickorder-root .sr-qo-aside-cart{margin-top:0}",
      "  #sr-b2b-quickorder-root .sr-qo-receipt{width:100%}",
      "  #sr-b2b-quickorder-root .sr-qo-aside-note{display:none}",
      "  #sr-b2b-quickorder-root .sr-qo-name{max-width:200px}",
      "}",
      "@media (max-width:767px){",
      "  #sr-b2b-quickorder-root table.sr-qo-table thead{display:none}",
      "  #sr-b2b-quickorder-root table.sr-qo-table,",
      "  #sr-b2b-quickorder-root table.sr-qo-table tbody{",
      "    display:block;width:100%",
      "  }",
      "  #sr-b2b-quickorder-root table.sr-qo-table tbody tr{",
      "    display:block;margin:0 0 10px;padding:10px 12px 8px;",
      "    border:0.5px solid var(--sr-qo-line-strong);background:var(--sr-qo-surface)",
      "  }",
      "  #sr-b2b-quickorder-root table.sr-qo-table tbody tr:hover{background:var(--sr-qo-surface)}",
      "  #sr-b2b-quickorder-root table.sr-qo-table td{",
      "    display:grid;grid-template-columns:96px minmax(0,1fr);gap:8px;align-items:center;",
      "    padding:6px 0;border-bottom:0.5px solid var(--sr-qo-line);width:100%;box-sizing:border-box",
      "  }",
      "  #sr-b2b-quickorder-root table.sr-qo-table td:last-child{border-bottom:0}",
      "  #sr-b2b-quickorder-root table.sr-qo-table td::before{",
      "    content:attr(data-label);font-size:11px;font-weight:600;color:var(--sr-qo-muted)",
      "  }",
      "  #sr-b2b-quickorder-root table.sr-qo-table td.sr-qo-td-action{",
      "    grid-template-columns:1fr;justify-items:end;padding-top:8px",
      "  }",
      "  #sr-b2b-quickorder-root table.sr-qo-table td.sr-qo-td-action::before{content:none}",
      "  #sr-b2b-quickorder-root .sr-qo-name{max-width:none}",
      "  #sr-b2b-quickorder-root .sr-qo-qty-input{width:88px}",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-credit{",
      "  flex-shrink:0;display:flex;align-items:center;justify-content:center;",
      "  min-height:36px;padding:8px 16px calc(10px + env(safe-area-inset-bottom, 0px));",
      "  border-top:0.5px solid var(--sr-qo-line);background:var(--sr-qo-bg);",
      "  text-decoration:none",
      "}",
      "#sr-b2b-quickorder-root .sr-qo-credit:hover .sr-qo-credit-logo{opacity:1}",
      "#sr-b2b-quickorder-root .sr-qo-credit-logo{",
      "  height:20px;width:auto;display:block;opacity:.94",
      "}",
      "@media (prefers-reduced-motion:reduce){",
      "  #sr-b2b-quickorder-root .sr-qo-shell{animation:none}",
      "  #sr-b2b-quickorder-root .sr-qo-view.is-active{animation:none}",
      "  #sr-b2b-quickorder-root table.sr-qo-table tr.sr-qo-row-flash{animation:none}",
      "}",
    ].join("");
    document.head.appendChild(style);
  }

  function formatHufClient(n) {
    if (n == null || !isFinite(n)) return "—";
    try {
      return new Intl.NumberFormat("hu-HU", {
        style: "currency",
        currency: "HUF",
        maximumFractionDigits: 0,
      }).format(Math.round(n));
    } catch (e) {
      return Math.round(n) + " Ft";
    }
  }

  function mapProductFields(p, quantity) {
    var minQty = Math.max(1, parseInt(p.minQty, 10) || 1);
    var qtyStep = Math.max(1, parseInt(p.qtyStep, 10) || 1);
    var maxQty =
      p.maxQty != null && Number(p.maxQty) > 0 ? Number(p.maxQty) : null;
    var qty = normalizePackQuantity(quantity, {
      minQty: minQty,
      qtyStep: qtyStep,
      maxQty: maxQty,
    });
    return {
      sku: p.sku,
      quantity: qty,
      productId: p.productId,
      name: p.name,
      modelNumber: p.modelNumber,
      gtin: p.gtin,
      price: p.price,
      priceNet: p.priceNet,
      priceGross: p.priceGross,
      priceNetFormatted: p.priceNetFormatted,
      priceGrossFormatted: p.priceGrossFormatted,
      listPriceNet: p.listPriceNet,
      listPriceGross: p.listPriceGross,
      listPriceNetFormatted: p.listPriceNetFormatted,
      listPriceGrossFormatted: p.listPriceGrossFormatted,
      vatRate: p.vatRate,
      vatAmountFormatted: p.vatAmountFormatted,
      discountPercent: p.discountPercent,
      discountAmountNet: p.discountAmountNet,
      discountAmountNetFormatted: p.discountAmountNetFormatted,
      priceSource: p.priceSource,
      tiers: Array.isArray(p.tiers) ? p.tiers : null,
      nextTier: p.nextTier || null,
      stockQty: p.stockQty,
      stockLabel: p.stockLabel,
      stockTone: p.stockTone,
      inStock: p.inStock,
      orderable: p.orderable,
      minQty: minQty,
      qtyStep: qtyStep,
      maxQty: maxQty,
      packLabel: p.packLabel,
      imageUrl: p.imageUrl,
      productUrl: p.productUrl,
      found: p.found,
      error: p.error,
    };
  }

  /** Snap qty to Shoprenter pack / min rules. */
  function normalizePackQuantity(qty, rules) {
    rules = rules || {};
    var minQty = Math.max(1, Math.round(Number(rules.minQty) || 1));
    var step = Math.max(1, Math.round(Number(rules.qtyStep) || 1));
    var maxQty =
      rules.maxQty != null && Number(rules.maxQty) > 0
        ? Math.round(Number(rules.maxQty))
        : null;
    var q = Math.max(minQty, Math.round(Number(qty) || minQty));
    if (step > 1) {
      q = Math.ceil(q / step) * step;
      if (q < minQty) q = Math.ceil(minQty / step) * step;
    }
    if (maxQty != null && q > maxQty) q = maxQty;
    return Math.max(1, q);
  }

  function packRulesFromLine(line) {
    return {
      minQty: line && line.minQty,
      qtyStep: line && line.qtyStep,
      maxQty: line && line.maxQty,
    };
  }

  function productPageUrl(line) {
    if (line && line.productUrl) return String(line.productUrl);
    var id = line && line.productId;
    if (id == null || id === "") return "";
    try {
      return (
        window.location.origin +
        "/index.php?route=product/product&product_id=" +
        encodeURIComponent(String(id))
      );
    } catch (e) {
      return "";
    }
  }

  function loginRedirectUrl() {
    try {
      return (
        "/customer/login?redirect=" +
        encodeURIComponent(location.pathname + location.search + "#sr-b2b-qo")
      );
    } catch (e) {
      return "/customer/login";
    }
  }

  var gateKeyHandler = null;

  function dismissAccessGate() {
    var g = document.getElementById("sr-b2b-qo-gate");
    if (g && g.parentNode) g.parentNode.removeChild(g);
    if (gateKeyHandler) {
      document.removeEventListener("keydown", gateKeyHandler, true);
      gateKeyHandler = null;
    }
  }

  function showAccessGate(kind) {
    dismissAccessGate();
    ensureFabStyles();
    var isGroup = kind === "group";
    var title = isGroup
      ? "Ez a partner rendelő"
      : "Viszonteladói gyors rendelés";
    var body = isGroup
      ? "A gyors rendelés a viszonteladói fiókokhoz tartozik. Ha van céges hozzáférésed, lépj be azzal — vagy írj a webáruháznak."
      : "Cikkszámra, a saját áraidon, a webshop kosarába. Lépj be a partner fiókoddal.";
    var cardKids = [
      el("p", { className: "sr-b2b-qo-gate-kicker" }, ["Gyors rendelés"]),
      el("h2", { id: "sr-b2b-qo-gate-title" }, [title]),
      el("p", { className: "sr-b2b-qo-gate-body" }, [body]),
    ];
    var actions = [];
    if (!isGroup) {
      actions.push(
        el(
          "a",
          {
            className: "sr-b2b-qo-gate-primary",
            href: loginRedirectUrl(),
          },
          ["Belépés"],
        ),
      );
    }
    actions.push(
      el(
        "button",
        {
          type: "button",
          className: "sr-b2b-qo-gate-ghost",
          onClick: dismissAccessGate,
        },
        [isGroup ? "Értem" : "Bezárás"],
      ),
    );
    cardKids.push(el("div", { className: "sr-b2b-qo-gate-actions" }, actions));
    var credit = turinovaCredit("sr-b2b-qo-gate-credit");
    if (credit) cardKids.push(credit);
    var backdrop = el("div", {
      className: "sr-b2b-qo-gate-backdrop",
      onClick: dismissAccessGate,
    });
    var card = el(
      "div",
      {
        className: "sr-b2b-qo-gate-card",
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "sr-b2b-qo-gate-title",
      },
      cardKids,
    );
    var wrap = el("div", { id: "sr-b2b-qo-gate" }, [backdrop, card]);
    document.body.appendChild(wrap);
    gateKeyHandler = function (e) {
      if (e.key === "Escape") {
        e.preventDefault();
        dismissAccessGate();
      }
    };
    document.addEventListener("keydown", gateKeyHandler, true);
  }

  function tryOpenPanel() {
    dismissAccessGate();
    if (!isLoggedIn()) {
      if (cfg.requireLogin || (cfg.allowedGroupIds && cfg.allowedGroupIds.length)) {
        showAccessGate("login");
        return;
      }
    } else if (!groupAllowed()) {
      showAccessGate("group");
      return;
    }
    openPanel();
  }

  function openPanel() {
    ensurePanelStyles();

    var root = document.getElementById(cfg.mountId);
    if (!root) {
      root = el("div", { id: cfg.mountId });
    }
    // Mindig a body végére: azonos z-indexnél a DOM sorrend dönt a Shoprenter sávok ellen
    document.body.appendChild(root);
    root.innerHTML = "";
    applyPanelTheme(root);

    var fabBtn = document.getElementById("sr-b2b-qo-btn");
    if (fabBtn) fabBtn.style.display = "none";

    var lines = loadDraft();
    var busy = false;
    var prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    try {
      history.replaceState(null, "", "#sr-b2b-qo");
    } catch (e) {}

    var tip = el("div", { className: "sr-qo-tip", "aria-hidden": "true" }, [
      el("img", { alt: "" }),
    ]);
    var tipImg = tip.querySelector("img");
    var toastEl = el("div", {
      className: "sr-qo-toast",
      role: "status",
      "aria-live": "assertive",
    });
    var partnerProgressOn = false;
    var partnerProgressEl = null;

    function hideTip() {
      tip.classList.remove("is-on");
    }

    function showTip(url, ev) {
      if (!url || !tipImg) return;
      tipImg.src = url;
      tip.classList.add("is-on");
      var x = Math.min(ev.clientX + 14, window.innerWidth - 180);
      var y = Math.min(ev.clientY + 14, window.innerHeight - 180);
      tip.style.left = x + "px";
      tip.style.top = y + "px";
    }

    var reviewApplyBtn = null;
    var excelParseBtn = null;
    var emailParseBtn = null;

    function setBusy(v) {
      busy = v;
      addBtn.disabled = v;
      if (importBtn) importBtn.disabled = v;
      if (clearBtn) clearBtn.disabled = v;
      if (cartBtn) cartBtn.disabled = v;
      if (reviewApplyBtn) reviewApplyBtn.disabled = v;
      if (excelParseBtn) excelParseBtn.disabled = v;
      if (emailParseBtn) emailParseBtn.disabled = v;
    }

    function counts() {
      var total = lines.length,
        ok = 0,
        err = 0,
        qty = 0,
        overStock = 0;
      lines.forEach(function (l) {
        qty += l.quantity || 0;
        if (l.found === true) ok++;
        else if (l.found === false) err++;
        if (
          l.found === true &&
          typeof l.stockQty === "number" &&
          l.stockQty >= 0 &&
          (l.quantity || 0) > l.stockQty
        ) {
          overStock++;
        }
      });
      return { total: total, ok: ok, err: err, qty: qty, overStock: overStock };
    }

    /** Hard block: missing / not orderable. OOS can still go to cart if shop allows. */
    function lineIsCartable(l) {
      if (!l || l.found !== true || !l.productId) return false;
      if (l.orderable === false) return false;
      if (l.stockTone === "blocked") return false;
      return true;
    }

    function lineIsOutOfStock(l) {
      if (!l || l.found !== true) return false;
      if (l.orderable === false || l.stockTone === "blocked") return false;
      if (l.stockTone === "out") return true;
      if (l.inStock === false) return true;
      if (typeof l.stockQty === "number" && l.stockQty <= 0) return true;
      if (
        typeof l.stockQty === "number" &&
        l.stockQty >= 0 &&
        (l.quantity || 0) > l.stockQty
      ) {
        return true;
      }
      return false;
    }

    function lineNeedsAttention(l) {
      if (!l) return true;
      if (l.found === false) return true;
      if (l.found !== true) return true;
      if (!lineIsCartable(l)) return true;
      if (lineIsOutOfStock(l)) return true;
      return false;
    }

    function lineInStockOk(l) {
      return lineIsCartable(l) && !lineIsOutOfStock(l);
    }

    function linePriceUp(l) {
      return (
        typeof l.prevPriceNet === "number" &&
        typeof l.priceNet === "number" &&
        l.priceNet - l.prevPriceNet >= 1
      );
    }

    function lineOverStock(l) {
      return (
        l.found === true &&
        typeof l.stockQty === "number" &&
        l.stockQty >= 0 &&
        (l.quantity || 0) > l.stockQty
      );
    }

    function safetyReport() {
      var missing = 0,
        pending = 0,
        blocked = 0,
        oos = 0,
        over = 0,
        priceUp = 0,
        cartable = 0,
        inStock = 0;
      lines.forEach(function (l) {
        if (l.found === false) missing++;
        else if (l.found !== true) pending++;
        else if (!lineIsCartable(l)) blocked++;
        else {
          cartable++;
          if (lineIsOutOfStock(l)) oos++;
          else inStock++;
        }
        if (lineOverStock(l)) over++;
        if (linePriceUp(l)) priceUp++;
      });
      return {
        missing: missing,
        pending: pending,
        blocked: blocked,
        oos: oos,
        over: over,
        priceUp: priceUp,
        cartable: cartable,
        inStock: inStock,
        hardBlockers: missing + blocked + pending,
        hasBlockers: missing + blocked + pending > 0,
        hasWarnings: oos + over + priceUp > 0,
      };
    }

    function moneyTotals() {
      var net = 0,
        gross = 0,
        discount = 0;
      lines.forEach(function (l) {
        if (l.found !== true) return;
        var q = l.quantity || 1;
        var unitNet = l.priceNet != null ? l.priceNet : l.price;
        var unitGross = l.priceGross;
        if (unitNet == null && unitGross == null) return;
        if (unitNet != null) net += unitNet * q;
        if (unitGross != null) gross += unitGross * q;
        else if (unitNet != null && l.vatRate != null) {
          gross += Math.round(unitNet * (1 + l.vatRate / 100)) * q;
        }
        if (typeof l.listPriceNet === "number" && typeof unitNet === "number") {
          discount += Math.max(0, l.listPriceNet - unitNet) * q;
        } else if (
          typeof l.discountPercent === "number" &&
          l.discountPercent > 0 &&
          typeof unitNet === "number"
        ) {
          var listGuess = unitNet / (1 - l.discountPercent / 100);
          discount += Math.max(0, listGuess - unitNet) * q;
        }
      });
      return {
        net: Math.round(net),
        gross: Math.round(gross),
        vat: Math.max(0, Math.round(gross - net)),
        discount: Math.round(discount),
        discountPct:
          net + discount > 0
            ? Math.round((discount / (net + discount)) * 1000) / 10
            : 0,
        nearTierCount: lines.filter(function (l) {
          return (
            l.found === true &&
            l.nextTier &&
            l.nextTier.near &&
            l.priceSource !== "own" &&
            l.priceSource !== "group"
          );
        }).length,
      };
    }

    function persist() {
      saveDraft(lines);
    }

    function closePanel() {
      persist();
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      root.innerHTML = "";
      if (fabBtn) fabBtn.style.display = "";
      try {
        if (location.hash === "#sr-b2b-qo") {
          history.replaceState(null, "", location.pathname + location.search);
        }
      } catch (e) {}
    }

    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        closePanel();
      }
    }

    function setStatus(msg, isErr) {
      if (!isErr && partnerProgressOn && msg) {
        /* FOMO footer stays; no toast spam for routine status (Ár… / Hozzáadva…). */
        statusEl.textContent = "";
        statusEl.className = "sr-qo-footer-msg";
        statusEl.hidden = true;
        if (partnerProgressEl) partnerProgressEl.hidden = false;
        return;
      }
      statusEl.textContent = msg || "";
      statusEl.className = "sr-qo-footer-msg" + (isErr ? " err" : "");
      if (isErr || msg) {
        statusEl.hidden = false;
        if (isErr && partnerProgressEl) partnerProgressEl.hidden = true;
      } else if (partnerProgressOn) {
        statusEl.hidden = true;
        if (partnerProgressEl) partnerProgressEl.hidden = false;
      } else {
        statusEl.hidden = false;
      }
    }

    var toastTimer = null;
    function flashError(msg) {
      setStatus(msg, true);
      if (skuInput) {
        skuInput.classList.add("sr-qo-input-err");
      }
      toastEl.textContent = msg || "Hiba";
      toastEl.className = "sr-qo-toast err is-on";
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
        toastEl.classList.remove("is-on");
        if (skuInput) skuInput.classList.remove("sr-qo-input-err");
      }, 2200);
    }

    function flashInfo(msg, tone) {
      /* Never call setStatus here when partnerProgressOn — that path calls flashInfo. */
      if (partnerProgressOn) {
        statusEl.textContent = "";
        statusEl.className = "sr-qo-footer-msg";
        statusEl.hidden = true;
        if (partnerProgressEl) partnerProgressEl.hidden = false;
      } else {
        statusEl.textContent = msg || "";
        statusEl.className = "sr-qo-footer-msg";
        statusEl.hidden = !msg;
      }
      toastEl.textContent = msg || "";
      toastEl.className =
        "sr-qo-toast is-on " + (tone === "warn" ? "warn" : "info");
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
        toastEl.classList.remove("is-on");
      }, 3200);
    }

    var lastReorderDiff = null;

    function computeReorderDiff(pairs, products) {
      var diff = {
        priceUp: 0,
        priceDown: 0,
        missing: 0,
        stockOut: 0,
        stockLow: 0,
      };
      products.forEach(function (p, j) {
        var prev = pairs[j];
        if (!p || !p.found) {
          diff.missing++;
          return;
        }
        var oldNet = prev && prev.prevPriceNet;
        var nowNet = p.priceNet != null ? p.priceNet : p.price;
        if (typeof oldNet === "number" && typeof nowNet === "number") {
          var delta = nowNet - oldNet;
          if (delta >= 1) diff.priceUp++;
          else if (delta <= -1) diff.priceDown++;
        }
        if (p.orderable === false || p.stockTone === "blocked") {
          diff.stockOut++;
        } else if (p.stockTone === "out" || (typeof p.stockQty === "number" && p.stockQty <= 0)) {
          diff.stockOut++;
        } else if (p.stockTone === "low") {
          diff.stockLow++;
        }
      });
      return diff;
    }

    function diffSummaryText(diff) {
      if (!diff) return "";
      var parts = [];
      if (diff.priceUp) parts.push(diff.priceUp + " ár↑");
      if (diff.priceDown) parts.push(diff.priceDown + " ár↓");
      if (diff.missing) parts.push(diff.missing + " hiányzik");
      if (diff.stockOut) parts.push(diff.stockOut + " nincs készleten");
      else if (diff.stockLow) parts.push(diff.stockLow + " alacsony készlet");
      return parts.join(" · ");
    }

    function updateSummary() {
      var c = counts();
      var m = moneyTotals();
      summaryEl.innerHTML = "";
      summaryEl.appendChild(
        el("span", { className: "sr-qo-badge" }, [c.total + " sor"]),
      );
      if (c.ok)
        summaryEl.appendChild(
          el("span", { className: "sr-qo-badge sr-qo-badge-ok" }, [
            c.ok + " OK",
          ]),
        );
      if (c.err)
        summaryEl.appendChild(
          el("span", { className: "sr-qo-badge sr-qo-badge-err" }, [
            c.err + " hiba",
          ]),
        );
      if (c.total)
        summaryEl.appendChild(
          el("span", { className: "sr-qo-badge sr-qo-badge-save" }, ["Mentve"]),
        );
      if (lastReorderDiff) {
        if (lastReorderDiff.priceUp)
          summaryEl.appendChild(
            el("span", { className: "sr-qo-badge-pill up" }, [
              lastReorderDiff.priceUp + " ár↑",
            ]),
          );
        if (lastReorderDiff.priceDown)
          summaryEl.appendChild(
            el("span", { className: "sr-qo-badge-pill down" }, [
              lastReorderDiff.priceDown + " ár↓",
            ]),
          );
        if (lastReorderDiff.missing)
          summaryEl.appendChild(
            el("span", { className: "sr-qo-badge-pill miss" }, [
              lastReorderDiff.missing + " hiányzik",
            ]),
          );
        if (lastReorderDiff.stockOut)
          summaryEl.appendChild(
            el("span", { className: "sr-qo-badge-pill stock" }, [
              lastReorderDiff.stockOut + " nincs készleten",
            ]),
          );
      }

      asideStats.innerHTML = "";
      var sAside = safetyReport();
      var hardN = sAside.hardBlockers || 0;
      var oosN = sAside.oos || 0;

      function receiptRow(label, value, cls) {
        return el(
          "div",
          { className: "sr-qo-receipt-row" + (cls ? " " + cls : "") },
          [
            el("span", { className: "k" }, [label]),
            el("span", { className: "v" }, [value]),
          ],
        );
      }

      function receiptSaveRow(label, amountText, pctText) {
        var chipKids = [
          el("span", { className: "sr-qo-receipt-save-amt" }, [amountText]),
        ];
        if (pctText) {
          chipKids.push(
            el("span", { className: "sr-qo-receipt-save-pct" }, [pctText]),
          );
        }
        return el("div", { className: "sr-qo-receipt-row is-save" }, [
          el("span", { className: "k" }, [label]),
          el("span", { className: "v" }, [
            el("span", { className: "sr-qo-receipt-save-chip" }, chipKids),
          ]),
        ]);
      }

      var receipt = el("div", { className: "sr-qo-receipt" });
      receipt.appendChild(
        el("div", { className: "sr-qo-receipt-head" }, ["Összesítés"]),
      );
      var bodyBox = el("div", { className: "sr-qo-receipt-body" });

      if (!c.total) {
        bodyBox.appendChild(receiptRow("Nettó", "—", "is-total"));
        bodyBox.appendChild(receiptRow("Tételek", "0", "is-muted"));
      } else {
        bodyBox.appendChild(
          receiptRow("Nettó", formatHufClient(m.net), "is-total"),
        );
        bodyBox.appendChild(
          receiptRow(
            "Tételek",
            c.total + " · " + c.qty + " db",
            "is-muted",
          ),
        );

        if (m.discount > 0) {
          var listNetTotal = m.net + m.discount;
          bodyBox.appendChild(el("hr", { className: "sr-qo-receipt-rule" }));
          bodyBox.appendChild(
            receiptRow(
              "Bolti ár (nettó)",
              formatHufClient(listNetTotal),
              "is-muted",
            ),
          );
          bodyBox.appendChild(
            receiptSaveRow(
              "Partner kedvezmény",
              "−" + formatHufClient(m.discount),
              m.discountPct > 0 ? "(−" + m.discountPct + "%)" : "",
            ),
          );
        }

        var nearHints = collectNextTierHints();
        if (nearHints.length) {
          if (!(m.discount > 0)) {
            bodyBox.appendChild(el("hr", { className: "sr-qo-receipt-rule" }));
          }
          var anyNear = nearHints.some(function (h) {
            return h.next.near;
          });
          var missSum = 0;
          nearHints.forEach(function (h) {
            missSum += h.next.missingQty;
          });
          var tierLabel = "Partner sáv";
          var tierVal;
          if (nearHints.length === 1) {
            tierVal = tierHintLabel(nearHints[0].next);
          } else if (anyNear) {
            tierVal =
              "+" +
              missSum +
              " db a jobb sávokhoz (" +
              nearHints.length +
              " termék)";
          } else {
            tierVal =
              nearHints.length +
              " terméknél elérhető jobb sáv";
          }
          bodyBox.appendChild(
            receiptRow(
              tierLabel,
              tierVal,
              "is-tier" + (anyNear ? " is-near" : ""),
            ),
          );
        }

        if (hardN > 0) {
          bodyBox.appendChild(
            receiptRow(
              "Nem rendelhető",
              String(hardN),
              "is-warn",
            ),
          );
        }
        if (oosN > 0) {
          bodyBox.appendChild(
            receiptRow(
              "Nincs készleten",
              String(oosN),
              "is-warn",
            ),
          );
        }

        if (m.vat > 0 || m.gross > 0) {
          bodyBox.appendChild(el("hr", { className: "sr-qo-receipt-rule" }));
          if (m.vat > 0) {
            bodyBox.appendChild(
              receiptRow("ÁFA", formatHufClient(m.vat), "is-muted"),
            );
          }
          bodyBox.appendChild(
            receiptRow("Bruttó", formatHufClient(m.gross), "is-muted"),
          );
        }
      }

      receipt.appendChild(bodyBox);

      var foot = el("div", { className: "sr-qo-receipt-foot" });
      if (asideCartBtn) {
        foot.appendChild(asideCartBtn);
      }
      receipt.appendChild(foot);
      asideStats.appendChild(receipt);

      updateOrderRemind();
      updateIncentiveBar(m.gross);
      updateEmptyState();

      var cartLabel =
        m.net > 0
          ? "Kosárba rakom · " + formatHufClient(m.net)
          : c.total === 0
            ? "Kosárba rakom"
            : "Kosárba rakom (" + c.total + ")";
      if (cartBtn) cartBtn.textContent = cartLabel;
      if (asideCartBtn) asideCartBtn.textContent = cartLabel;
    }

    var insightsData = null;
    var insightsLoading = false;
    var cartBtn = null;
    var asideCartBtn = null;
    var emptyEl = null;
    var DEFAULT_INCENTIVES = {
      freeShippingGross: 80000,
      freeShippingLabel: "80\u00a0000 Ft",
      minOrderGross: 25000,
      minOrderLabel: "25\u00a0000 Ft",
    };

    function incentives() {
      return (insightsData && insightsData.incentives) || DEFAULT_INCENTIVES;
    }

    function updateIncentiveBar() {
      if (incentiveBox) {
        incentiveBox.style.display = "none";
        incentiveBox.innerHTML = "";
      }
    }

    function updateOrderRemind() {
      if (!orderRemind) return;
      var hint =
        insightsData &&
        insightsData.stats &&
        insightsData.stats.nextOrderHint
          ? insightsData.stats.nextOrderHint
          : "";
      if (!hint || lines.length) {
        orderRemind.className = "sr-qo-remind";
        orderRemind.innerHTML = "";
        return;
      }
      orderRemind.className = "sr-qo-remind is-on";
      orderRemind.innerHTML = "";
      orderRemind.appendChild(el("p", null, [hint]));
      if (insightsData && insightsData.lastOrder && insightsData.lastOrder.lines) {
        orderRemind.appendChild(
          el(
            "button",
            {
              type: "button",
              className: "sr-qo-btn sr-qo-btn-primary",
              onClick: function () {
                importReorderLines(insightsData.lastOrder.lines, {
                  replace: false,
                });
              },
            },
            ["Utolsó rendelés újra"],
          ),
        );
      }
    }

    function insightForSku(sku) {
      if (!insightsData || !sku) return null;
      var key = String(sku).trim().toUpperCase();
      var pools = []
        .concat(insightsData.topProducts || [])
        .concat(insightsData.dueSoon || []);
      for (var i = 0; i < pools.length; i++) {
        var p = pools[i];
        if (
          String(p.sku || "").toUpperCase() === key ||
          String(p.modelNumber || "").toUpperCase() === key
        ) {
          return p;
        }
      }
      return null;
    }

    function suggestedQtyForLine(l) {
      var hit =
        insightForSku(l.sku) ||
        insightForSku(l.modelNumber) ||
        null;
      if (hit) return hit.suggestedQty || l.quantity || 1;
      return Math.max(1, parseInt(l.quantity, 10) || 1);
    }

    async function addProductsFromInsights(list, mode) {
      mode = mode || "suggested";
      var pairs = (list || [])
        .map(function (p) {
          var q =
            mode === "boost"
              ? p.boostQty
              : mode === "last"
                ? p.lastQty
                : p.suggestedQty;
          return {
            sku: (p.sku || p.modelNumber || "").trim(),
            quantity: Math.max(1, parseInt(q, 10) || 1),
          };
        })
        .filter(function (x) {
          return x.sku;
        });
      if (!pairs.length) {
        flashError("Nincs hozzáadható tétel.");
        return;
      }
      await importReorderLines(pairs, { replace: false });
    }

    function lineUnitNet(line) {
      if (line.priceNet != null) return line.priceNet;
      if (line.price != null) return line.price;
      return null;
    }

    /**
     * Következő olcsóbb sáv hint.
     * - mindig (ha van értelmes save) — tájékoztató
     * - near — erősebb FOMO
     * - savePct < 3% → elrejt
     * - missing/qty > 10 → csak tájékoztató (nem near kiemelés)
     */
    function lineNextTierHint(line) {
      if (!line || line.found !== true) return null;
      if (line.priceSource === "own") return null;
      var nt = line.nextTier;
      if (!nt) return null;
      var missing = Math.round(Number(nt.missingQty) || 0);
      var minQty = Math.round(Number(nt.minQty) || 0);
      var priceNet = Number(nt.priceNet);
      var savePct = Number(nt.savePct) || 0;
      if (missing < 1 || minQty < 1 || !Number.isFinite(priceNet)) return null;
      if (savePct < 3) return null;
      var qty = Math.max(1, Math.round(Number(line.quantity) || 1));
      var far = missing / qty > 10;
      var near = Boolean(nt.near) && !far;
      return {
        missingQty: missing,
        minQty: minQty,
        priceNet: Math.round(priceNet),
        savePct: savePct,
        near: near,
      };
    }

    function collectNextTierHints() {
      var out = [];
      lines.forEach(function (l, i) {
        var nt = lineNextTierHint(l);
        if (nt) out.push({ idx: i, line: l, next: nt });
      });
      return out;
    }

    function tierHintLabel(hint) {
      if (hint.near) {
        return (
          "+" +
          hint.missingQty +
          " db → " +
          formatHufClient(hint.priceNet) +
          "/db" +
          (hint.savePct > 0 ? " (−" + hint.savePct + "%)" : "")
        );
      }
      return (
        hint.minQty +
        "+ → " +
        formatHufClient(hint.priceNet) +
        "/db" +
        (hint.savePct > 0 ? " (−" + hint.savePct + "%)" : "")
      );
    }

    function lineListNet(line) {
      if (line.listPriceNet != null) return line.listPriceNet;
      return lineUnitNet(line);
    }

    function netCell(value, label, opts) {
      opts = opts || {};
      if (value == null || !Number.isFinite(Number(value))) {
        return el("td", { className: "sr-qo-num", "data-label": label }, ["—"]);
      }
      var cls = "sr-qo-num" + (opts.deal ? " is-deal" : "") + (opts.muted ? " is-muted" : "");
      return el("td", { className: cls, "data-label": label }, [
        formatHufClient(value),
      ]);
    }

    function listPriceCell(line) {
      if (line.found === false) {
        return netCell(null, "Alap ár / db");
      }
      if (line.found !== true && lineUnitNet(line) == null) {
        return el("td", { className: "sr-qo-num", "data-label": "Alap ár / db" }, [
          "…",
        ]);
      }
      return netCell(lineListNet(line), "Alap ár / db", { muted: true });
    }

    function dealPriceCell(line) {
      if (line.found === false) {
        return netCell(null, "Kedv. ár / db");
      }
      var unit = lineUnitNet(line);
      if (unit == null) {
        return el(
          "td",
          { className: "sr-qo-num", "data-label": "Kedv. ár / db" },
          ["…"],
        );
      }
      var list = lineListNet(line);
      var cheaper =
        list != null && Number.isFinite(list) && unit < list - 0.5;
      return netCell(unit, "Kedv. ár / db", { deal: cheaper });
    }

    var qtyPriceTimers = {};
    function refreshLinePricing(idx, opts) {
      opts = opts || {};
      if (qtyPriceTimers[idx]) {
        clearTimeout(qtyPriceTimers[idx]);
        delete qtyPriceTimers[idx];
      }
      var line = lines[idx];
      if (!line || !line.sku || line.found === false) {
        renderList();
        return;
      }
      resolveCodes([{ sku: line.sku, quantity: line.quantity }])
        .then(function (products) {
          var p = products && products[0];
          if (!p || !p.found) return;
          var prev = lines[idx];
          if (!prev || prev.sku !== line.sku) return;
          var mapped = mapProductFields(p, prev.quantity);
          mapped.prevPriceNet = prev.prevPriceNet;
          lines[idx] = mapped;
          if (opts.flash) lines[idx]._flashTier = true;
          renderList();
        })
        .catch(function (e) {
          if (lineUnitNet(lines[idx] || line) == null) {
            flashError(
              (e && e.message) || "Ár / készlet frissítés sikertelen.",
            );
          }
        });
    }
    function scheduleLinePricing(idx) {
      if (qtyPriceTimers[idx]) clearTimeout(qtyPriceTimers[idx]);
      qtyPriceTimers[idx] = setTimeout(function () {
        delete qtyPriceTimers[idx];
        refreshLinePricing(idx);
      }, 320);
    }

    function trashIconSvg() {
      var ns = "http://www.w3.org/2000/svg";
      var svg = document.createElementNS(ns, "svg");
      svg.setAttribute("width", "15");
      svg.setAttribute("height", "15");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "2");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");
      svg.setAttribute("aria-hidden", "true");
      [
        ["polyline", { points: "3 6 5 6 21 6" }],
        [
          "path",
          {
            d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
          },
        ],
        ["line", { x1: "10", x2: "10", y1: "11", y2: "17" }],
        ["line", { x1: "14", x2: "14", y1: "11", y2: "17" }],
      ].forEach(function (pair) {
        var node = document.createElementNS(ns, pair[0]);
        Object.keys(pair[1]).forEach(function (k) {
          node.setAttribute(k, pair[1][k]);
        });
        svg.appendChild(node);
      });
      return svg;
    }

    function stockChipInfo(line) {
      if (line.found === false) {
        return { cls: "is-pending", label: "—", title: "" };
      }
      if (
        typeof line.stockQty === "undefined" &&
        !line.stockLabel &&
        !line.stockTone &&
        typeof line.inStock === "undefined"
      ) {
        return { cls: "is-pending", label: "…", title: "" };
      }
      var tone = line.stockTone || (line.inStock ? "ok" : "out");
      if (line.orderable === false || tone === "blocked") {
        return {
          cls: "is-blocked",
          label: "Nem rendelhető",
          title: "A termék jelenleg nem rendelhető",
        };
      }
      var qty = Math.max(0, parseInt(line.quantity, 10) || 0);
      var stock =
        typeof line.stockQty === "number" ? line.stockQty : null;
      var over =
        stock != null && stock >= 0 && qty > stock;
      var empty =
        tone === "out" ||
        line.inStock === false ||
        (stock != null && stock <= 0);
      if (empty || over) {
        var title = "";
        if (stock != null && stock >= 0) {
          title =
            stock <= 0
              ? "Nincs készleten"
              : "Készleten: " + stock + " db · kért: " + qty + " db";
        }
        return {
          cls: "is-out",
          label: "Nincs készleten",
          title: title,
        };
      }
      return {
        cls: "is-ok",
        label: "Készleten",
        title: stock != null && stock >= 0 ? "Készleten: " + stock + " db" : "",
      };
    }

    function paintStockChip(chip, line) {
      if (!chip) return;
      var info = stockChipInfo(line);
      chip.className = "sr-qo-stock-chip " + info.cls;
      chip.textContent = info.label;
      if (info.title) chip.setAttribute("title", info.title);
      else chip.removeAttribute("title");
    }

    function stockCell(line) {
      var info = stockChipInfo(line);
      var chip = el(
        "span",
        {
          className: "sr-qo-stock-chip " + info.cls,
          title: info.title || undefined,
        },
        [info.label],
      );
      return el(
        "td",
        { className: "sr-qo-stock", "data-label": "Készlet" },
        [chip],
      );
    }

    var listFilter = "all";

    function lineMatchesFilter(line) {
      if (listFilter === "all") return true;
      if (listFilter === "ok") return lineInStockOk(line);
      if (listFilter === "issue") return lineNeedsAttention(line);
      return true;
    }

    function updateListFilterUi() {
      if (!listFilterBar) return;
      var issueN = 0;
      lines.forEach(function (l) {
        if (lineNeedsAttention(l)) issueN++;
      });
      var show = lines.length > 0 && issueN > 0;
      listFilterBar.className =
        "sr-qo-list-filters" + (show ? " is-on" : "");
      if (!show) {
        if (listFilter !== "all") {
          listFilter = "all";
        }
        return;
      }
      ["all", "ok", "issue"].forEach(function (k) {
        if (listFilterBtns[k]) {
          listFilterBtns[k].classList.toggle("is-on", listFilter === k);
        }
      });
      var okN = 0;
      lines.forEach(function (l) {
        if (lineInStockOk(l)) okN++;
      });
      if (listFilterBtns.all)
        listFilterBtns.all.textContent = "Mind (" + lines.length + ")";
      if (listFilterBtns.ok)
        listFilterBtns.ok.textContent = "Készleten (" + okN + ")";
      if (listFilterBtns.issue)
        listFilterBtns.issue.textContent = "Problémás (" + issueN + ")";
    }

    function updateEmptyState() {
      if (!emptyEl) return;
      emptyEl.innerHTML = "";
      if (lines.length) {
        emptyEl.style.display = "none";
        return;
      }
      emptyEl.style.display = "block";
      emptyEl.appendChild(
        el("p", { className: "sr-qo-empty-title" }, [
          "Kezdd a rendelést",
        ]),
      );
      emptyEl.appendChild(
        el("p", { className: "sr-qo-empty-sub" }, [
          "Cikkszám a keresőbe, Enter — vagy töltsd fel gyorsan.",
        ]),
      );
      var actions = el("div", { className: "sr-qo-empty-actions" });
      var last =
        insightsData &&
        insightsData.lastOrder &&
        insightsData.lastOrder.lines &&
        insightsData.lastOrder.lines.length
          ? insightsData.lastOrder
          : null;
      if (last && moduleOn("orders")) {
        var n = last.lines.length;
        actions.appendChild(
          el(
            "button",
            {
              type: "button",
              className: "sr-qo-btn sr-qo-btn-primary",
              onClick: function () {
                importReorderLines(last.lines, { replace: false });
              },
            },
            [
              n === 1
                ? "Utolsó rendelés (1 tétel)"
                : "Utolsó rendelés (" + n + " tétel)",
            ],
          ),
        );
      }
      if (moduleOn("excel")) {
        actions.appendChild(
          el(
            "button",
            {
              type: "button",
              className: "sr-qo-btn sr-qo-btn-ghost",
              onClick: function () {
                openExcelIngest();
              },
            },
            ["Excel lista"],
          ),
        );
      }
      if (actions.childNodes.length) emptyEl.appendChild(actions);
    }

    function renderList() {
      tbody.innerHTML = "";
      updateEmptyState();
      var visible = [];
      lines.forEach(function (line, idx) {
        if (lineMatchesFilter(line)) visible.push({ line: line, idx: idx });
      });
      var showTable = lines.length > 0 && visible.length > 0;
      table.style.display = showTable ? "table" : "none";
      if (filterEmptyEl) {
        filterEmptyEl.className =
          "sr-qo-filter-empty" +
          (lines.length && !visible.length ? " is-on" : "");
      }
      persist();
      updateSummary();
      updateListFilterUi();

      visible.forEach(function (item) {
        var line = item.line;
        var idx = item.idx;
        var over = lineOverStock(line);

        var trClass = "";
        if (line.found === false) trClass = "sr-qo-row-err";
        else if (line.found === true && !lineIsCartable(line))
          trClass = "sr-qo-row-oos";
        else if (lineIsOutOfStock(line) || over || linePriceUp(line))
          trClass = "sr-qo-row-warn";
        else if (line.found === true) trClass = "sr-qo-row-ok";

        var qtyField = el("input", {
          className: "sr-qo-qty-input" + (over ? " sr-qo-qty-over" : ""),
          type: "number",
          min: String(Math.max(1, line.minQty || 1)),
          step: String(Math.max(1, line.qtyStep || 1)),
          value: String(line.quantity),
          "aria-label": "Darab " + line.sku,
          title: line.packLabel || "",
        });
        if (line.maxQty != null && line.maxQty > 0) {
          qtyField.max = String(line.maxQty);
        }
        var unitNet = lineUnitNet(line);
        var lineTotalEl = el("div", { className: "sr-qo-line-total" }, [
          line.found === true && unitNet != null
            ? formatHufClient(unitNet * (line.quantity || 1))
            : "—",
        ]);
        function refreshLineTotalLive(q) {
          var u = lineUnitNet(lines[idx] || line);
          if ((lines[idx] || line).found === true && u != null) {
            lineTotalEl.textContent = formatHufClient(u * q);
          } else {
            lineTotalEl.textContent = "—";
          }
        }
        function refreshStockLive() {
          var cur = lines[idx] || line;
          var overNow = lineOverStock(cur);
          qtyField.classList.toggle("sr-qo-qty-over", overNow);
          paintStockChip(stockChipEl, cur);
          if (tr) {
            var nextClass = "";
            if (cur.found === false) nextClass = "sr-qo-row-err";
            else if (cur.found === true && !lineIsCartable(cur))
              nextClass = "sr-qo-row-oos";
            else if (lineIsOutOfStock(cur) || overNow || linePriceUp(cur))
              nextClass = "sr-qo-row-warn";
            else if (cur.found === true) nextClass = "sr-qo-row-ok";
            tr.className = nextClass;
          }
        }
        qtyField.addEventListener("input", function () {
          var raw = Math.max(1, parseInt(qtyField.value, 10) || 1);
          lines[idx].quantity = raw;
          refreshLineTotalLive(raw);
          refreshStockLive();
          updateSummary();
          updateListFilterUi();
          scheduleLinePricing(idx);
        });
        qtyField.addEventListener("change", function () {
          var next = normalizePackQuantity(
            qtyField.value,
            packRulesFromLine(lines[idx]),
          );
          lines[idx].quantity = next;
          qtyField.value = String(next);
          persist();
          refreshStockLive();
          refreshLinePricing(idx);
        });

        var nameText =
          line.found === false ? "Nem található" : line.name || "—";
        var href = line.found === false ? "" : productPageUrl(line);
        var nameInner = href
          ? el(
              "a",
              {
                className: "sr-qo-name-link",
                href: href,
                target: "_blank",
                rel: "noopener noreferrer",
                title: nameText,
                onClick: function (ev) {
                  ev.stopPropagation();
                },
              },
              [nameText],
            )
          : nameText;
        var metaParts = [line.sku];
        if (line.modelNumber) metaParts.push(line.modelNumber);
        var productKids = [
          el("div", { className: "sr-qo-product-name" }, [nameInner]),
          el("div", { className: "sr-qo-product-meta" }, [
            metaParts.join(" · "),
          ]),
        ];
        var nameClass =
          "sr-qo-product" +
          (line.imageUrl ? " sr-qo-name has-img" : " sr-qo-name");
        var nameCell = el(
          "td",
          {
            className: nameClass,
            title: line.name || "",
            "data-label": "Termék",
          },
          productKids,
        );
        if (line.imageUrl) {
          nameCell.addEventListener("mouseenter", function (ev) {
            showTip(line.imageUrl, ev);
          });
          nameCell.addEventListener("mousemove", function (ev) {
            showTip(line.imageUrl, ev);
          });
          nameCell.addEventListener("mouseleave", hideTip);
        }

        var qtyKids = [qtyField];
        var tierHint = lineNextTierHint(line);
        if (tierHint) {
          qtyKids.push(
            el(
              "button",
              {
                type: "button",
                className:
                  "sr-qo-tier-nudge" + (tierHint.near ? " is-near" : ""),
                title: "Beállítás: " + tierHint.minQty + " db",
                onClick: function (ev) {
                  ev.preventDefault();
                  ev.stopPropagation();
                  var next = normalizePackQuantity(
                    tierHint.minQty,
                    packRulesFromLine(lines[idx]),
                  );
                  lines[idx].quantity = next;
                  qtyField.value = String(next);
                  persist();
                  refreshStockLive();
                  refreshLinePricing(idx, { flash: true });
                },
              },
              [tierHintLabel(tierHint)],
            ),
          );
        }

        var stockTd = stockCell(line);
        var stockChipEl = stockTd.querySelector(".sr-qo-stock-chip");
        var tr = el("tr", { className: trClass }, [
          nameCell,
          stockTd,
          el("td", { className: "sr-qo-qty-td", "data-label": "Db" }, [
            el("div", { className: "sr-qo-qty-wrap" }, qtyKids),
          ]),
          listPriceCell(line),
          dealPriceCell(line),
          el("td", { className: "sr-qo-line-total", "data-label": "Összesen" }, [
            lineTotalEl,
          ]),
          el("td", { className: "sr-qo-td-action" }, [
            el(
              "button",
              {
                type: "button",
                className: "sr-qo-del",
                title: "Sor törlése",
                "aria-label": "Törlés " + line.sku,
                onClick: function () {
                  lines.splice(idx, 1);
                  renderList();
                },
              },
              [trashIconSvg()],
            ),
          ]),
        ]);
        tbody.appendChild(tr);
      });
    }

    function findLineIndexByCode(code) {
      var key = String(code || "")
        .trim()
        .toUpperCase();
      if (!key) return -1;
      for (var i = 0; i < lines.length; i++) {
        var l = lines[i];
        var keys = [l.sku, l.modelNumber, l.gtin];
        for (var j = 0; j < keys.length; j++) {
          if (String(keys[j] || "").trim().toUpperCase() === key) return i;
        }
      }
      return -1;
    }

    /** Ugyanarra a termékre (sku/productId) összevonás resolve után */
    function consolidateDuplicateProducts() {
      var seen = {};
      var out = [];
      lines.forEach(function (l) {
        var key =
          l.productId != null
            ? "id:" + l.productId
            : "sku:" + String(l.sku || "").trim().toUpperCase();
        if (Object.prototype.hasOwnProperty.call(seen, key)) {
          var prev = out[seen[key]];
          prev.quantity = normalizePackQuantity(
            Math.max(1, (prev.quantity || 0) + (l.quantity || 0)),
            packRulesFromLine(prev),
          );
          if (!prev.modelNumber && l.modelNumber) prev.modelNumber = l.modelNumber;
          if (!prev.gtin && l.gtin) prev.gtin = l.gtin;
          if (!prev.name && l.name) prev.name = l.name;
          if (!prev.packLabel && l.packLabel) prev.packLabel = l.packLabel;
          if (prev.minQty == null && l.minQty != null) prev.minQty = l.minQty;
          if (prev.qtyStep == null && l.qtyStep != null) prev.qtyStep = l.qtyStep;
          if (prev.maxQty == null && l.maxQty != null) prev.maxQty = l.maxQty;
          if (prev.prevPriceNet == null && l.prevPriceNet != null) {
            prev.prevPriceNet = l.prevPriceNet;
          }
        } else {
          seen[key] = out.length;
          if (l.found === true) {
            l.quantity = normalizePackQuantity(l.quantity, packRulesFromLine(l));
          }
          out.push(l);
        }
      });
      lines = out;
    }

    /** Csak sikeres resolve után hívandó. */
    function upsertResolvedProduct(p, quantity) {
      var qty = Math.max(1, parseInt(quantity, 10) || 1);
      var idx = findLineIndexByCode(p.sku);
      if (idx < 0 && p.modelNumber) idx = findLineIndexByCode(p.modelNumber);
      if (idx < 0 && p.gtin) idx = findLineIndexByCode(p.gtin);
      if (idx >= 0) {
        var mergedQty = normalizePackQuantity(
          Math.max(1, (lines[idx].quantity || 0) + qty),
          packRulesFromLine(lines[idx]),
        );
        var mapped = mapProductFields(p, mergedQty);
        mapped.prevPriceNet = lines[idx].prevPriceNet;
        lines[idx] = mapped;
        return { index: idx, merged: true };
      }
      lines.push(mapProductFields(p, qty));
      return { index: lines.length - 1, merged: false };
    }

    /** Összevonás / qty változás után: egységár újraszámolása a végleges db-re. */
    async function softRefreshPricing() {
      var payload = [];
      var idxs = [];
      lines.forEach(function (l, i) {
        if (l.found === true && l.sku) {
          payload.push({ sku: l.sku, quantity: l.quantity });
          idxs.push(i);
        }
      });
      if (!payload.length) return;
      var products = await resolveCodes(payload);
      products.forEach(function (p, j) {
        var i = idxs[j];
        if (!p || !p.found || !lines[i]) return;
        var prev = lines[i];
        var mapped = mapProductFields(p, prev.quantity);
        mapped.prevPriceNet = prev.prevPriceNet;
        lines[i] = mapped;
      });
    }

    /** Korábbi rendelés tételei → Új megrendelés tábla (mai ár/készlet resolve) */
    async function importReorderLines(orderLines, opts) {
      opts = opts || {};
      var pairs = (orderLines || [])
        .map(function (l) {
          var baseQty = Math.max(1, parseInt(l.quantity, 10) || 1);
          var qty = opts.useSuggested ? suggestedQtyForLine(l) : baseQty;
          if (opts.qtyMode === "boost") {
            var hit = insightForSku(l.sku) || insightForSku(l.modelNumber);
            qty = hit ? hit.boostQty : Math.max(baseQty + 1, Math.round(baseQty * 1.25));
          }
          return {
            sku: (l.sku || l.modelNumber || "").trim(),
            quantity: qty,
            prevPriceNet:
              typeof l.priceNet === "number"
                ? l.priceNet
                : typeof l.price === "number"
                  ? l.price
                  : null,
          };
        })
        .filter(function (c) {
          return c.sku;
        });
      if (!pairs.length) {
        flashError("Nincs újrarendelhető tétel.");
        return;
      }
      if (opts.replace) {
        lines = [];
      }
      setView("order");
      showOrderWork();
      setBusy(true);
      setStatus("Újrarendelés betöltése…");
      try {
        var products = await resolveCodes(pairs);
        var diff = computeReorderDiff(pairs, products);
        lastReorderDiff = diff;
        var added = 0;
        var merged = 0;
        products.forEach(function (p, j) {
          if (!p || !p.found) return;
          var r = upsertResolvedProduct(p, pairs[j].quantity);
          var idx = r.index;
          if (lines[idx] && pairs[j].prevPriceNet != null) {
            lines[idx].prevPriceNet = pairs[j].prevPriceNet;
          }
          if (r.merged) merged++;
          else added++;
        });
        consolidateDuplicateProducts();
        await softRefreshPricing();
        // prevPriceNet megőrzése consolidate után ugyanarra a sku-ra
        renderList();
        persist();
        var diffTxt = diffSummaryText(diff);
        if (diff.missing && !added && !merged) {
          flashError("Egyik tétel sem található már a katalógusban.");
        } else if (diffTxt) {
          flashInfo(
            "Újrarendelés: " +
              added +
              " új, " +
              merged +
              " db növelve. " +
              diffTxt,
            diff.priceUp || diff.missing || diff.stockOut ? "warn" : "info",
          );
        } else {
          setStatus(
            "Újrarendelés betöltve: " +
              added +
              " új, " +
              merged +
              " db növelve. Nincs ár/készlet változás.",
          );
        }
      } catch (e) {
        flashError(e.message || "Újrarendelés sikertelen");
      } finally {
        setBusy(false);
        try {
          skuInput.focus();
        } catch (e2) {}
      }
    }

    async function resolveCodes(codes) {
      var payload = codes.map(function (c) {
        return {
          sku: c.sku || c,
          quantity: c.quantity != null ? c.quantity : 1,
        };
      });
      var res = await fetch(apiUrl("/api/products/resolve"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: payload,
          customerGroupId: (function () {
            try {
              return ShopRenter.customer && ShopRenter.customer.userGroupId
                ? Number(ShopRenter.customer.userGroupId)
                : null;
            } catch (e) {
              return null;
            }
          })(),
        }),
      });
      var data = null;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error(
          res.ok
            ? "Érvénytelen válasz az ár/készlet lekérésnél"
            : "Hiba a termékkeresésnél (" + res.status + ")",
        );
      }
      if (!res.ok) throw new Error((data && data.error) || "Hiba a termékkeresésnél");
      return (data && data.products) || [];
    }

    async function resolveIndices(indices) {
      if (!indices.length) return;
      setStatus("Betöltés…");
      var payload = indices.map(function (i) {
        return { sku: lines[i].sku, quantity: lines[i].quantity };
      });
      var products = await resolveCodes(payload);
      // visszafelé töröljük a nem találtakat (indexek ne csússzanak)
      var drop = [];
      products.forEach(function (p, j) {
        var i = indices[j];
        if (i == null || !lines[i]) return;
        if (p && p.found) {
          lines[i] = mapProductFields(p, lines[i].quantity);
        } else {
          drop.push(i);
        }
      });
      drop.sort(function (a, b) { return b - a; });
      drop.forEach(function (i) { lines.splice(i, 1); });
      consolidateDuplicateProducts();
      renderList();
    }

    async function addSkuFromInputs() {
      var sku = skuInput.value.trim();
      var quantity = Math.max(1, parseInt(qtyInput.value, 10) || 1);
      var qtyManual = qtyInput.getAttribute("data-touched") === "1";
      if (!qtyManual && quantity === 1) {
        var tip = insightForSku(sku);
        if (tip && tip.suggestedQty > 1) {
          quantity = Math.max(1, parseInt(tip.suggestedQty, 10) || 1);
        }
      }
      if (!sku) {
        flashError("Írd be a cikkszámot, gyári számot vagy vonalkódot.");
        skuInput.focus();
        return;
      }
      hideSuggest();

      var existing = findLineIndexByCode(sku);
      if (existing >= 0 && lines[existing].found === true) {
        lines[existing].quantity = normalizePackQuantity(
          (lines[existing].quantity || 0) + quantity,
          packRulesFromLine(lines[existing]),
        );
        skuInput.value = "";
        qtyInput.value = "1";
        qtyInput.removeAttribute("data-touched");
        persist();
        setStatus(
          "Darabszám növelve (" + lines[existing].quantity + " db).",
          false,
        );
        skuInput.focus();
        refreshLinePricing(existing);
        return;
      }

      setBusy(true);
      setStatus("Keresés…");
      try {
        var products = await resolveCodes([{ sku: sku, quantity: quantity }]);
        var p = products[0];
        if (!p || !p.found) {
          flashError("Nem található: " + sku);
          skuInput.select();
          return;
        }
        var result = upsertResolvedProduct(p, quantity);
        var snapped = lines[result.index].quantity !== quantity;
        skuInput.value = "";
        qtyInput.value = "1";
        qtyInput.removeAttribute("data-touched");
        renderList();
        if (snapped && lines[result.index].packLabel) {
          flashInfo(
            "Csomagolás: " +
              lines[result.index].quantity +
              " db (" +
              lines[result.index].packLabel +
              ")",
            "info",
          );
        } else {
          setStatus(
            result.merged
              ? "Darabszám növelve (" +
                  lines[result.index].quantity +
                  " db) — lista mentve."
              : "Hozzáadva — lista mentve.",
            false,
          );
        }
      } catch (e) {
        flashError(e.message || "Hiba a keresésnél");
      } finally {
        setBusy(false);
        skuInput.focus();
      }
    }

    async function addAllToCart(opts) {
      opts = opts || {};
      if (busy) return;
      if (!lines.length) {
        setStatus("Adj legalább egy cikket a listához.", true);
        try {
          skuInput.focus();
        } catch (e) {}
        return;
      }
      setBusy(true);
      try {
        var need = [];
        lines.forEach(function (l, i) {
          if (typeof l.found === "undefined" || (l.found && !l.productId))
            need.push(i);
        });
        if (need.length) await resolveIndices(need);

        var s = safetyReport();
        var ok;
        if (opts.onlySafe) {
          ok = lines.filter(lineIsCartable);
        } else {
          ok = lines.filter(function (l) {
            return l.found && l.productId && lineIsCartable(l);
          });
          if (s.hasBlockers && s.cartable > 0) {
            showCartSplitConfirm(s);
            return;
          } else if (s.hasBlockers && s.cartable === 0) {
            ok = [];
          }
        }
        if (!ok.length) {
          setStatus(
            "Nincs kosárba tehető termék. A hiányzó vagy nem rendelhető sorokat javítsd a listán.",
            true,
          );
          return;
        }
        for (var i = 0; i < ok.length; i++) {
          setStatus("Kosárba… " + (i + 1) + " / " + ok.length);
          await addToCart(ok[i].productId, ok[i].quantity);
        }
        recordWidgetOrder(ok);
        var okKeys = {};
        ok.forEach(function (l) {
          okKeys[(l.productId != null ? "id:" + l.productId : "sku:" + l.sku)] = true;
        });
        var cartGross = 0;
        ok.forEach(function (l) {
          if (l.priceGross != null) cartGross += l.priceGross * (l.quantity || 1);
        });
        var cartLabel =
          ok.length +
          " tétel" +
          (cartGross > 0 ? " · " + formatHufClient(cartGross) : "");
        if (ok.length < lines.length) {
          lines = lines.filter(function (l) {
            var k = l.productId != null ? "id:" + l.productId : "sku:" + l.sku;
            return !okKeys[k];
          });
          saveDraft(lines);
          renderList();
          setStatus(
            cartLabel + " a kosárban. A problematikus sorok a listán maradtak.",
          );
          flashInfo(cartLabel + " kosárba. A többi a listán maradt.", "warn");
          return;
        }
        lines = [];
        saveDraft([]);
        setStatus(cartLabel + " — a Shoprenter kosár nyílik…");
        document.body.style.overflow = prevOverflow;
        location.href = "/cart";
      } catch (e) {
        setStatus(e.message || "Hiba a kosárba rakáskor.", true);
      } finally {
        setBusy(false);
      }
    }

    var summaryEl = el("div", { className: "sr-qo-header-meta" });
    var closeBtn = el(
      "button",
      {
        type: "button",
        className: "sr-qo-close",
        "aria-label": "Kilépés — a lista mentve marad",
        title: "Kilépés — a lista megmarad",
        onClick: function () {
          closePanel();
        },
      },
      ["Kilépés"],
    );

    var mark = el("div", { className: "sr-qo-app-mark", "aria-hidden": "true" });
    mark.appendChild(listIconSvg());
    var brand = el("div", { className: "sr-qo-brand" }, [
      mark,
      el("h2", { className: "sr-qo-title", id: "sr-qo-dialog-title" }, [
        cfg.buttonLabel || "Gyors rendelés",
      ]),
    ]);

    var NAV_ITEMS = [
      { id: "home", label: "Kezdőlap", module: "insights" },
      { id: "order", label: "Új megrendelés", module: null },
      { id: "orders", label: "Rendeléseim", module: "orders" },
    ].filter(function (item) {
      return !item.module || moduleOn(item.module);
    });
    var activeView = "order";
    var navButtons = {};
    var viewEls = {};

    function setView(id) {
      if (!viewEls[id]) return;
      activeView = id;
      NAV_ITEMS.forEach(function (item) {
        var btn = navButtons[item.id];
        var pane = viewEls[item.id];
        var on = item.id === id;
        if (btn) {
          btn.classList.toggle("is-active", on);
          btn.setAttribute("aria-selected", on ? "true" : "false");
          btn.tabIndex = on ? 0 : -1;
        }
        if (pane) pane.classList.toggle("is-active", on);
      });
      if (id === "home") {
        if (moduleOn("insights")) loadHomeInsights();
      }
      if (id === "order") {
        syncOrderPane();
        loadHomeInsights();
        updateOrderRemind();
      }
      if (id === "orders") {
        if (!moduleOn("orders")) return;
        showOrdersList();
        loadOrdersList();
        loadHomeInsights();
        setTimeout(function () {
          try {
            ordersSearchInput.focus();
          } catch (e) {}
        }, 20);
      }
    }

    var navChildren = NAV_ITEMS.map(function (item) {
      var btn = el(
        "button",
        {
          type: "button",
          className: "sr-qo-nav-btn" + (item.id === activeView ? " is-active" : ""),
          role: "tab",
          id: "sr-qo-tab-" + item.id,
          "aria-controls": "sr-qo-view-" + item.id,
          "aria-selected": item.id === activeView ? "true" : "false",
          tabIndex: item.id === activeView ? 0 : -1,
          onClick: function () {
            setView(item.id);
          },
        },
        [item.label],
      );
      navButtons[item.id] = btn;
      return btn;
    });

    var nav = el(
      "nav",
      {
        className: "sr-qo-nav",
        role: "tablist",
        "aria-label": "Főmenü",
      },
      navChildren,
    );

    var topbar = el("div", { className: "sr-qo-topbar" }, [
      brand,
      nav,
      el("div", { className: "sr-qo-topbar-right" }, [closeBtn]),
    ]);

    var skuInput = el("input", {
      className: "sr-qo-input sr-qo-sku-input",
      type: "text",
      placeholder: "Cikkszám / gyári / vonalkód",
      autocomplete: "off",
      "aria-label": "Cikkszám, gyári cikkszám vagy vonalkód",
      "aria-autocomplete": "list",
      "aria-controls": "sr-qo-sku-suggest",
      role: "combobox",
      "aria-expanded": "false",
    });
    var suggestBox = el("div", {
      className: "sr-qo-suggest",
      id: "sr-qo-sku-suggest",
      role: "listbox",
      "aria-label": "Termékjavaslatok",
    });
    var skuWrap = el("div", { className: "sr-qo-sku-wrap" }, [
      skuInput,
      suggestBox,
    ]);
    var qtyInput = el("input", {
      className: "sr-qo-input sr-qo-qty-toolbar",
      type: "number",
      value: "1",
      min: "1",
      "aria-label": "Darab",
    });
    qtyInput.addEventListener("input", function () {
      qtyInput.setAttribute("data-touched", "1");
    });

    var suggestItems = [];
    var suggestActive = -1;
    var suggestTimer = null;
    var suggestSeq = 0;

    function hideSuggest() {
      suggestBox.classList.remove("is-on");
      suggestBox.innerHTML = "";
      suggestItems = [];
      suggestActive = -1;
      skuInput.setAttribute("aria-expanded", "false");
    }

    function setSuggestActive(i) {
      suggestActive = i;
      var nodes = suggestBox.querySelectorAll(".sr-qo-suggest-item");
      for (var n = 0; n < nodes.length; n++) {
        nodes[n].classList.toggle("is-active", n === suggestActive);
      }
      if (suggestActive >= 0 && nodes[suggestActive]) {
        nodes[suggestActive].scrollIntoView({ block: "nearest" });
      }
    }

    function pickSuggest(hit) {
      if (!hit || !hit.sku) return;
      hideSuggest();
      var quantity = Math.max(1, parseInt(qtyInput.value, 10) || 1);
      if (hit.minQty && hit.minQty > 1) {
        quantity = normalizePackQuantity(quantity || hit.minQty, {
          minQty: hit.minQty,
          qtyStep: hit.qtyStep || 1,
          maxQty: null,
        });
      }

      if (hit.productId) {
        /* Search hits lack numeric price/stock — resolve first, then upsert. */
        var code = hit.sku;
        skuInput.value = "";
        qtyInput.value = "1";
        qtyInput.removeAttribute("data-touched");
        setBusy(true);
        setStatus("Ár és készlet…");
        resolveCodes([{ sku: code, quantity: quantity }])
          .then(function (products) {
            var p = products[0];
            if (!p || !p.found) {
              flashError(
                "Nem található: " +
                  (hit.sku || code) +
                  (hit.name ? " — " + hit.name : ""),
              );
              return;
            }
            var result = upsertResolvedProduct(p, quantity);
            consolidateDuplicateProducts();
            persist();
            renderList();
            setStatus(
              result.merged
                ? "Darabszám növelve (" +
                    lines[result.index].quantity +
                    " db)."
                : "Hozzáadva — lista mentve.",
              false,
            );
          })
          .catch(function (e) {
            flashError(
              (e && e.message) || "Nem sikerült lekérni az árat / készletet.",
            );
          })
          .finally(function () {
            setBusy(false);
            try {
              skuInput.focus();
            } catch (e2) {}
          });
        return;
      }

      skuInput.value = hit.sku;
      qtyInput.value = String(quantity);
      addSkuFromInputs();
    }

    function renderSuggest(list, q) {
      suggestBox.innerHTML = "";
      suggestItems = list || [];
      suggestActive = -1;
      if (!suggestItems.length) {
        if (q && q.length >= 2) {
          suggestBox.appendChild(
            el("div", { className: "sr-qo-suggest-empty" }, [
              "Nincs találat: " + q,
            ]),
          );
          suggestBox.classList.add("is-on");
          skuInput.setAttribute("aria-expanded", "true");
        } else {
          hideSuggest();
        }
        return;
      }
      suggestItems.forEach(function (hit, i) {
        var meta = [];
        if (hit.name) meta.push(hit.name);
        if (hit.packLabel) meta.push(hit.packLabel);
        if (hit.orderable === false) meta.push("nem rendelhető");
        else if (hit.inStock === false) meta.push("nincs készleten");
        var price = hit.priceGrossFormatted || hit.priceNetFormatted;
        var skuKids = [hit.sku];
        if (
          hit.modelNumber &&
          String(hit.modelNumber).trim() &&
          String(hit.modelNumber).trim().toUpperCase() !==
            String(hit.sku).trim().toUpperCase()
        ) {
          skuKids.push(
            el("span", { className: "sr-qo-suggest-model" }, [
              hit.modelNumber,
            ]),
          );
        }
        var kids = [];
        if (hit.imageUrl) {
          kids.push(
            el("span", { className: "sr-qo-suggest-thumb", "aria-hidden": "true" }, [
              el("img", { src: hit.imageUrl, alt: "" }),
            ]),
          );
        }
        kids.push(
          el("span", { className: "sr-qo-suggest-body" }, [
            el("span", { className: "sr-qo-suggest-sku" }, skuKids),
            el("span", { className: "sr-qo-suggest-meta" }, [
              meta.join(" · ") || "—",
            ]),
          ]),
        );
        if (price) {
          kids.push(el("span", { className: "sr-qo-suggest-price" }, [price]));
        }
        var btn = el(
          "button",
          {
            type: "button",
            className: "sr-qo-suggest-item",
            role: "option",
            id: "sr-qo-suggest-" + i,
            onClick: function (ev) {
              ev.preventDefault();
              pickSuggest(hit);
            },
          },
          kids,
        );
        suggestBox.appendChild(btn);
      });
      suggestBox.classList.add("is-on");
      skuInput.setAttribute("aria-expanded", "true");
    }

    async function runSkuSuggest(force) {
      var q = skuInput.value.trim();
      if (q.length < 2) {
        hideSuggest();
        return;
      }
      var seq = ++suggestSeq;
      try {
        var res = await fetch(
          apiUrl("/api/products/search?q=" + encodeURIComponent(q) + "&limit=8"),
        );
        var data = await res.json();
        if (seq !== suggestSeq) return;
        if (!res.ok) throw new Error(data.error || "Keresés sikertelen");
        if (data.catalogReady === false) {
          cfg.catalogReady = false;
          suggestBox.innerHTML = "";
          suggestBox.appendChild(
            el("div", { className: "sr-qo-suggest-empty" }, [
              "A termékek még másolódnak. Próbáld egy perc múlva.",
            ]),
          );
          suggestBox.classList.add("is-on");
          skuInput.setAttribute("aria-expanded", "true");
          return;
        }
        cfg.catalogReady = true;
        renderSuggest(data.products || [], q);
      } catch (e) {
        if (seq !== suggestSeq) return;
        suggestBox.innerHTML = "";
        suggestBox.appendChild(
          el("div", { className: "sr-qo-suggest-empty" }, [
            e.message || "Keresés sikertelen",
          ]),
        );
        suggestBox.classList.add("is-on");
      }
    }

    function scheduleSkuSuggest() {
      if (suggestTimer) clearTimeout(suggestTimer);
      suggestTimer = setTimeout(function () {
        runSkuSuggest(false);
      }, 220);
    }

    skuInput.addEventListener("input", function () {
      scheduleSkuSuggest();
    });
    skuInput.addEventListener("focus", function () {
      if (skuInput.value.trim().length >= 2) scheduleSkuSuggest();
    });
    skuInput.addEventListener("blur", function () {
      setTimeout(hideSuggest, 160);
    });
    skuInput.addEventListener("keydown", function (e) {
      var open = suggestBox.classList.contains("is-on") && suggestItems.length;
      if (e.key === "ArrowDown" && open) {
        e.preventDefault();
        setSuggestActive(
          suggestActive < suggestItems.length - 1 ? suggestActive + 1 : 0,
        );
        return;
      }
      if (e.key === "ArrowUp" && open) {
        e.preventDefault();
        setSuggestActive(
          suggestActive > 0 ? suggestActive - 1 : suggestItems.length - 1,
        );
        return;
      }
      if (e.key === "Escape" && suggestBox.classList.contains("is-on")) {
        e.preventDefault();
        hideSuggest();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (open && suggestActive >= 0 && suggestItems[suggestActive]) {
          pickSuggest(suggestItems[suggestActive]);
        } else if (open && suggestItems.length === 1) {
          pickSuggest(suggestItems[0]);
        } else {
          hideSuggest();
          addSkuFromInputs();
        }
      }
    });
    qtyInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        hideSuggest();
        addSkuFromInputs();
      }
    });

    var addBtn = el(
      "button",
      {
        type: "button",
        className: "sr-qo-btn sr-qo-btn-primary",
        onClick: addSkuFromInputs,
      },
      ["Hozzáad"],
    );

    function confirmLeaveWork() {
      return true;
    }

    function closeImportMenu() {
      if (importWrap) importWrap.classList.remove("is-open");
      if (importToggleBtn)
        importToggleBtn.setAttribute("aria-expanded", "false");
    }

    var importToggleBtn = el(
      "button",
      {
        type: "button",
        className: "sr-qo-btn sr-qo-btn-ghost",
        "aria-haspopup": "menu",
        "aria-expanded": "false",
        onClick: function (ev) {
          ev.stopPropagation();
          var open = !importWrap.classList.contains("is-open");
          if (open) importWrap.classList.add("is-open");
          else importWrap.classList.remove("is-open");
          importToggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
        },
      },
      ["Excel / lista / fotó"],
    );
    var importMenu = el("div", {
      className: "sr-qo-import-menu",
      role: "menu",
    });
    function addImportItem(label, sub, fn) {
      importMenu.appendChild(
        el(
          "button",
          {
            type: "button",
            className: "sr-qo-import-item",
            role: "menuitem",
            onClick: function (ev) {
              ev.stopPropagation();
              closeImportMenu();
              if (!confirmLeaveWork(label + " megnyitása")) return;
              fn();
            },
          },
          [label, el("small", null, [sub])],
        ),
      );
    }
    if (moduleOn("excel")) {
      addImportItem("Excel", "Sablon + .xlsx feltöltés", function () {
        openExcelIngest();
      });
    }
    if (moduleOn("email")) {
      addImportItem("Szöveg / SKU lista", "Többsoros beillesztés", function () {
        openEmailIngest();
      });
    }
    if (moduleOn("image")) {
      addImportItem("Kép / kézírás", "Fotó a listáról", function () {
        openImageIngest();
      });
    }
    importMenu.appendChild(
      el(
        "button",
        {
          type: "button",
          className: "sr-qo-import-item",
          role: "menuitem",
          onClick: function (ev) {
            ev.stopPropagation();
            closeImportMenu();
            if (!confirmLeaveWork("Vissza az indítóhoz")) return;
            showOrderStart();
          },
        },
        [
          "Új forrás",
          el("small", null, ["Excel, lista vagy fotó — a kereső a főút"]),
        ],
      ),
    );
    var importWrap = el("div", { className: "sr-qo-import" }, [
      importToggleBtn,
      importMenu,
    ]);
    if (!moduleOn("excel") && !moduleOn("email") && !moduleOn("image")) {
      importWrap.style.display = "none";
    }
    document.addEventListener("click", function (ev) {
      if (importWrap && importWrap.contains(ev.target)) return;
      closeImportMenu();
      if (detailQtyMenuWrap && !detailQtyMenuWrap.contains(ev.target)) {
        detailQtyMenuWrap.classList.remove("is-open");
      }
      if (homeQtyMenuWrap && !homeQtyMenuWrap.contains(ev.target)) {
        homeQtyMenuWrap.classList.remove("is-open");
      }
    });

    if (!moduleOn("search")) {
      skuWrap.style.display = "none";
      qtyInput.style.display = "none";
      addBtn.style.display = "none";
    }
    var toolbar = el("div", { className: "sr-qo-toolbar" }, [
      skuWrap,
      qtyInput,
      addBtn,
      importWrap,
      el("div", { className: "sr-qo-toolbar-spacer", "aria-hidden": "true" }),
      summaryEl,
    ]);

    var csvArea = el("textarea", {
      className: "sr-qo-textarea",
      placeholder: "SS11,2\nSS12,5",
      "aria-label": "CSV lista",
    });
    // legacy wrap kept but unused visually — excel ingest replaces it
    var importBtn = el("button", { type: "button", className: "sr-qo-btn sr-qo-btn-ghost" }, [
      "Beolvasás",
    ]);
    var csvWrap = el("div", { className: "sr-qo-csv-wrap", style: { display: "none" } }, [
      csvArea,
      importBtn,
    ]);

    emptyEl = el("div", { className: "sr-qo-empty" }, []);
    var tbody = el("tbody", null, []);
    var table = el("table", { className: "sr-qo-table" }, [
      el("colgroup", null, [
        el("col", { className: "sr-qo-col-product" }),
        el("col", { className: "sr-qo-col-stock" }),
        el("col", { className: "sr-qo-col-qty" }),
        el("col", { className: "sr-qo-col-price" }),
        el("col", { className: "sr-qo-col-price" }),
        el("col", { className: "sr-qo-col-total" }),
        el("col", { className: "sr-qo-col-action" }),
      ]),
      el("thead", null, [
        el("tr", null, [
          el("th", null, ["Termék"]),
          el(
            "th",
            { className: "sr-qo-th-stock", title: "Készletállapot" },
            ["Készlet"],
          ),
          el("th", { className: "sr-qo-th-qty", title: "Darabszám" }, ["Db"]),
          el(
            "th",
            {
              className: "sr-qo-th-num",
              title: "Bolti listaár, nettó / db",
            },
            ["Alap"],
          ),
          el(
            "th",
            {
              className: "sr-qo-th-num",
              title: "Partnerár, nettó / db",
            },
            ["Kedv."],
          ),
          el(
            "th",
            {
              className: "sr-qo-th-num",
              title: "Sorösszeg nettó",
            },
            ["Össz."],
          ),
          el("th", { className: "sr-qo-th-action" }, [""]),
        ]),
      ]),
      tbody,
    ]);
    table.style.display = "none";

    var orderRemind = el("div", { className: "sr-qo-remind", "aria-live": "polite" });
    var listFilterBtns = {};
    function makeFilterChip(key, label) {
      var btn = el(
        "button",
        {
          type: "button",
          className: "sr-qo-filter-chip" + (key === "all" ? " is-on" : ""),
          onClick: function () {
            listFilter = key;
            renderList();
          },
        },
        [label],
      );
      listFilterBtns[key] = btn;
      return btn;
    }
    var listFilterBar = el("div", { className: "sr-qo-list-filters" }, [
      makeFilterChip("all", "Mind"),
      makeFilterChip("ok", "Készleten"),
      makeFilterChip("issue", "Problémás"),
    ]);
    var filterEmptyEl = el("div", { className: "sr-qo-filter-empty" }, [
      "Nincs sor ebben a szűrésben. Válts „Mind”-re.",
    ]);
    var body = el("div", { className: "sr-qo-body" }, [
      orderRemind,
      listFilterBar,
      emptyEl,
      filterEmptyEl,
      table,
    ]);
    var asideStats = el("div", { className: "sr-qo-aside-stats" });
    var incentiveBox = null;
    asideCartBtn = el(
      "button",
      {
        type: "button",
        className: "sr-qo-btn sr-qo-btn-success",
        onClick: function () {
          addAllToCart({});
        },
      },
      ["Kosárba rakom"],
    );
    var aside = el(
      "aside",
      { className: "sr-qo-aside", "aria-label": "Rendelés összesítő" },
      [asideStats],
    );
    var main = el("div", { className: "sr-qo-main" }, [body, aside]);

    var statusEl = el("div", { className: "sr-qo-footer-msg" }, [
      lines.length
        ? "Lista mentve — folytathatod."
        : "Cikkszám + Enter. Ha kész: Kosárba.",
    ]);

    var footChip = el("span", { className: "sr-qo-foot-chip is-current" });
    var footGap = el("span", { className: "sr-qo-foot-gap" });
    var footTargetArrow = el("span", { className: "sr-qo-foot-target-arrow" }, [
      "→",
    ]);
    var footTargetChip = el("span", {
      className: "sr-qo-foot-chip is-next",
    });
    var footTarget = el("span", { className: "sr-qo-foot-target" }, [
      footTargetArrow,
      footTargetChip,
    ]);
    var footDeal = el("span", { className: "sr-qo-foot-deal" });
    var footReward = el("div", { className: "sr-qo-foot-reward" }, [footDeal]);
    var footDetail = el("p", { className: "sr-qo-foot-detail" });
    var footBarFill = el("i", {});
    var footBar = el("div", { className: "sr-qo-foot-bar" }, [footBarFill]);
    partnerProgressEl = el(
      "div",
      {
        className: "sr-qo-foot-progress",
        hidden: "hidden",
        "aria-live": "polite",
      },
      [
        el("div", { className: "sr-qo-foot-top" }, [footChip]),
        footGap,
        el("div", { className: "sr-qo-foot-bar-row" }, [
          footBar,
          footTarget,
        ]),
        footReward,
        footDetail,
      ],
    );

    function formatDealLabel(headline) {
      var h = String(headline || "").trim();
      if (!h) return "";
      if (/kedvezm/i.test(h)) return h;
      if (/^−?-?\d/.test(h) || /%/.test(h)) {
        return h.replace(/\s*nettó\s*$/i, "").trim() + " kedvezmény";
      }
      return h;
    }

    function applyPartnerProgress(p) {
      if (!p) return;
      var showName = p.showGroupName && p.groupName;
      /* Only real, applicable rule progress — not empty “next level” placeholders. */
      var showProg =
        p.showProgress === true &&
        (p.remainingLabel != null ||
          (p.remaining != null && p.nextThreshold != null) ||
          (p.atTop === true && p.progressPercent === 100 && p.label));
      if (!showName && !showProg) return;

      partnerProgressOn = showProg;
      partnerProgressEl.hidden = false;
      if (showProg) statusEl.hidden = true;

      footChip.textContent = "";
      footChip.hidden = true;
      footChip.className = "sr-qo-foot-chip is-current";
      if (showName) {
        footChip.textContent = p.groupName;
        footChip.hidden = false;
      }

      var pct =
        p.progressPercent != null
          ? Math.min(100, Math.max(0, Number(p.progressPercent) || 0))
          : null;

      footGap.textContent = "";
      footTargetChip.textContent = "";
      footTarget.hidden = true;
      footDeal.textContent = "";
      footReward.hidden = true;
      footDetail.textContent = "";
      footDetail.hidden = true;
      footBar.hidden = true;
      footBarFill.style.width = "0%";
      partnerProgressEl.removeAttribute("data-urgency");
      partnerProgressEl.removeAttribute("title");

      if (!showProg) {
        if (!showName) partnerProgressEl.hidden = true;
        return;
      }

      if (p.atTop) {
        footGap.textContent = "Legjobb szinted";
      } else if (
        p.remaining != null &&
        p.remaining <= 0 &&
        p.nextGroupName
      ) {
        footGap.textContent = "Küszöb megvan";
        footTargetChip.textContent = String(p.nextGroupName);
        footTarget.hidden = false;
      } else if (p.remainingLabel) {
        footGap.appendChild(document.createTextNode("Még "));
        footGap.appendChild(el("em", null, [String(p.remainingLabel)]));
        if (p.nextGroupName) {
          footTargetChip.textContent =
            String(p.nextGroupName) +
            (p.urgency === "high" ? " · Majdnem" : "");
          footTarget.hidden = false;
        }
      } else if (p.label) {
        footGap.textContent = p.label;
      }

      if (p.urgency) {
        partnerProgressEl.setAttribute("data-urgency", p.urgency);
      }

      var headline =
        (p.rewardHeadline && String(p.rewardHeadline).trim()) ||
        (p.nextBenefitLabel && String(p.nextBenefitLabel).trim()) ||
        "";
      var detail =
        (p.rewardDetail && String(p.rewardDetail).trim()) || "";
      var dealTxt = formatDealLabel(headline);

      if (p.atTop && (p.currentBenefitLabel || headline)) {
        footDeal.textContent = "";
        footDeal.appendChild(
          el("em", null, [
            formatDealLabel(p.currentBenefitLabel || headline),
          ]),
        );
        footReward.hidden = false;
      } else if (dealTxt) {
        footDeal.textContent = "";
        footDeal.appendChild(el("em", null, [dealTxt]));
        footReward.hidden = false;
        if (detail) {
          footDetail.textContent = detail;
          footDetail.hidden = false;
        }
      }

      if (p.currentFormatted) {
        partnerProgressEl.setAttribute("title", String(p.currentFormatted));
      }

      if (p.atTop || (p.remaining != null && p.remaining <= 0)) {
        footBar.hidden = false;
        footBarFill.style.width = "100%";
      } else if (pct != null) {
        footBar.hidden = false;
        footBarFill.style.width = pct + "%";
      }
    }

    function loadPartnerStatus() {
      if (!cfg.showCustomerGroupName && !cfg.showNextLevelProgress) return;
      var uid = getCustomerUserId();
      if (!uid) return;
      fetch(
        apiUrl(
          "/api/widget/partner-status?userId=" + encodeURIComponent(String(uid)),
        ),
        { credentials: "omit", cache: "no-store" },
      )
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          applyPartnerProgress(data && data.progress);
        })
        .catch(function () {});
    }
    var undoBar = el("div", { className: "sr-qo-undo-bar", "aria-live": "polite" });
    var cartConfirmBar = el("div", { className: "sr-qo-cart-confirm", "aria-live": "polite" });
    var undoSnapshot = null;
    var undoTimer = null;
    function hideUndoBar() {
      undoSnapshot = null;
      if (undoTimer) {
        clearTimeout(undoTimer);
        undoTimer = null;
      }
      undoBar.classList.remove("is-on");
      undoBar.innerHTML = "";
    }
    function offerUndo(prev, message) {
      undoSnapshot = prev || [];
      if (undoTimer) clearTimeout(undoTimer);
      undoBar.innerHTML = "";
      undoBar.appendChild(el("p", null, [message || "Visszavonhatod."]));
      undoBar.appendChild(
        el("div", { className: "sr-qo-confirm-actions" }, [
          el(
            "button",
            {
              type: "button",
              className: "sr-qo-btn sr-qo-btn-ghost",
              onClick: function () {
                if (!undoSnapshot) return;
                lines = undoSnapshot;
                hideUndoBar();
                saveDraft(lines);
                renderList();
                if (lines.length) showOrderWork();
                else showOrderWorkOrStart();
                setStatus("Lista visszaállítva.");
              },
            },
            ["Visszavonás"],
          ),
        ]),
      );
      undoBar.classList.add("is-on");
      undoTimer = setTimeout(hideUndoBar, 8000);
    }
    function hideCartConfirm() {
      cartConfirmBar.classList.remove("is-on");
      cartConfirmBar.innerHTML = "";
    }
    function showCartSplitConfirm(s) {
      hideUndoBar();
      cartConfirmBar.innerHTML = "";
      cartConfirmBar.appendChild(
        el("p", null, [
          s.cartable +
            " tétel mehet a kosárba, " +
            s.hardBlockers +
            " nem rendelhető.",
        ]),
      );
      cartConfirmBar.appendChild(
        el("div", { className: "sr-qo-confirm-actions" }, [
          el(
            "button",
            {
              type: "button",
              className: "sr-qo-btn sr-qo-btn-success",
              onClick: function () {
                hideCartConfirm();
                addAllToCart({ onlySafe: true });
              },
            },
            ["Csak a rendelhetőket"],
          ),
          el(
            "button",
            {
              type: "button",
              className: "sr-qo-btn sr-qo-btn-ghost",
              onClick: hideCartConfirm,
            },
            ["Javítom a listát"],
          ),
        ]),
      );
      cartConfirmBar.classList.add("is-on");
      setStatus("A problematikus sorok a listán maradhatnak.", true);
    }
    var clearBtn = el(
      "button",
      {
        type: "button",
        className: "sr-qo-btn sr-qo-btn-ghost",
        onClick: function () {
          if (!lines.length) return;
          var prev = lines.slice();
          lines = [];
          saveDraft([]);
          renderList();
          hideCartConfirm();
          showOrderWorkOrStart();
          offerUndo(prev, "Lista törölve. Nyolc másodpercig vissza tudod hozni.");
          setStatus("Lista törölve.");
        },
      },
      ["Törlés"],
    );
    var footer = el("div", { className: "sr-qo-footer" }, [
      undoBar,
      cartConfirmBar,
      el("div", { className: "sr-qo-footer-main" }, [
        partnerProgressEl,
        statusEl,
        el("div", { className: "sr-qo-footer-actions" }, [clearBtn]),
      ]),
    ]);
    loadPartnerStatus();

    function makePlaceholder(title, sub) {
      return el("div", { className: "sr-qo-placeholder" }, [
        el("h3", { className: "sr-qo-placeholder-title" }, [title]),
        el("p", { className: "sr-qo-placeholder-sub" }, [sub]),
      ]);
    }

    /* ─── Rendeléseim ─── */
    var ordersCache = null;
    var ordersLoading = false;
    var ordersSearchQuery = "";
    var ordersStatusFilter = "";
    var ordersDateFrom = "";
    var ordersDateTo = "";
    var selectedOrderIds = {};
    var currentOrderDetail = null;
    var selectedLineKeys = {};

    var ordersSearchInput = el("input", {
      className: "sr-qo-orders-search",
      type: "search",
      placeholder: "Keresés: #, dátum, státusz…",
      autocomplete: "off",
      "aria-label": "Rendelések keresése",
    });
    var ordersCountEl = el("span", { className: "sr-qo-orders-count" }, [""]);
    var ordersStatusSelect = el(
      "select",
      {
        className: "sr-qo-orders-filter",
        "aria-label": "Státusz szűrő",
      },
      [el("option", { value: "" }, ["Minden státusz"])],
    );
    var ordersDateFromInput = el("input", {
      className: "sr-qo-orders-filter",
      type: "date",
      "aria-label": "Dátumtól",
      title: "Dátumtól",
    });
    var ordersDateToInput = el("input", {
      className: "sr-qo-orders-filter",
      type: "date",
      "aria-label": "Dátumig",
      title: "Dátumig",
    });
    var ordersSelectAllCb = el("input", {
      type: "checkbox",
      "aria-label": "Összes látható kijelölése",
    });
    var ordersSelCountEl = el("span", { className: "sr-qo-orders-selcount" }, [""]);
    var ordersExportBtn = el(
      "button",
      {
        type: "button",
        className: "sr-qo-btn-sm sr-qo-btn-sm-primary",
        disabled: true,
      },
      ["Excel"],
    );
    var ordersBulkReorderBtn = el(
      "button",
      {
        type: "button",
        className: "sr-qo-btn-sm",
        disabled: true,
      },
      ["Új megrendelésbe"],
    );
    var ordersSelBar = el("div", { className: "sr-qo-orders-selbar" }, [
      ordersSelCountEl,
      ordersExportBtn,
      ordersBulkReorderBtn,
    ]);

    function refreshOrdersFiltersUi() {
      ordersSearchQuery = ordersSearchInput.value || "";
      ordersStatusFilter = ordersStatusSelect.value || "";
      ordersDateFrom = ordersDateFromInput.value || "";
      ordersDateTo = ordersDateToInput.value || "";
      if (ordersCache) renderOrdersList(ordersCache);
    }
    ordersSearchInput.addEventListener("input", refreshOrdersFiltersUi);
    ordersStatusSelect.addEventListener("change", refreshOrdersFiltersUi);
    ordersDateFromInput.addEventListener("change", refreshOrdersFiltersUi);
    ordersDateToInput.addEventListener("change", refreshOrdersFiltersUi);

    var ordersListBody = el("tbody", null, []);
    var ordersListEmpty = el("div", { className: "sr-qo-placeholder" }, [
      el("h3", { className: "sr-qo-placeholder-title" }, ["Rendeléseim"]),
      el("p", { className: "sr-qo-placeholder-sub" }, [
        "Betöltés…",
      ]),
    ]);
    var ordersListScroll = el("div", { className: "sr-qo-orders-scroll" }, [
      ordersListEmpty,
      el("table", {
        className: "sr-qo-orders-table",
        style: { display: "none" },
        id: "sr-qo-orders-list-table",
      }, [
        el("thead", null, [
          el("tr", null, [
            el("th", { className: "check" }, [ordersSelectAllCb]),
            el("th", null, ["Dátum"]),
            el("th", null, ["#"]),
            el("th", null, ["Státusz"]),
            el("th", null, ["Tételek"]),
            el("th", null, ["Összeg"]),
          ]),
        ]),
        ordersListBody,
      ]),
    ]);
    var ordersListPane = el("div", { className: "sr-qo-orders-pane is-on" }, [
      el("div", { className: "sr-qo-orders-toolbar" }, [
        el("h3", null, ["Korábbi rendelések"]),
        ordersSearchInput,
        ordersCountEl,
        el(
          "button",
          {
            type: "button",
            className: "sr-qo-btn-sm",
            onClick: function () {
              ordersCache = null;
              loadOrdersList(true);
            },
          },
          ["Frissítés"],
        ),
      ]),
      el("div", { className: "sr-qo-orders-filters" }, [
        ordersStatusSelect,
        el("span", { className: "sr-qo-filter-lab" }, ["Tól"]),
        ordersDateFromInput,
        el("span", { className: "sr-qo-filter-lab" }, ["Ig"]),
        ordersDateToInput,
      ]),
      ordersSelBar,
      ordersListScroll,
    ]);

    var ordersDetailTitle = el("h3", null, ["Rendelés"]);
    var ordersDetailMeta = el("div", { className: "sr-qo-orders-detail-meta" });
    var ordersDetailBody = el("tbody", null, []);
    var ordersDetailFoot = el("div", { className: "sr-qo-orders-foot" });
    var detailQtyMenuWrap = null;
    var ordersDetailPane = el("div", { className: "sr-qo-orders-pane" }, [
      el("div", { className: "sr-qo-orders-toolbar" }, [
        el(
          "button",
          {
            type: "button",
            className: "sr-qo-btn-sm",
            onClick: function () {
              showOrdersList();
            },
          },
          ["← Lista"],
        ),
        ordersDetailTitle,
      ]),
      ordersDetailMeta,
      el("div", { className: "sr-qo-orders-scroll" }, [
        el("table", { className: "sr-qo-orders-table" }, [
          el("thead", null, [
            el("tr", null, [
              el("th", { style: { width: "36px" } }, [""]),
              el("th", null, ["Cikkszám"]),
              el("th", null, ["Gyártói"]),
              el("th", null, ["Név"]),
              el("th", null, ["Db"]),
              el("th", null, ["Akkori nettó"]),
              el("th", null, ["Sor"]),
            ]),
          ]),
          ordersDetailBody,
        ]),
      ]),
      ordersDetailFoot,
    ]);

    var ordersRoot = el("div", { className: "sr-qo-orders" }, [
      ordersListPane,
      ordersDetailPane,
    ]);

    function showOrdersList() {
      ordersListPane.classList.add("is-on");
      ordersDetailPane.classList.remove("is-on");
      currentOrderDetail = null;
    }

    function showOrdersDetail() {
      ordersListPane.classList.remove("is-on");
      ordersDetailPane.classList.add("is-on");
    }

    function statusNode(name, color) {
      var dot = el("span", { className: "sr-qo-st-dot", "aria-hidden": "true" });
      if (color) dot.style.background = color;
      return el("span", { className: "sr-qo-st" }, [dot, name || "—"]);
    }

    function lineKey(line, idx) {
      return String(line.sku || "") + "::" + String(idx);
    }

    async function loadOrdersList(force) {
      var table = ordersListScroll.querySelector("#sr-qo-orders-list-table");
      if (!force && ordersCache) {
        renderOrdersList(ordersCache);
        return;
      }
      var userId = getCustomerUserId();
      if (!userId) {
        ordersListEmpty.style.display = "";
        if (table) table.style.display = "none";
        ordersListEmpty.innerHTML = "";
        ordersListEmpty.appendChild(
          el("h3", { className: "sr-qo-placeholder-title" }, ["A rendeléseid a partner fiókhoz tartoznak"]),
        );
        ordersListEmpty.appendChild(
          el("p", { className: "sr-qo-placeholder-sub" }, [
            "Lépj be a céges fiókkal, és itt látod az ismételhető rendeléseket.",
          ]),
        );
        return;
      }
      if (ordersLoading) return;
      ordersLoading = true;
      ordersListEmpty.style.display = "";
      if (table) table.style.display = "none";
      ordersListEmpty.innerHTML = "";
      ordersListEmpty.appendChild(
        el("h3", { className: "sr-qo-placeholder-title" }, ["Rendeléseim"]),
      );
      ordersListEmpty.appendChild(
        el("p", { className: "sr-qo-placeholder-sub" }, ["Betöltés…"]),
      );
      try {
        var res = await fetch(
          apiUrl("/api/orders?userId=" + encodeURIComponent(userId) + "&limit=50"),
        );
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || "Nem sikerült a rendelések lekérése");
        ordersCache = data.orders || [];
        renderOrdersList(ordersCache);
      } catch (e) {
        ordersListEmpty.style.display = "";
        if (table) table.style.display = "none";
        ordersListEmpty.innerHTML = "";
        ordersListEmpty.appendChild(
          el("h3", { className: "sr-qo-placeholder-title" }, ["Hiba"]),
        );
        ordersListEmpty.appendChild(
          el("p", { className: "sr-qo-placeholder-sub" }, [
            e.message || "Nem sikerült betölteni a rendeléseket.",
          ]),
        );
      } finally {
        ordersLoading = false;
      }
    }

    function orderDayKey(o) {
      var raw = o && o.dateCreated ? String(o.dateCreated) : "";
      var t = Date.parse(raw);
      if (!Number.isNaN(t)) {
        var d = new Date(t);
        var m = d.getMonth() + 1;
        var day = d.getDate();
        return (
          d.getFullYear() +
          "-" +
          (m < 10 ? "0" : "") +
          m +
          "-" +
          (day < 10 ? "0" : "") +
          day
        );
      }
      return raw.slice(0, 10);
    }

    function filterOrders(orders) {
      var query = String(ordersSearchQuery || "")
        .trim()
        .toLowerCase();
      var digits = query.replace(/[^0-9]/g, "");
      var statusWant = String(ordersStatusFilter || "").trim().toLowerCase();
      var from = String(ordersDateFrom || "").trim();
      var to = String(ordersDateTo || "").trim();
      return (orders || []).filter(function (o) {
        if (statusWant && String(o.status || "").toLowerCase() !== statusWant) {
          return false;
        }
        var day = orderDayKey(o);
        if (from && day && day < from) return false;
        if (to && day && day > to) return false;
        if (!query) return true;
        var hay = [
          o.innerId,
          "#" + (o.innerId || ""),
          o.dateLabel,
          o.dateCreated,
          o.status,
          o.totalFormatted,
          String(o.total || ""),
          String(o.itemCount || ""),
        ]
          .join(" ")
          .toLowerCase();
        if (hay.indexOf(query) !== -1) return true;
        if (digits && String(o.innerId || "").indexOf(digits) !== -1) return true;
        return false;
      });
    }

    function selectedOrderIdList() {
      return Object.keys(selectedOrderIds).filter(function (id) {
        return selectedOrderIds[id];
      });
    }

    function updateOrdersSelectionUi(filtered) {
      var ids = selectedOrderIdList();
      var n = ids.length;
      ordersSelCountEl.textContent = n ? n + " kijelölve" : "";
      ordersSelBar.className =
        "sr-qo-orders-selbar" + (n ? " is-on" : "");
      ordersExportBtn.disabled = !n;
      ordersBulkReorderBtn.disabled = !n;
      var list = filtered || [];
      var allOn =
        list.length > 0 &&
        list.every(function (o) {
          return selectedOrderIds[o.id];
        });
      ordersSelectAllCb.checked = allOn;
      ordersSelectAllCb.indeterminate =
        !allOn &&
        list.some(function (o) {
          return selectedOrderIds[o.id];
        });
    }

    function syncOrdersStatusOptions(orders) {
      var cur = ordersStatusSelect.value || "";
      var seen = {};
      var names = [];
      (orders || []).forEach(function (o) {
        var s = String(o.status || "").trim();
        if (!s || seen[s]) return;
        seen[s] = true;
        names.push(s);
      });
      names.sort(function (a, b) {
        return a.localeCompare(b, "hu");
      });
      ordersStatusSelect.innerHTML = "";
      ordersStatusSelect.appendChild(
        el("option", { value: "" }, ["Minden státusz"]),
      );
      names.forEach(function (name) {
        ordersStatusSelect.appendChild(
          el("option", { value: name }, [name]),
        );
      });
      if (cur && seen[cur]) ordersStatusSelect.value = cur;
      else {
        ordersStatusSelect.value = "";
        ordersStatusFilter = "";
      }
    }

    function renderOrdersList(orders) {
      var table = ordersListScroll.querySelector("#sr-qo-orders-list-table");
      syncOrdersStatusOptions(orders);
      var filtered = filterOrders(orders);
      ordersListBody.innerHTML = "";
      var hasExtraFilter =
        !!ordersSearchQuery.trim() ||
        !!ordersStatusFilter ||
        !!ordersDateFrom ||
        !!ordersDateTo;
      if (orders && orders.length) {
        ordersCountEl.textContent = hasExtraFilter
          ? filtered.length + " / " + orders.length
          : orders.length + " rendelés";
      } else {
        ordersCountEl.textContent = "";
      }
      if (!orders || !orders.length) {
        ordersListEmpty.style.display = "";
        if (table) table.style.display = "none";
        ordersListEmpty.innerHTML = "";
        ordersListEmpty.appendChild(
          el("h3", { className: "sr-qo-placeholder-title" }, ["Még nincs rendelés"]),
        );
        ordersListEmpty.appendChild(
          el("p", { className: "sr-qo-placeholder-sub" }, [
            "Az első rendelés után itt jelennek meg az előzmények.",
          ]),
        );
        updateOrdersSelectionUi([]);
        return;
      }
      if (!filtered.length) {
        ordersListEmpty.style.display = "";
        if (table) table.style.display = "none";
        ordersListEmpty.innerHTML = "";
        ordersListEmpty.appendChild(
          el("h3", { className: "sr-qo-placeholder-title" }, ["Nincs találat"]),
        );
        ordersListEmpty.appendChild(
          el("p", { className: "sr-qo-placeholder-sub" }, [
            "Próbálj másik # számot, dátumot vagy státuszt.",
          ]),
        );
        updateOrdersSelectionUi([]);
        return;
      }
      ordersListEmpty.style.display = "none";
      if (table) table.style.display = "";
      filtered.forEach(function (o) {
        var oid = o.id;
        var checked = !!selectedOrderIds[oid];
        var cb = el("input", {
          type: "checkbox",
          checked: checked,
          "aria-label": "Rendelés #" + (o.innerId || "") + " kijelölése",
          onClick: function (ev) {
            ev.stopPropagation();
          },
          onChange: function (ev) {
            ev.stopPropagation();
            if (cb.checked) selectedOrderIds[oid] = true;
            else delete selectedOrderIds[oid];
            updateOrdersSelectionUi(filtered);
            tr.classList.toggle("is-selected", !!selectedOrderIds[oid]);
          },
        });
        var tr = el(
          "tr",
          {
            className: checked ? "is-selected" : "",
            title: "Részletek megnyitása",
            onClick: function () {
              openOrderDetail(o.id);
            },
          },
          [
            el("td", { className: "check" }, [cb]),
            el("td", null, [o.dateLabel || "—"]),
            el("td", { className: "num" }, ["#" + (o.innerId || "—")]),
            el("td", null, [statusNode(o.status, o.statusColor)]),
            el("td", { className: "muted" }, [
              String(o.itemCount != null ? o.itemCount : "—"),
            ]),
            el("td", { className: "num" }, [o.totalFormatted || "—"]),
          ],
        );
        ordersListBody.appendChild(tr);
      });
      updateOrdersSelectionUi(filtered);
    }


    ordersSelectAllCb.addEventListener("click", function (ev) {
      ev.stopPropagation();
    });
    ordersSelectAllCb.addEventListener("change", function () {
      var filtered = filterOrders(ordersCache || []);
      var on = ordersSelectAllCb.checked;
      filtered.forEach(function (o) {
        if (on) selectedOrderIds[o.id] = true;
        else delete selectedOrderIds[o.id];
      });
      if (ordersCache) renderOrdersList(ordersCache);
    });
    ordersExportBtn.addEventListener("click", function () {
      exportSelectedOrders();
    });
    ordersBulkReorderBtn.addEventListener("click", function () {
      bulkImportSelectedOrders();
    });

    var ordersExportBusy = false;

    async function exportSelectedOrders() {
      var ids = selectedOrderIdList();
      if (!ids.length || ordersExportBusy) return;
      var userId = getCustomerUserId();
      if (!userId) {
        setStatus("Bejelentkezés szükséges az exporthoz.", true);
        return;
      }
      var MAX_EXPORT = 25;
      var exportIds = ids.slice(0, MAX_EXPORT);
      if (ids.length > MAX_EXPORT) {
        setStatus(
          "Az első " +
            MAX_EXPORT +
            " rendelést exportáljuk (" +
            ids.length +
            " kijelölésből).",
        );
      }
      ordersExportBusy = true;
      ordersExportBtn.disabled = true;
      ordersExportBtn.textContent = "Excel készül…";
      setStatus(
        "Részletes Excel készítése (" + exportIds.length + " rendelés)…",
      );
      try {
        var res = await fetch(apiUrl("/api/orders/export"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: userId, orderIds: exportIds }),
        });
        var ctype = (res.headers.get("content-type") || "").toLowerCase();
        if (!res.ok || ctype.indexOf("json") !== -1) {
          var data = {};
          try {
            data = await res.json();
          } catch (e) {}
          throw new Error(data.error || "Excel export sikertelen");
        }
        var blob = await res.blob();
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download =
          "rendeleseim-tetelek-" +
          new Date().toISOString().slice(0, 10) +
          ".xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () {
          try {
            URL.revokeObjectURL(url);
          } catch (e) {}
        }, 800);
        var nOrders = Number(res.headers.get("X-Export-Orders") || exportIds.length);
        var nLines = Number(res.headers.get("X-Export-Lines") || 0);
        var nErr = Number(res.headers.get("X-Export-Errors") || 0);
        var msg =
          nOrders +
          " rendelés / " +
          nLines +
          " tételsor Excelbe (Tetelek lap).";
        if (nErr > 0) {
          msg += " " + nErr + " figyelmeztetés a Hibak lapon.";
          flashInfo(msg, "warn");
        } else {
          flashInfo(msg, "info");
        }
      } catch (e) {
        setStatus(e.message || "Excel export hiba.", true);
      } finally {
        ordersExportBusy = false;
        ordersExportBtn.textContent = "Excel";
        updateOrdersSelectionUi(filterOrders(ordersCache || []));
      }
    }

    async function bulkImportSelectedOrders() {
      var ids = selectedOrderIdList();
      if (!ids.length) return;
      var prev = [];
      try {
        prev = JSON.parse(JSON.stringify(lines));
      } catch (e2) {
        prev = lines.slice();
      }
      ordersBulkReorderBtn.disabled = true;
      setStatus("Kijelölt rendelések betöltése…");
      try {
        var allLines = [];
        for (var i = 0; i < ids.length; i++) {
          setStatus(
            "Rendelés betöltése… (" + (i + 1) + "/" + ids.length + ")",
          );
          var o = await fetchOrderDetail(ids[i]);
          (o.lines || []).forEach(function (l) {
            allLines.push(l);
          });
        }
        if (!allLines.length) {
          setStatus("A kijelölt rendelésekben nincs tétel.", true);
          return;
        }
        await importReorderLines(allLines, { replace: false });
        flashInfo(
          allLines.length + " tétel a rendeléslistába (kijelölt rendelésekből).",
          "info",
        );
        offerUndo(
          prev,
          allLines.length + " tétel a listán. Nyolc másodpercig vissza tudod hozni az előzőt.",
        );
      } catch (e) {
        setStatus(e.message || "Nem sikerült a kijelöltek betöltése.", true);
      } finally {
        updateOrdersSelectionUi(filterOrders(ordersCache || []));
      }
    }

    async function fetchOrderDetail(orderId) {
      var userId = getCustomerUserId();
      if (!userId) throw new Error("Bejelentkezés szükséges");
      var res = await fetch(
        apiUrl(
          "/api/orders/" +
            encodeURIComponent(orderId) +
            "?userId=" +
            encodeURIComponent(userId),
        ),
      );
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rendelés nem elérhető");
      return data.order;
    }

    async function reorderOrderById(orderId) {
      setBusy(true);
      setStatus("Rendelés betöltése…");
      try {
        var order = await fetchOrderDetail(orderId);
        await importReorderLines(order.lines || [], { replace: false });
      } catch (e) {
        flashError(e.message || "Újrarendelés sikertelen");
        setBusy(false);
      }
    }

    async function openOrderDetail(orderId) {
      showOrdersDetail();
      ordersDetailTitle.textContent = "Rendelés…";
      ordersDetailMeta.textContent = "Betöltés…";
      ordersDetailBody.innerHTML = "";
      ordersDetailFoot.innerHTML = "";
      try {
        currentOrderDetail = await fetchOrderDetail(orderId);
        selectedLineKeys = {};
        (currentOrderDetail.lines || []).forEach(function (l, i) {
          selectedLineKeys[lineKey(l, i)] = true;
        });
        renderOrderDetail();
      } catch (e) {
        ordersDetailTitle.textContent = "Hiba";
        ordersDetailMeta.textContent = e.message || "Nem sikerült betölteni.";
      }
    }

    function renderOrderDetail() {
      var o = currentOrderDetail;
      if (!o) return;
      ordersDetailTitle.textContent = "#" + (o.innerId || "—");
      ordersDetailMeta.innerHTML = "";
      [
        ["Dátum", o.dateLabel || "—"],
        ["Státusz", o.status || "—"],
        ["Tételek", String((o.lines && o.lines.length) || o.itemCount || 0)],
        ["Összeg", o.totalFormatted || "—"],
      ].forEach(function (pair) {
        ordersDetailMeta.appendChild(
          el("span", null, [
            pair[0] + ": ",
            el("strong", null, [pair[1]]),
          ]),
        );
      });
      if (o.paymentMethodName) {
        ordersDetailMeta.appendChild(
          el("span", null, [
            "Fizetés: ",
            el("strong", null, [o.paymentMethodName]),
          ]),
        );
      }
      if (o.shippingMethodName) {
        ordersDetailMeta.appendChild(
          el("span", null, [
            "Szállítás: ",
            el("strong", null, [o.shippingMethodName]),
          ]),
        );
      }

      function pickedLines() {
        return (o.lines || []).filter(function (l, i) {
          return selectedLineKeys[lineKey(l, i)];
        });
      }

      function closeQtyMenu() {
        if (detailQtyMenuWrap) detailQtyMenuWrap.classList.remove("is-open");
      }

      ordersDetailBody.innerHTML = "";
      (o.lines || []).forEach(function (l, i) {
        var key = lineKey(l, i);
        var cb = el("input", {
          type: "checkbox",
          className: "sr-qo-check",
          checked: !!selectedLineKeys[key],
          "aria-label": "Kiválaszt: " + (l.sku || ""),
          onClick: function (ev) {
            ev.stopPropagation();
          },
          onChange: function () {
            if (cb.checked) selectedLineKeys[key] = true;
            else delete selectedLineKeys[key];
          },
        });
        cb.checked = !!selectedLineKeys[key];
        var nameText = l.name || "—";
        var href = productPageUrl(l);
        var nameInner = href
          ? el(
              "a",
              {
                className: "sr-qo-name-link",
                href: href,
                target: "_blank",
                rel: "noopener noreferrer",
                title: "Termék megnyitása új ablakban",
                onClick: function (ev) {
                  ev.stopPropagation();
                },
              },
              [nameText],
            )
          : nameText;
        ordersDetailBody.appendChild(
          el("tr", null, [
            el("td", null, [cb]),
            el("td", { className: "sr-qo-mono" }, [l.sku || "—"]),
            el("td", { className: "sr-qo-mono muted" }, [l.modelNumber || "—"]),
            el("td", { className: "sr-qo-name" }, [nameInner]),
            el("td", { className: "num" }, [String(l.quantity || 1) + " db"]),
            el("td", { className: "num" }, [
              l.priceNet != null ? formatHufClient(l.priceNet) : "—",
            ]),
            el("td", { className: "num" }, [
              l.lineTotalNet != null
                ? formatHufClient(l.lineTotalNet)
                : "—",
            ]),
          ]),
        );
      });

      ordersDetailFoot.innerHTML = "";
      var exportOneBtn = el(
        "button",
        {
          type: "button",
          className: "sr-qo-btn sr-qo-btn-ghost",
          onClick: function () {
            if (!o.id) return;
            var prev = selectedOrderIds;
            selectedOrderIds = {};
            selectedOrderIds[o.id] = true;
            Promise.resolve(exportSelectedOrders()).then(
              function () {
                selectedOrderIds = prev;
                if (ordersCache) updateOrdersSelectionUi(filterOrders(ordersCache));
              },
              function () {
                selectedOrderIds = prev;
                if (ordersCache) updateOrdersSelectionUi(filterOrders(ordersCache));
              },
            );
          },
        },
        ["Excel"],
      );

      var qtyToggle = el(
        "button",
        {
          type: "button",
          className: "sr-qo-btn sr-qo-btn-ghost",
          "aria-haspopup": "menu",
          onClick: function (ev) {
            ev.stopPropagation();
            qtyMenuWrap.classList.toggle("is-open");
          },
        },
        ["Mennyiség ▾"],
      );
      var qtyPanel = el("div", {
        className: "sr-qo-qty-menu-panel",
        role: "menu",
      });
      function addQtyItem(label, sub, opts) {
        qtyPanel.appendChild(
          el(
            "button",
            {
              type: "button",
              className: "sr-qo-qty-menu-item",
              role: "menuitem",
              onClick: function (ev) {
                ev.stopPropagation();
                closeQtyMenu();
                var lines = pickedLines();
                if (!lines.length) {
                  setStatus("Jelölj ki legalább egy tételt.", true);
                  return;
                }
                importReorderLines(lines, opts || { replace: false });
              },
            },
            [label, el("small", null, [sub])],
          ),
        );
      }
      addQtyItem(
        "Eredeti mennyiség",
        "Ahogy a rendelésben szerepelt",
        { replace: false },
      );
      addQtyItem(
        "Javasolt mennyiség",
        "Vásárlási előzmény alapján",
        { replace: false, useSuggested: true },
      );
      addQtyItem(
        "Feltöltött mennyiség",
        "Javasolt + feltöltés",
        { replace: false, qtyMode: "boost" },
      );
      var qtyMenuWrap = el("div", { className: "sr-qo-qty-menu" }, [
        qtyToggle,
        qtyPanel,
      ]);
      detailQtyMenuWrap = qtyMenuWrap;

      var primaryBtn = el(
        "button",
        {
          type: "button",
          className: "sr-qo-btn sr-qo-btn-success",
          onClick: function () {
            var lines = pickedLines();
            if (!lines.length) {
              setStatus("Jelölj ki legalább egy tételt.", true);
              return;
            }
            importReorderLines(lines, { replace: false });
          },
        },
        ["Kiválasztottak → Új megrendelés"],
      );

      ordersDetailFoot.appendChild(exportOneBtn);
      ordersDetailFoot.appendChild(qtyMenuWrap);
      ordersDetailFoot.appendChild(primaryBtn);

    }


    /* ─── Új megrendelés: indító / excel / email / kép / review ─── */
    var orderPaneMode = "start";
    var reviewRows = [];
    var reviewPreviewUrl = null;

    var orderStartPane = el("div", { className: "sr-qo-order-pane is-on", id: "sr-qo-pane-start" }, [
      el("div", { className: "sr-qo-start" }, [
        el("h3", { className: "sr-qo-start-title" }, [
          moduleOn("search") ? "Tömeges belépés" : "Hogyan indítod a rendelést?",
        ]),
        el("p", { className: "sr-qo-start-sub" }, [
          moduleOn("search")
            ? "Excel, beillesztett lista vagy fotó. A keresőhöz: Vissza."
            : "Válassz forrást. A rendeléseid a saját fülön maradnak.",
        ]),
        (function () {
          var cards = [];
          if (moduleOn("search")) {
            cards.push(
              el(
                "button",
                {
                  type: "button",
                  className: "sr-qo-start-card",
                  onClick: function () {
                    showOrderWork();
                    setTimeout(function () {
                      try {
                        skuInput.focus();
                      } catch (e) {}
                    }, 30);
                  },
                },
                [
                  el("strong", null, ["Kézi bevitel"]),
                  el("span", null, ["Cikkszám / gyártói / vonalkód, Enter"]),
                ],
              ),
            );
          }
          if (moduleOn("excel")) {
            cards.push(
              el(
                "button",
                {
                  type: "button",
                  className: "sr-qo-start-card",
                  onClick: function () {
                    openExcelIngest();
                  },
                },
                [
                  el("strong", null, ["Excel"]),
                  el("span", null, ["Sablon letöltés + feltöltés (.xlsx)"]),
                ],
              ),
            );
          }
          if (moduleOn("email")) {
            cards.push(
              el(
                "button",
                {
                  type: "button",
                  className: "sr-qo-start-card",
                  onClick: function () {
                    openEmailIngest();
                  },
                },
                [
                  el("strong", null, ["Szöveg / SKU lista"]),
                  el("span", null, [
                    "Illeszd be a sorokat: SKU + db (email szöveg is OK)",
                  ]),
                ],
              ),
            );
          }
          if (moduleOn("image")) {
            cards.push(
              el(
                "button",
                {
                  type: "button",
                  className: "sr-qo-start-card",
                  onClick: function () {
                    openImageIngest();
                  },
                },
                [
                  el("strong", null, ["Kép / kézírás"]),
                  el("span", null, ["Fotó a listáról — ellenőrzés után beemelés"]),
                ],
              ),
            );
          }
          if (!cards.length) {
            cards.push(
              el("p", { className: "sr-qo-start-sub" }, [
                "Nincs engedélyezett rendelési mód. Kapcsold be a Widget beállításokban.",
              ]),
            );
          }
          return el("div", { className: "sr-qo-start-grid" }, cards);
        })(),
      ]),
    ]);

    var excelFileInput = el("input", {
      type: "file",
      accept:
        ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel",
      style: { display: "none" },
    });
    var excelFileLabel = el("span", { className: "sr-qo-ingest-hint" }, [
      "Még nincs kiválasztott fájl.",
    ]);
    excelParseBtn = el(
      "button",
      {
        type: "button",
        className: "sr-qo-btn sr-qo-btn-primary",
        onClick: function () {
          runExcelParse();
        },
      },
      ["Feltöltés és ellenőrzés"],
    );
    var excelBusyTitle = el("p", { className: "sr-qo-busy-title" }, ["Ellenőrizzük a cikkszámokat…"]);
    var excelBusySub = el("p", { className: "sr-qo-busy-sub" }, [
      "A listát összevetjük a katalógussal. Ez általában néhány másodperc.",
    ]);
    var excelBusy = el("div", { className: "sr-qo-busy", "aria-live": "polite" }, [
      el("div", { className: "sr-qo-busy-card" }, [
        el("div", { className: "sr-qo-spinner", "aria-hidden": "true" }),
        excelBusyTitle,
        excelBusySub,
      ]),
    ]);
    var orderExcelPane = el("div", { className: "sr-qo-order-pane", id: "sr-qo-pane-excel" }, [
      el("div", { className: "sr-qo-ingest" }, [
        el("div", { className: "sr-qo-ingest-bar" }, [
          el(
            "button",
            {
              type: "button",
              className: "sr-qo-btn-sm",
              onClick: function () {
                if (excelBusy.classList.contains("is-on")) return;
                showOrderWorkOrStart();
              },
            },
            ["← Vissza"],
          ),
          el("h3", null, ["Excel"]),
          excelParseBtn,
        ]),
        el("div", { className: "sr-qo-ingest-body" }, [
          el("p", { className: "sr-qo-ingest-hint" }, [
            "Töltsd le a sablont, töltsd ki (A: cikkszám / gyári / vonalkód, B: mennyiség), majd töltsd fel az .xlsx fájlt.",
          ]),
          el("div", { className: "sr-qo-source-btns" }, [
            el(
              "a",
              {
                className: "sr-qo-file-btn",
                href: apiBase() + "/sablon-gyors-rendeles.xlsx",
                download: "sablon-gyors-rendeles.xlsx",
                target: "_blank",
                rel: "noopener",
              },
              ["Sablon letöltése (.xlsx)"],
            ),
            el(
              "button",
              {
                type: "button",
                className: "sr-qo-file-btn",
                onClick: function () {
                  excelFileInput.click();
                },
              },
              ["Excel fájl kiválasztása"],
            ),
          ]),
          excelFileInput,
          excelFileLabel,
        ]),
        excelBusy,
      ]),
    ]);
    excelFileInput.addEventListener("change", function () {
      var f = excelFileInput.files && excelFileInput.files[0];
      excelFileLabel.textContent = f
        ? "Kiválasztva: " + f.name
        : "Még nincs kiválasztott fájl.";
    });

    var emailArea = el("textarea", {
      className: "sr-qo-textarea",
      style: { minHeight: "220px", height: "220px" },
      placeholder:
        "Illeszd be a SKU listát vagy email szöveget…\n\nPl.:\nSS11,2\nSS12 5\nF014891 — 5\n\nVagy:\nSziasztok, kérek:\nSS11 2db",
      "aria-label": "Szöveg / SKU lista",
    });
    emailParseBtn = el(
      "button",
      {
        type: "button",
        className: "sr-qo-btn sr-qo-btn-primary",
        onClick: function () {
          runEmailParse();
        },
      },
      ["Feldolgozás"],
    );
    var emailBusyTitle = el("p", { className: "sr-qo-busy-title" }, ["Egy pillanat…"]);
    var emailBusySub = el("p", { className: "sr-qo-busy-sub" }, [
      "Kinyerjük a cikkszámokat és darabszámokat…",
    ]);
    var emailBusy = el("div", { className: "sr-qo-busy", "aria-live": "polite" }, [
      el("div", { className: "sr-qo-busy-card" }, [
        el("div", { className: "sr-qo-spinner", "aria-hidden": "true" }),
        emailBusyTitle,
        emailBusySub,
      ]),
    ]);
    var orderEmailPane = el("div", { className: "sr-qo-order-pane", id: "sr-qo-pane-email" }, [
      el("div", { className: "sr-qo-ingest" }, [
        el("div", { className: "sr-qo-ingest-bar" }, [
          el(
            "button",
            {
              type: "button",
              className: "sr-qo-btn-sm",
              onClick: function () {
                showOrderWorkOrStart();
              },
            },
            ["← Vissza"],
          ),
          el("h3", null, ["Szöveg / SKU lista"]),
          emailParseBtn,
        ]),
        el("div", { className: "sr-qo-ingest-body" }, [
          el("p", { className: "sr-qo-ingest-hint" }, [
            "Egy sor = egy tétel. Formátum: SKU,db vagy SKU 2db — email szöveg is működik. Utána ellenőrzöd a sorokat.",
          ]),
          emailArea,
        ]),
        emailBusy,
      ]),
    ]);

    var imageFileInput = el("input", {
      type: "file",
      accept: "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp",
      style: { display: "none" },
    });
    var imageDrop = el("div", { className: "sr-qo-drop" }, [
      "Húzd ide a képet, vagy kattints a fájlválasztáshoz.\nJPG / PNG / WebP — kézírás is OK.",
    ]);
    imageDrop.addEventListener("click", function () {
      imageFileInput.click();
    });
    ["dragenter", "dragover"].forEach(function (evName) {
      imageDrop.addEventListener(evName, function (ev) {
        ev.preventDefault();
        imageDrop.classList.add("is-over");
      });
    });
    imageDrop.addEventListener("dragleave", function () {
      imageDrop.classList.remove("is-over");
    });
    imageDrop.addEventListener("drop", function (ev) {
      ev.preventDefault();
      imageDrop.classList.remove("is-over");
      var f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (f) processImageFile(f);
    });
    imageFileInput.addEventListener("change", function () {
      var f = imageFileInput.files && imageFileInput.files[0];
      if (f) processImageFile(f);
    });
    var imageBusyTitle = el("p", { className: "sr-qo-busy-title" }, ["Kiolvassuk a sorokat…"]);
    var imageBusySub = el("p", { className: "sr-qo-busy-sub" }, [
      "Kézírásnál ez 20–40 másodperc is lehet. Utána te ellenőrzöd, mielőtt a listára kerül.",
    ]);
    var imageBusy = el("div", { className: "sr-qo-busy", "aria-live": "polite" }, [
      el("div", { className: "sr-qo-busy-card" }, [
        el("div", { className: "sr-qo-spinner", "aria-hidden": "true" }),
        imageBusyTitle,
        imageBusySub,
      ]),
    ]);
    var orderImagePane = el("div", { className: "sr-qo-order-pane", id: "sr-qo-pane-image" }, [
      el("div", { className: "sr-qo-ingest" }, [
        el("div", { className: "sr-qo-ingest-bar" }, [
          el(
            "button",
            {
              type: "button",
              className: "sr-qo-btn-sm",
              onClick: function () {
                if (imageBusy.classList.contains("is-on")) return;
                showOrderWorkOrStart();
              },
            },
            ["← Vissza"],
          ),
          el("h3", null, ["Kép / kézírás"]),
        ]),
        el("div", { className: "sr-qo-ingest-body" }, [
          el("p", { className: "sr-qo-ingest-hint" }, [
            "Készíts éles, felülről fotót a listáról. Kinyerjük a sorokat; te ellenőrzöd, mielőtt a rendelésbe kerül.",
          ]),
          imageDrop,
          imageFileInput,
        ]),
        imageBusy,
      ]),
    ]);

    function setIngestBusy(overlay, on) {
      if (!overlay) return;
      overlay.classList.toggle("is-on", !!on);
    }

    var reviewWarn = el("p", { className: "sr-qo-ingest-hint" });
    var reviewImg = el("img", {
      className: "sr-qo-review-preview",
      alt: "Forrás kép",
      style: { display: "none" },
    });
    var reviewBody = el("tbody", null, []);
    reviewApplyBtn = el(
      "button",
      {
        type: "button",
        className: "sr-qo-btn sr-qo-btn-success",
        onClick: function () {
          applyReviewSelection();
        },
      },
      ["Hozzáadás a listához"],
    );
    var orderReviewPane = el("div", { className: "sr-qo-order-pane", id: "sr-qo-pane-review" }, [
      el("div", { className: "sr-qo-ingest" }, [
        el("div", { className: "sr-qo-ingest-bar" }, [
          el(
            "button",
            {
              type: "button",
              className: "sr-qo-btn-sm",
              onClick: function () {
                showOrderWorkOrStart();
              },
            },
            ["← Vissza"],
          ),
          el("h3", null, ["Ellenőrzés"]),
          reviewApplyBtn,
        ]),
        el("div", { className: "sr-qo-ingest-body" }, [
          reviewWarn,
          reviewImg,
          el("div", { className: "sr-qo-orders-scroll", style: { maxHeight: "none", flex: "1" } }, [
            el("table", { className: "sr-qo-orders-table" }, [
              el("thead", null, [
                el("tr", null, [
                  el("th", { style: { width: "36px" } }, [""]),
                  el("th", null, ["Kód"]),
                  el("th", null, ["Db"]),
                  el("th", null, ["Bizonyosság"]),
                  el("th", null, ["Nyers"]),
                ]),
              ]),
              reviewBody,
            ]),
          ]),
        ]),
      ]),
    ]);

    var orderWorkPane = el(
      "div",
      { className: "sr-qo-order-pane", id: "sr-qo-pane-work" },
      [toolbar, csvWrap, main, footer],
    );

    var orderStack = el("div", { className: "sr-qo-order-stack" }, [
      orderStartPane,
      orderExcelPane,
      orderEmailPane,
      orderImagePane,
      orderReviewPane,
      orderWorkPane,
    ]);

    function setOrderPane(mode) {
      orderPaneMode = mode;
      var map = {
        start: orderStartPane,
        excel: orderExcelPane,
        email: orderEmailPane,
        image: orderImagePane,
        review: orderReviewPane,
        work: orderWorkPane,
      };
      Object.keys(map).forEach(function (k) {
        map[k].classList.toggle("is-on", k === mode);
      });
    }

    function showOrderStart() {
      setOrderPane("start");
    }
    function showOrderWork() {
      setOrderPane("work");
      setTimeout(function () {
        try {
          skuInput.focus();
        } catch (e) {}
      }, 20);
    }
    function showOrderWorkOrStart() {
      if (moduleOn("search")) showOrderWork();
      else showOrderStart();
    }
    function openExcelIngest() {
      if (!moduleOn("excel")) { flashError("Ez a mód ki van kapcsolva."); return; }

      setOrderPane("excel");
    }
    function openEmailIngest() {
      if (!moduleOn("email")) { flashError("Ez a mód ki van kapcsolva."); return; }

      setOrderPane("email");
      setTimeout(function () {
        try {
          emailArea.focus();
        } catch (e) {}
      }, 20);
    }
    function openImageIngest() {
      if (!moduleOn("image")) { flashError("Ez a mód ki van kapcsolva."); return; }

      setOrderPane("image");
    }

    function syncOrderPane() {
      if (
        orderPaneMode === "review" ||
        orderPaneMode === "excel" ||
        orderPaneMode === "email" ||
        orderPaneMode === "image"
      ) {
        return;
      }
      if (lines.length) showOrderWork();
      else showOrderWorkOrStart();
    }

    function confClass(c) {
      if (c >= 0.85) return "sr-qo-conf sr-qo-conf-hi";
      if (c >= 0.6) return "sr-qo-conf sr-qo-conf-mid";
      return "sr-qo-conf sr-qo-conf-lo";
    }

    function updateReviewApplyLabel() {
      var n = reviewRows.filter(function (r) {
        return r.selected && r.code;
      }).length;
      reviewApplyBtn.textContent = "Hozzáadás a listához (" + n + ")";
    }

    function looksMostlyEnglish(s) {
      if (!s) return false;
      return /\b(the|and|or|could|would|handwritten|document|digit|ambiguity|trailing|standard|fairly|clear|piece|context|possible|scripts|abbreviation)\b/i.test(
        s,
      );
    }

    function huDocumentKind(kind) {
      if (kind === "handwritten_list") {
        return "Kézírásos lista — ellenőrizd a kódokat és darabszámokat.";
      }
      if (kind === "printed_po") return "Nyomtatott megrendelő — ellenőrizd a sorokat.";
      if (kind === "email") return "Emailből kinyert tételek — ellenőrizd a kódokat.";
      if (kind === "spreadsheet_like") return "Táblázatszerű lista — ellenőrizd a sorokat.";
      return null;
    }

    function openReview(parsed, previewUrl) {
      reviewRows = (parsed.lines || []).map(function (l) {
        var conf = typeof l.confidence === "number" ? l.confidence : 0.5;
        var notes = (l.notes || "").trim();
        if (looksMostlyEnglish(notes)) notes = "";
        return {
          selected: conf >= 0.6 && !!(l.codeHint || l.rawText),
          code: (l.codeHint || "").trim(),
          quantity: Math.max(1, parseInt(l.quantity, 10) || 1),
          confidence: conf,
          rawText: l.rawText || "",
          notes: notes,
          quantityUncertain: !!l.quantityUncertain,
        };
      });
      var warns = [];
      var kindMsg = huDocumentKind(parsed.documentKind);
      if (kindMsg) warns.push(kindMsg);
      (parsed.warnings || []).forEach(function (w) {
        var t = String(w || "").trim();
        if (!t || looksMostlyEnglish(t)) return;
        if (kindMsg && t === kindMsg) return;
        warns.push(t);
      });
      reviewWarn.textContent = warns.length
        ? warns.join(" · ")
        : (parsed.lines || []).length + " sor felismerve — ellenőrizd, mielőtt a rendelésbe kerül.";
      if (previewUrl) {
        reviewPreviewUrl = previewUrl;
        reviewImg.src = previewUrl;
        reviewImg.style.display = "";
      } else {
        reviewPreviewUrl = null;
        reviewImg.removeAttribute("src");
        reviewImg.style.display = "none";
      }
      renderReviewTable();
      setOrderPane("review");
    }

    function renderReviewTable() {
      reviewBody.innerHTML = "";
      reviewRows.forEach(function (row, idx) {
        var cb = el("input", {
          type: "checkbox",
          className: "sr-qo-check",
          checked: row.selected,
          onChange: function () {
            row.selected = cb.checked;
            updateReviewApplyLabel();
          },
        });
        cb.checked = row.selected;
        var codeInput = el("input", {
          className: "sr-qo-input",
          style: { height: "28px", width: "100%", minWidth: "100px" },
          value: row.code,
          "aria-label": "Kód " + (idx + 1),
        });
        codeInput.addEventListener("change", function () {
          row.code = codeInput.value.trim();
          updateReviewApplyLabel();
        });
        var qtyInputR = el("input", {
          className: "sr-qo-input sr-qo-qty-toolbar",
          type: "number",
          min: "1",
          value: String(row.quantity),
          style: { height: "28px" },
        });
        qtyInputR.addEventListener("change", function () {
          row.quantity = Math.max(1, parseInt(qtyInputR.value, 10) || 1);
        });
        var confPct = Math.round((row.confidence || 0) * 100) + "%";
        var rawCell = row.rawText || "";
        if (row.notes) rawCell = rawCell ? rawCell + " — " + row.notes : row.notes;
        reviewBody.appendChild(
          el("tr", null, [
            el("td", null, [cb]),
            el("td", null, [codeInput]),
            el("td", null, [qtyInputR]),
            el("td", null, [
              el("span", { className: confClass(row.confidence) }, [confPct]),
            ]),
            el("td", { className: "muted" }, [rawCell]),
          ]),
        );
      });
      updateReviewApplyLabel();
    }

    async function applyReviewSelection() {
      var picked = reviewRows
        .filter(function (r) {
          return r.selected && r.code;
        })
        .map(function (r) {
          return { sku: r.code, quantity: r.quantity };
        });
      if (!picked.length) {
        flashError("Jelölj ki legalább egy sort kóddal.");
        return;
      }
      showOrderWork();
      setBusy(true);
      setStatus("Tételek keresése…");
      try {
        var products = await resolveCodes(picked);
        var added = 0;
        var merged = 0;
        var missing = 0;
        products.forEach(function (p, j) {
          if (!p || !p.found) {
            missing++;
            return;
          }
          var r = upsertResolvedProduct(p, picked[j].quantity);
          if (r.merged) merged++;
          else added++;
        });
        consolidateDuplicateProducts();
        await softRefreshPricing();
        renderList();
        persist();
        if (missing && !added && !merged) {
          flashError("Egyik felismert kód sem található a katalógusban.");
        } else if (missing) {
          flashInfo(
            added + " új, " + merged + " db növelve, " + missing + " nem található.",
            "warn",
          );
        } else {
          flashInfo(added + " új, " + merged + " db növelve a rendelésbe.", "info");
        }
      } catch (e) {
        flashError(e.message || "Beemelés sikertelen");
      } finally {
        setBusy(false);
      }
    }

    async function runExcelParse() {
      var f = excelFileInput.files && excelFileInput.files[0];
      if (!f) {
        flashError("Válassz ki egy Excel fájlt (.xlsx), vagy töltsd le a sablont.");
        return;
      }
      setBusy(true);
      setIngestBusy(excelBusy, true);
      setStatus("Excel ellenőrzése…");
      try {
        var fd = new FormData();
        fd.append("file", f, f.name || "lista.xlsx");
        var res = await fetch(apiUrl("/api/orders/parse-excel"), {
          method: "POST",
          body: fd,
        });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || "Excel feldolgozás sikertelen");
        if (!data.lines || !data.lines.length) {
          flashError("Nincs beolvasható sor a fájlban.");
          return;
        }
        openReview(data, null);
      } catch (e) {
        flashError(e.message || "Excel feldolgozás sikertelen");
      } finally {
        setIngestBusy(excelBusy, false);
        setBusy(false);
      }
    }

    async function runEmailParse() {
      var text = (emailArea.value || "").trim();
      if (!text) {
        flashError("Illeszd be a SKU listát vagy a szöveges rendelést.");
        return;
      }
      setBusy(true);
      setIngestBusy(emailBusy, true);
      setStatus("SKU lista feldolgozása…");
      try {
        var res = await fetch(apiUrl("/api/orders/parse-text"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text }),
        });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || "Feldolgozás sikertelen");
        if (!data.lines || !data.lines.length) {
          flashError("Nem találtam tételt a szövegben.");
          return;
        }
        openReview(data, null);
      } catch (e) {
        flashError(e.message || "Email feldolgozás sikertelen");
      } finally {
        setIngestBusy(emailBusy, false);
        setBusy(false);
      }
    }

    async function processImageFile(file) {
      if (!file || !/^image\//.test(file.type || "")) {
        flashError("Csak képfájl (JPG/PNG/WebP) támogatott.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        flashError("Max 10 MB kép.");
        return;
      }
      var localUrl = URL.createObjectURL(file);
      setBusy(true);
      setIngestBusy(imageBusy, true);
      setStatus("Kép feldolgozása…");
      try {
        var fd = new FormData();
        fd.append("file", file, file.name || "order.jpg");
        var res = await fetch(apiUrl("/api/orders/parse-image"), {
          method: "POST",
          body: fd,
        });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || "Kép feldolgozás sikertelen");
        if (!data.lines || !data.lines.length) {
          flashError("Nem találtam tételt a képen.");
          return;
        }
        openReview(data, localUrl);
      } catch (e) {
        try {
          URL.revokeObjectURL(localUrl);
        } catch (e2) {}
        flashError(e.message || "Kép feldolgozás sikertelen");
      } finally {
        setIngestBusy(imageBusy, false);
        setBusy(false);
      }
    }


    var homeQtyMenuWrap = null;
    var homeRoot = el("div", { className: "sr-qo-home" }, [
      el("div", { className: "sr-qo-home-hero" }, [
        el("div", null, [
          el("h3", null, ["Mit rendelj ma?"]),
          el("p", { id: "sr-qo-home-sub" }, [
            "Egy kattintással a tipikus tételeidhez — vagy indíts új listát.",
          ]),
        ]),
        el(
          "button",
          {
            type: "button",
            className: "sr-qo-btn sr-qo-btn-primary",
            onClick: function () {
              setView("order");
              showOrderWorkOrStart();
            },
          },
          ["Új megrendelés"],
        ),
      ]),
    ]);
    var homeMeta = el("p", { className: "sr-qo-home-meta", style: { display: "none" } });
    var homeGrid = el("div", { className: "sr-qo-home-grid" });
    homeRoot.appendChild(homeMeta);
    homeRoot.appendChild(homeGrid);

    function renderHomeLoading() {
      homeMeta.style.display = "none";
      homeMeta.textContent = "";
      homeGrid.innerHTML = "";
      homeGrid.appendChild(
        el("div", { className: "sr-qo-card" }, [
          el("h4", null, ["Egy pillanat…"]),
          el("p", { className: "sub" }, [
            "Rendelési előzmények alapján készül a javaslat.",
          ]),
        ]),
      );
    }

    function renderHomeEmpty() {
      homeMeta.style.display = "none";
      homeMeta.textContent = "";
      homeGrid.innerHTML = "";
      homeGrid.appendChild(
        el("div", { className: "sr-qo-card" }, [
          el("h4", null, ["Az első rendelés után okosabb lesz"]),
          el("p", { className: "sub" }, [
            "Itt jelenik meg, mit rendelsz gyakran — addig cikkszámra keresel, vagy a Rendeléseim fülön ismételsz.",
          ]),
          el(
            "button",
            {
              type: "button",
              className: "sr-qo-btn sr-qo-btn-primary",
              style: { marginTop: "8px" },
              onClick: function () {
                setView("order");
                showOrderWorkOrStart();
              },
            },
            ["Új lista — cikkszámmal"],
          ),
        ]),
      );
    }

    function prodRowPlain(p) {
      var bits = [];
      if (p.sku) bits.push(p.sku);
      if (p.daysSince != null) bits.push(p.daysSince + " napja");
      if (p.suggestedQty) bits.push("javasolt " + p.suggestedQty + " db");
      return el("div", { className: "sr-qo-prod-row is-plain" }, [
        el("div", null, [
          el("div", { className: "t" }, [p.name || p.sku || "—"]),
          el("div", { className: "m" }, [bits.join(" · ") || "—"]),
        ]),
      ]);
    }

    function makeHomeQtyMenu(list) {
      var toggle = el(
        "button",
        {
          type: "button",
          className: "sr-qo-btn sr-qo-btn-ghost",
          "aria-haspopup": "menu",
          onClick: function (ev) {
            ev.stopPropagation();
            if (homeQtyMenuWrap)
              homeQtyMenuWrap.classList.toggle("is-open");
          },
        },
        ["Mennyiség ▾"],
      );
      var panel = el("div", {
        className: "sr-qo-qty-menu-panel",
        role: "menu",
      });
      function addItem(label, sub, mode) {
        panel.appendChild(
          el(
            "button",
            {
              type: "button",
              className: "sr-qo-qty-menu-item",
              role: "menuitem",
              onClick: function (ev) {
                ev.stopPropagation();
                if (homeQtyMenuWrap)
                  homeQtyMenuWrap.classList.remove("is-open");
                addProductsFromInsights(list, mode);
              },
            },
            [label, el("small", null, [sub])],
          ),
        );
      }
      addItem(
        "Javasolt mennyiség",
        "Előzmény alapján",
        "suggested",
      );
      addItem(
        "Feltöltött mennyiség",
        "Javasolt + feltöltés",
        "boost",
      );
      var wrap = el("div", { className: "sr-qo-qty-menu" }, [toggle, panel]);
      homeQtyMenuWrap = wrap;
      return wrap;
    }

    function renderHome(data) {
      insightsData = data;
      try {
        updateOrderRemind();
        updateEmptyState();
      } catch (e) {}
      var st = data.stats || {};
      homeGrid.innerHTML = "";

      if (st.daysSinceLastOrder != null) {
        homeMeta.style.display = "";
        homeMeta.innerHTML = "";
        homeMeta.appendChild(
          document.createTextNode("Utolsó rendelés óta: "),
        );
        homeMeta.appendChild(
          el("strong", null, [String(st.daysSinceLastOrder) + " nap"]),
        );
        if (st.nextOrderHint) {
          homeMeta.appendChild(document.createTextNode(" · " + st.nextOrderHint));
        }
      } else if (st.nextOrderHint) {
        homeMeta.style.display = "";
        homeMeta.textContent = st.nextOrderHint;
      } else {
        homeMeta.style.display = "none";
        homeMeta.textContent = "";
      }

      var dues = data.dueSoon || [];
      var tops = data.topProducts || [];
      var useDue = dues.length > 0;
      var suggestList = (useDue ? dues : tops).slice(0, 6);
      var suggestCard = el("div", { className: "sr-qo-card" }, [
        el("h4", null, [useDue ? "Most esedékes" : "Gyakori tételeid"]),
        el("p", { className: "sub" }, [
          useDue
            ? (st.nextOrderHint ||
              "Régóta nem rendelted — érdemes pótolni.")
            : "Amit gyakran rendelsz — egy kattintással a listára.",
        ]),
      ]);
      if (!suggestList.length) {
        suggestCard.appendChild(
          el("p", { className: "sub" }, [
            "Még nincs megjeleníthető javaslat.",
          ]),
        );
      } else {
        suggestList.forEach(function (p) {
          suggestCard.appendChild(prodRowPlain(p));
        });
        var actions = el("div", { className: "sr-qo-home-actions" });
        actions.appendChild(
          el(
            "button",
            {
              type: "button",
              className: "sr-qo-btn sr-qo-btn-success",
              onClick: function () {
                addProductsFromInsights(suggestList, "suggested");
              },
            },
            ["Javasoltak a rendelésbe"],
          ),
        );
        actions.appendChild(makeHomeQtyMenu(suggestList));
        suggestCard.appendChild(actions);
      }

      var lastCard = el("div", { className: "sr-qo-card" }, [
        el("h4", null, ["Utolsó rendelésed"]),
        el("p", { className: "sub" }, [
          data.lastOrder
            ? data.lastOrder.dateLabel +
              " · " +
              data.lastOrder.totalFormatted
            : "Nincs megjeleníthető utolsó rendelés.",
        ]),
      ]);
      if (data.lastOrder) {
        var lastActions = el("div", { className: "sr-qo-home-actions" });
        lastActions.appendChild(
          el(
            "button",
            {
              type: "button",
              className: "sr-qo-btn sr-qo-btn-success",
              onClick: function () {
                importReorderLines(data.lastOrder.lines || [], {
                  replace: true,
                });
              },
            },
            ["Újra a listába"],
          ),
        );
        lastActions.appendChild(
          el(
            "button",
            {
              type: "button",
              className: "sr-qo-btn sr-qo-btn-ghost",
              onClick: function () {
                setView("orders");
                if (data.lastOrder.id) openOrderDetail(data.lastOrder.id);
              },
            },
            ["Részletek"],
          ),
        );
        lastCard.appendChild(lastActions);
      }

      // Utolsó rendelés előrébb — gyorsabb ismétlés
      if (data.lastOrder) homeGrid.appendChild(lastCard);
      homeGrid.appendChild(suggestCard);
      if (!data.lastOrder) homeGrid.appendChild(lastCard);
    }

    async function loadHomeInsights(force) {
      if (!moduleOn("insights")) {
        insightsLoading = false;
        return;
      }

      var userId = getCustomerUserId();
      if (!userId) {
        renderHomeEmpty();
        return;
      }
      if (insightsData && !force) {
        renderHome(insightsData);
        return;
      }
      if (insightsLoading) return;
      insightsLoading = true;
      renderHomeLoading();
      try {
        var res = await fetch(
          apiUrl("/api/orders/insights?userId=" + encodeURIComponent(userId)),
        );
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || "Nem sikerült a javaslatokat betölteni");
        if (!(data.topProducts && data.topProducts.length) && !(data.stats && data.stats.orderCountLoaded)) {
          renderHomeEmpty();
        } else {
          renderHome(data);
        }
      } catch (e) {
        homeGrid.innerHTML = "";
        homeGrid.appendChild(
          el("div", { className: "sr-qo-card" }, [
            el("h4", null, ["Most nem tudjuk betölteni"]),
            el("p", { className: "sub" }, [e.message || "Próbáld később."]),
            el(
              "button",
              {
                type: "button",
                className: "sr-qo-btn sr-qo-btn-ghost",
                onClick: function () {
                  loadHomeInsights(true);
                },
              },
              ["Újra"],
            ),
          ]),
        );
      } finally {
        insightsLoading = false;
      }
    }

    var listsRoot = el("div", { className: "sr-qo-lists" }, [
      el("div", { className: "sr-qo-lists-head" }, [
        el("h3", null, ["Listáim"]),
        el("p", null, [
          "A saját listák később jönnek. Addig: Kezdőlap javaslatok, vagy ismételd a rendelést.",
        ]),
      ]),
      el("div", { className: "sr-qo-lists-empty" }, [
        el("p", { className: "sr-qo-lists-empty-note" }, [
          "Addig a Kezdőlapon vagy a Rendeléseim fülön indíts új listát.",
        ]),
        el("div", { className: "sr-qo-home-actions" }, [
          el(
            "button",
            {
              type: "button",
              className: "sr-qo-btn sr-qo-btn-success",
              onClick: function () {
                setView("home");
                loadHomeInsights(true);
              },
            },
            ["Kezdőlapra"],
          ),
          el(
            "button",
            {
              type: "button",
              className: "sr-qo-btn sr-qo-btn-ghost",
              onClick: function () {
                setView("order");
                showOrderWorkOrStart();
              },
            },
            ["Új megrendelés"],
          ),
        ]),
      ]),
    ]);

    viewEls.home = el(
      "section",
      {
        className: "sr-qo-view",
        id: "sr-qo-view-home",
        role: "tabpanel",
        "aria-labelledby": "sr-qo-tab-home",
      },
      [homeRoot],
    );

    viewEls.order = el(
      "section",
      {
        className: "sr-qo-view is-active",
        id: "sr-qo-view-order",
        role: "tabpanel",
        "aria-labelledby": "sr-qo-tab-order",
      },
      [orderStack],
    );
    viewEls.orders = el(
      "section",
      {
        className: "sr-qo-view",
        id: "sr-qo-view-orders",
        role: "tabpanel",
        "aria-labelledby": "sr-qo-tab-orders",
      },
      [ordersRoot],
    );
    viewEls.lists = el(
      "section",
      {
        className: "sr-qo-view",
        id: "sr-qo-view-lists",
        role: "tabpanel",
        "aria-labelledby": "sr-qo-tab-lists",
      },
      [listsRoot],
    );

    var views = el("div", { className: "sr-qo-views" }, [
      viewEls.home,
      viewEls.order,
      viewEls.orders,
    ]);

    var shell = el(
      "div",
      {
        className: "sr-qo-shell",
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "sr-qo-dialog-title",
      },
      [topbar, views, turinovaCredit(), toastEl],
    );

    root.appendChild(el("div", { className: "sr-qo-backdrop", "aria-hidden": "true" }));
    root.appendChild(shell);
    root.appendChild(tip);
    document.addEventListener("keydown", onKeyDown, true);
    setView(activeView);
    renderList();
    if (lines.length) showOrderWork();
    else showOrderWorkOrStart();

    if (lines.length) {
      var idxs = [];
      for (var i = 0; i < lines.length; i++) idxs.push(i);
      setBusy(true);
      resolveIndices(idxs)
        .then(function () {
          setStatus("Mentett lista betöltve — árak és készlet frissítve.");
        })
        .catch(function (e) {
          setStatus(
            e.message || "Mentett lista betöltve (frissítés sikertelen).",
            true,
          );
        })
        .finally(function () {
          setBusy(false);
          skuInput.focus();
        });
    }
  }

  /** Lucide-style list icon (outline) — no emoji */

  function listIconSvg() {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    [
      ["line", { x1: "8", x2: "21", y1: "6", y2: "6" }],
      ["line", { x1: "8", x2: "21", y1: "12", y2: "12" }],
      ["line", { x1: "8", x2: "21", y1: "18", y2: "18" }],
      ["line", { x1: "3", x2: "3.01", y1: "6", y2: "6" }],
      ["line", { x1: "3", x2: "3.01", y1: "12", y2: "12" }],
      ["line", { x1: "3", x2: "3.01", y1: "18", y2: "18" }],
    ].forEach(function (pair) {
      const node = document.createElementNS(ns, pair[0]);
      Object.keys(pair[1]).forEach(function (k) {
        node.setAttribute(k, pair[1][k]);
      });
      svg.appendChild(node);
    });
    return svg;
  }

  function ensureFabStyles() {
    const existing = document.getElementById("sr-b2b-qo-fab-css-v7");
    if (existing) return;
    ["sr-b2b-qo-fab-css", "sr-b2b-qo-fab-css-v2", "sr-b2b-qo-fab-css-v3", "sr-b2b-qo-fab-css-v4", "sr-b2b-qo-fab-css-v5", "sr-b2b-qo-fab-css-v6"].forEach(function (id) {
      const legacy = document.getElementById(id);
      if (legacy) legacy.remove();
    });
    const style = document.createElement("style");
    style.id = "sr-b2b-qo-fab-css-v7";
    style.textContent = [
      "@keyframes sr-b2b-qo-fab-in{",
      "  from{ opacity:0; transform:translateY(10px) scale(0.98); }",
      "  to{ opacity:1; transform:translateY(0) scale(1); }",
      "}",
      "#sr-b2b-qo-btn{",
      "  position:fixed;",
      "  right:20px;",
      "  bottom:max(20px, env(safe-area-inset-bottom, 0px));",
      "  z-index:2147483000;",
      "  display:inline-flex;",
      "  align-items:center;",
      "  justify-content:center;",
      "  gap:8px;",
      "  min-height:48px;",
      "  min-width:48px;",
      "  padding:12px 18px;",
      "  border:0.5px solid rgba(255,255,255,0.28);",
      "  border-radius:999px;",
      "  background:rgba(26,25,23,0.82);",
      "  backdrop-filter:saturate(1.4) blur(16px);",
      "  -webkit-backdrop-filter:saturate(1.4) blur(16px);",
      "  color:#fff;",
      "  font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',system-ui,sans-serif;",
      "  font-size:14px;",
      "  font-weight:600;",
      "  line-height:1.2;",
      "  letter-spacing:-0.01em;",
      "  cursor:pointer;",
      "  box-shadow:0 10px 28px rgba(26,25,23,0.28), inset 0 1px 0 rgba(255,255,255,0.18);",
      "  touch-action:manipulation;",
      "  -webkit-tap-highlight-color:transparent;",
      "  overflow:hidden;",
      "  isolation:isolate;",
      "  transition:background-color 180ms ease, box-shadow 180ms ease, transform 180ms cubic-bezier(0.2,0.8,0.2,1);",
      "  animation:sr-b2b-qo-fab-in 240ms cubic-bezier(0.2,0.8,0.2,1) both;",
      "}",
      "#sr-b2b-qo-btn:hover{",
      "  box-shadow:0 14px 32px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.22);",
      "  filter:brightness(1.04);",
      "}",
      "#sr-b2b-qo-btn[data-pos^='bottom_right']{",
      "  right:20px;left:auto;top:auto;",
      "}",
      "#sr-b2b-qo-btn[data-pos^='bottom_left']{",
      "  left:20px;right:auto;top:auto;",
      "}",
      "#sr-b2b-qo-btn[data-pos='bottom_right'],#sr-b2b-qo-btn[data-pos='bottom_left']{",
      "  bottom:max(20px, env(safe-area-inset-bottom, 0px));",
      "}",
      "#sr-b2b-qo-btn[data-pos='bottom_right_mobile_offset'],#sr-b2b-qo-btn[data-pos='bottom_left_mobile_offset']{",
      "  bottom:max(80px, calc(20px + env(safe-area-inset-bottom, 0px)));",
      "}",
      "#sr-b2b-qo-btn[data-pos='bottom_right_raised']{",
      "  bottom:max(96px, calc(72px + env(safe-area-inset-bottom, 0px)));",
      "}",
      "#sr-b2b-qo-btn[data-pos='middle_left']{",
      "  left:20px;right:auto;top:auto;",
      "  bottom:max(20px, env(safe-area-inset-bottom, 0px));",
      "}",
      "#sr-b2b-qo-btn[data-pos='middle_right']{",
      "  right:20px;left:auto;top:auto;",
      "  bottom:max(20px, env(safe-area-inset-bottom, 0px));",
      "}",
      "@media (hover:hover) and (pointer:fine){",
      "  #sr-b2b-qo-btn[data-pos^='bottom']:hover{ transform:translateY(-1px); }",
      "}",
      "#sr-b2b-qo-btn[data-pos^='bottom']:active{ transform:scale(0.98); }",
      "#sr-b2b-qo-btn:focus{ outline:none; }",
      "#sr-b2b-qo-btn:focus-visible{",
      "  outline:2px solid #0F7B6C;",
      "  outline-offset:3px;",
      "}",
      "#sr-b2b-qo-btn .sr-b2b-qo-fab-icon{ display:flex;flex-shrink:0;position:relative;z-index:1; }",
      "#sr-b2b-qo-btn .sr-b2b-qo-fab-label{ white-space:nowrap;position:relative;z-index:1; }",
      "@media (max-width:767px){",
      "  #sr-b2b-qo-btn[data-pos='bottom_right'],#sr-b2b-qo-btn[data-pos='bottom_left']{",
      "    bottom:max(80px, calc(16px + env(safe-area-inset-bottom, 0px)));",
      "  }",
      "}",
      "@media (prefers-reduced-motion:reduce){",
      "  #sr-b2b-qo-btn{ animation:none; backdrop-filter:none; -webkit-backdrop-filter:none; }",
      "}",
      "#sr-b2b-qo-gate{",
      "  position:fixed;inset:0;z-index:2147483600;",
      "  font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',system-ui,sans-serif",
      "}",
      "#sr-b2b-qo-gate .sr-b2b-qo-gate-backdrop{",
      "  position:absolute;inset:0;background:rgba(26,25,23,.45)",
      "}",
      "#sr-b2b-qo-gate .sr-b2b-qo-gate-card{",
      "  position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);",
      "  width:min(420px, calc(100vw - 32px));background:#fff;color:#1A1917;",
      "  border:0.5px solid rgba(55,53,47,.22);padding:22px 22px 18px;",
      "  box-shadow:0 24px 60px rgba(26,25,23,.28)",
      "}",
      "#sr-b2b-qo-gate .sr-b2b-qo-gate-kicker{",
      "  margin:0 0 8px;font-size:11px;font-weight:650;letter-spacing:.04em;text-transform:uppercase;color:#6F6E69",
      "}",
      "#sr-b2b-qo-gate .sr-b2b-qo-gate-card h2{",
      "  margin:0;font-size:22px;font-weight:650;letter-spacing:-.03em;line-height:1.2",
      "}",
      "#sr-b2b-qo-gate .sr-b2b-qo-gate-body{",
      "  margin:10px 0 0;font-size:14px;line-height:1.5;color:#6F6E69",
      "}",
      "#sr-b2b-qo-gate .sr-b2b-qo-gate-actions{",
      "  display:flex;flex-wrap:wrap;gap:8px;margin-top:18px",
      "}",
      "#sr-b2b-qo-gate .sr-b2b-qo-gate-primary{",
      "  display:inline-flex;align-items:center;justify-content:center;height:40px;padding:0 16px;",
      "  background:#111;color:#fff;text-decoration:none;font-size:13px;font-weight:650",
      "}",
      "#sr-b2b-qo-gate .sr-b2b-qo-gate-ghost{",
      "  height:40px;padding:0 14px;border:0.5px solid rgba(55,53,47,.28);background:#fff;",
      "  color:#1A1917;font:inherit;font-size:13px;font-weight:600;cursor:pointer",
      "}",
      "#sr-b2b-qo-gate .sr-b2b-qo-gate-credit{",
      "  display:flex;align-items:center;justify-content:center;",
      "  margin-top:18px;padding-top:14px;border-top:0.5px solid rgba(55,53,47,.12);",
      "  text-decoration:none",
      "}",
      "#sr-b2b-qo-gate .sr-b2b-qo-gate-credit:hover img{opacity:1}",
      "#sr-b2b-qo-gate .sr-b2b-qo-gate-credit img{height:22px;width:auto;display:block;opacity:.94}",
    ].join("");
    document.head.appendChild(style);
  }

  function relativeLuminanceHex(hex) {
    var h = String(hex || "").replace("#", "");
    if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join("");
    if (h.length !== 6) return 0;
    function lin(c) {
      var s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }
    var r = lin(parseInt(h.slice(0, 2), 16));
    var g = lin(parseInt(h.slice(2, 4), 16));
    var b = lin(parseInt(h.slice(4, 6), 16));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrastRatioHex(a, b) {
    var L1 = relativeLuminanceHex(a);
    var L2 = relativeLuminanceHex(b);
    var hi = Math.max(L1, L2);
    var lo = Math.min(L1, L2);
    return (hi + 0.05) / (lo + 0.05);
  }

  function contrastingInk(bgHex) {
    var white = contrastRatioHex("#FFFFFF", bgHex);
    var dark = contrastRatioHex("#1C1C1E", bgHex);
    return dark >= white ? "#1C1C1E" : "#FFFFFF";
  }

  function resolveFabInk(mode, bgHex) {
    if (mode === "white") return "#FFFFFF";
    if (mode === "black") return "#1C1C1E";
    return contrastingInk(bgHex);
  }

  function applyFabAppearance(btn) {
    var color = cfg.fabColor || "#007AFF";
    var style = cfg.fabStyle || "solid";
    var inkMode = cfg.fabInk || "auto";
    var position = cfg.fabPosition || "bottom_right";
    if (position === "middle_left") position = "bottom_right";
    if (position === "middle_right") position = "bottom_right";
    btn.setAttribute("data-pos", position);

    // Clear conflicting inline position (CSS data-pos handles placement)
    btn.style.left = "";
    btn.style.right = "";
    btn.style.top = "";
    btn.style.bottom = "";
    btn.style.transform = "";
    btn.style.marginTop = "";

    if (cfg.compact) {
      btn.style.minHeight = "40px";
      btn.style.padding = cfg.showLabel === false ? "0" : "8px 12px";
      btn.style.fontSize = "12px";
    }
    if (cfg.fabSize === "large") {
      btn.style.minHeight = "52px";
      btn.style.padding = "14px 20px";
    }
    if (cfg.showLabel === false) {
      btn.style.minWidth = "48px";
      btn.style.padding = "0";
      var lab = btn.querySelector(".sr-b2b-qo-fab-label");
      if (lab) lab.style.display = "none";
    }
    if (cfg.fabSize === "label_only") {
      var ic = btn.querySelector(".sr-b2b-qo-fab-icon");
      if (ic) ic.style.display = "none";
      btn.style.minWidth = "auto";
      btn.style.padding = cfg.compact ? "8px 12px" : "12px 18px";
    }

    var ink = resolveFabInk(inkMode, color);
    if (style === "neon") {
      btn.style.background = "#0A0A0C";
      btn.style.color = "#FFFFFF";
      btn.style.borderColor = hexToRgba(color, 0.9);
      btn.style.borderWidth = "1px";
      btn.style.borderStyle = "solid";
      btn.style.backdropFilter = "none";
      btn.style.webkitBackdropFilter = "none";
      btn.style.boxShadow =
        "0 0 6px " +
        hexToRgba(color, 0.95) +
        ", 0 0 18px " +
        hexToRgba(color, 0.55) +
        ", 0 0 36px " +
        hexToRgba(color, 0.28) +
        ", inset 0 0 14px " +
        hexToRgba(color, 0.18);
    } else if (style === "glass") {
      btn.style.background =
        "linear-gradient(155deg, " +
        hexToRgba("#FFFFFF", 0.48) +
        " 0%, " +
        hexToRgba(color, 0.38) +
        " 42%, " +
        hexToRgba(color, 0.72) +
        " 100%)";
      btn.style.color = ink;
      btn.style.borderColor = hexToRgba("#FFFFFF", 0.55);
      btn.style.borderWidth = "1px";
      btn.style.borderStyle = "solid";
      btn.style.backdropFilter = "saturate(180%) blur(18px)";
      btn.style.webkitBackdropFilter = "saturate(180%) blur(18px)";
      btn.style.boxShadow =
        "0 10px 28px " +
        hexToRgba(color, 0.32) +
        ", 0 2px 8px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 0 " +
        hexToRgba(color, 0.22);
    } else if (style === "outline") {
      btn.style.background = "#FFFFFF";
      btn.style.color = color;
      btn.style.borderColor = color;
      btn.style.borderWidth = "1.5px";
      btn.style.backdropFilter = "none";
      btn.style.webkitBackdropFilter = "none";
      btn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
    } else if (style === "soft") {
      btn.style.background = hexToRgba(color, 0.12);
      btn.style.color = color;
      btn.style.borderColor = hexToRgba(color, 0.28);
      btn.style.backdropFilter = "none";
      btn.style.webkitBackdropFilter = "none";
      btn.style.boxShadow = "none";
    } else if (style === "contrast") {
      btn.style.background = "#0A0A0C";
      btn.style.color = "#FFFFFF";
      btn.style.borderColor = hexToRgba(color, 0.9);
      btn.style.backdropFilter = "none";
      btn.style.webkitBackdropFilter = "none";
      btn.style.boxShadow =
        "0 0 6px " +
        hexToRgba(color, 0.95) +
        ", 0 0 18px " +
        hexToRgba(color, 0.55);
    } else {
      /* solid — slight sheen */
      btn.style.background =
        "linear-gradient(180deg, " +
        hexToRgba("#FFFFFF", 0.18) +
        " 0%, transparent 42%), " +
        color;
      btn.style.color = ink;
      btn.style.borderColor = hexToRgba("#000000", 0.12);
      btn.style.borderWidth = "0.5px";
      btn.style.borderStyle = "solid";
      btn.style.backdropFilter = "none";
      btn.style.webkitBackdropFilter = "none";
      btn.style.boxShadow =
        "0 8px 20px " +
        hexToRgba(color, 0.35) +
        ", 0 2px 6px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.28)";
    }
  }

  function injectButton() {
    if (cfg.enabled === false) {
      var off = document.getElementById("sr-b2b-qo-btn");
      if (off && off.parentNode) off.parentNode.removeChild(off);
      return;
    }
    if (isLoggedIn() && !groupAllowed()) {
      var denied = document.getElementById("sr-b2b-qo-btn");
      if (denied && denied.parentNode) denied.parentNode.removeChild(denied);
      return;
    }
    if (document.getElementById("sr-b2b-qo-btn")) return;

    ensureFabStyles();

    const label = cfg.buttonLabel || "Gyors rendelés";
    const iconWrap = el("span", { className: "sr-b2b-qo-fab-icon" });
    iconWrap.appendChild(listIconSvg());

    const labelEl = el("span", { className: "sr-b2b-qo-fab-label" }, [label]);

    const children = [];
    if (cfg.fabSize !== "label_only") children.push(iconWrap);
    if (cfg.showLabel !== false) children.push(labelEl);
    if (!children.length) children.push(labelEl);

    const btn = el(
      "button",
      {
        id: "sr-b2b-qo-btn",
        type: "button",
        "aria-label": label + " — cikkszámra, partneráron",
        title: label,
        onClick: tryOpenPanel,
      },
      children,
    );

    applyFabAppearance(btn);
    document.body.appendChild(btn);
  }

  function boot() {
    loadRemoteConfig().then(function () {
      injectButton();
      // ShopRenter customer object sometimes arrives late
      setTimeout(injectButton, 800);
      setTimeout(injectButton, 2000);
      if (location.hash === "#sr-b2b-qo") {
        setTimeout(tryOpenPanel, 300);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Re-check after login event if available
  try {
    if (window.ShopRenter && ShopRenter.onCustomerLoggedIn) {
      ShopRenter.onCustomerLoggedIn(function () {
        injectButton();
      });
    }
  } catch (_) {}
})();
