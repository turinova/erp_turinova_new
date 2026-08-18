import Anthropic from "@anthropic-ai/sdk";

export type ExtractedOrderLine = {
  rawText: string;
  codeHint: string | null;
  quantity: number;
  quantityUncertain: boolean;
  confidence: number;
  notes: string | null;
};

export type ParseOrderResult = {
  documentKind:
    | "handwritten_list"
    | "printed_po"
    | "email"
    | "spreadsheet_like"
    | "mixed"
    | "unknown";
  lines: ExtractedOrderLine[];
  warnings: string[];
  model: string;
};

const TEXT_MODEL =
  process.env.ANTHROPIC_TEXT_MODEL?.trim() || "claude-haiku-4-5-20251001";
const VISION_MODEL =
  process.env.ANTHROPIC_VISION_MODEL?.trim() || "claude-sonnet-4-6";

function getClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY nincs beállítva. Add hozzá a .env.local fájlhoz.",
    );
  }
  return new Anthropic({ apiKey: key });
}

const EXTRACT_TOOL: Anthropic.Messages.Tool = {
  name: "extract_order_lines",
  description:
    "Extract purchase/order line items (product codes and quantities) from the source.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      documentKind: {
        type: "string",
        enum: [
          "handwritten_list",
          "printed_po",
          "email",
          "spreadsheet_like",
          "mixed",
          "unknown",
        ],
      },
      warnings: {
        type: "array",
        items: {
          type: "string",
          description: "Rövid magyar figyelmeztetés a felhasználónak",
        },
      },
      lines: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            rawText: {
              type: "string",
              description: "Verbatim line text as seen in the source",
            },
            codeHint: {
              type: ["string", "null"],
              description:
                "Best guess for SKU / factory model / GTIN / barcode. Null if unreadable.",
            },
            quantity: {
              type: "number",
              description: "Quantity; default 1 if missing",
            },
            quantityUncertain: { type: "boolean" },
            confidence: {
              type: "number",
              description: "0 to 1 self-assessed confidence for this line",
            },
            notes: {
              type: ["string", "null"],
              description:
                "Rövid magyar megjegyzés (max ~100 karakter), pl. bizonytalan számjegy. Angol tilos.",
            },
          },
          required: [
            "rawText",
            "codeHint",
            "quantity",
            "quantityUncertain",
            "confidence",
            "notes",
          ],
        },
      },
    },
    required: ["documentKind", "warnings", "lines"],
  },
};

const SYSTEM_PROMPT = `You extract B2B wholesale order lines for a Hungarian hardware/distributor shop.
Return ONLY via the extract_order_lines tool.

Language (STRICT):
- warnings[] and notes MUST be written in Hungarian only. Never English.
- Keep them short (one sentence, ≤100 characters). No long OCR essays.
- rawText may keep the verbatim characters from the source.

Rules:
- Each line should be one product code + quantity.
- codeHint = SKU, factory/model number, EAN/GTIN, or barcode digits as written. Do NOT invent catalog matches.
- Prefer alphanumeric product codes (e.g. SS11, VAS-F014891, F014891, 491377, 4048962480849).
- Quantity: parse 2, 2db, 2 db, x2, ×2, 2x → number. If missing, quantity=1 and quantityUncertain=true.
- Ignore greetings, signatures, addresses, payment chatter, struck-through / crossed-out items.
- For HANDWRITTEN lists: be conservative. Lower confidence when digits are ambiguous (O/0, I/1, S/5). Put uncertain OCR in rawText; best guess in codeHint.
- confidence: 0.9+ clear printed; 0.6–0.85 readable handwriting; <0.6 guessy.
- Max 200 lines.`;

function normalizeResult(
  input: Record<string, unknown>,
  model: string,
): ParseOrderResult {
  const kindRaw = String(input.documentKind || "unknown");
  const allowed = new Set([
    "handwritten_list",
    "printed_po",
    "email",
    "spreadsheet_like",
    "mixed",
    "unknown",
  ]);
  const documentKind = (
    allowed.has(kindRaw) ? kindRaw : "unknown"
  ) as ParseOrderResult["documentKind"];

  const warnings = Array.isArray(input.warnings)
    ? input.warnings
        .filter((w): w is string => typeof w === "string")
        .map((w) => w.trim().slice(0, 160))
        .filter(Boolean)
        .slice(0, 8)
    : [];

  const rawLines = Array.isArray(input.lines) ? input.lines : [];
  const lines: ExtractedOrderLine[] = [];
  for (const row of rawLines.slice(0, 200)) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const rawText = typeof r.rawText === "string" ? r.rawText.trim() : "";
    let codeHint =
      typeof r.codeHint === "string" && r.codeHint.trim()
        ? r.codeHint.trim()
        : null;
    if (codeHint === "") codeHint = null;
    let quantity = Number(r.quantity);
    if (!Number.isFinite(quantity) || quantity < 1) quantity = 1;
    quantity = Math.min(99999, Math.round(quantity));
    let confidence = Number(r.confidence);
    if (!Number.isFinite(confidence)) confidence = 0.5;
    confidence = Math.max(0, Math.min(1, confidence));
    const quantityUncertain = Boolean(r.quantityUncertain);
    let notes =
      typeof r.notes === "string" && r.notes.trim() ? r.notes.trim() : null;
    if (notes) notes = notes.slice(0, 120);
    if (!rawText && !codeHint) continue;
    lines.push({
      rawText: rawText || codeHint || "",
      codeHint,
      quantity,
      quantityUncertain,
      confidence,
      notes,
    });
  }

  return { documentKind, lines, warnings, model };
}

function toolInputFromMessage(
  message: Anthropic.Messages.Message,
): Record<string, unknown> {
  for (const block of message.content) {
    if (block.type === "tool_use" && block.name === "extract_order_lines") {
      return (block.input || {}) as Record<string, unknown>;
    }
  }
  throw new Error("A modell nem adott strukturált rendelés-kimenetet");
}

/** Fast path: plain sku,qty lines without LLM */
export function heuristicParseText(text: string): ExtractedOrderLine[] {
  const lines: ExtractedOrderLine[] = [];
  const seen = new Set<string>();
  text.split(/\r?\n/).forEach((row) => {
    const t = row.trim();
    if (!t || t.length > 200) return;
    if (/^(sku|ean|cikk|darab|qty|quantity)\b/i.test(t)) return;
    // sku,qty or sku;qty or sku\tqty or sku — qty
    let m = t.match(
      /^([A-Za-z0-9][A-Za-z0-9._\-/]{1,40})\s*[,;\t]\s*(\d+)\s*(?:db|db\.|pcs)?\s*$/i,
    );
    if (!m) {
      m = t.match(
        /^([A-Za-z0-9][A-Za-z0-9._\-/]{1,40})\s*[—–\-]\s*(\d+)\s*(?:db|db\.|pcs)?\s*$/i,
      );
    }
    if (!m) {
      // CODE 2db / CODE x2 / CODE × 2
      m = t.match(
        /^([A-Za-z0-9][A-Za-z0-9._\-/]{1,40})\s+(?:x|×)?\s*(\d+)\s*(?:db|db\.|pcs)?\s*$/i,
      );
    }
    if (!m) {
      // only code
      m = t.match(/^([A-Za-z0-9][A-Za-z0-9._\-/]{2,40})$/);
      if (m) {
        const code = m[1];
        const key = code.toUpperCase();
        if (seen.has(key)) return;
        seen.add(key);
        lines.push({
          rawText: t,
          codeHint: code,
          quantity: 1,
          quantityUncertain: true,
          confidence: 0.7,
          notes: null,
        });
      }
      return;
    }
    const code = m[1];
    const qty = Math.max(1, parseInt(m[2], 10) || 1);
    const key = code.toUpperCase() + "::" + qty;
    if (seen.has(key)) return;
    seen.add(key);
    lines.push({
      rawText: t,
      codeHint: code,
      quantity: qty,
      quantityUncertain: false,
      confidence: 0.85,
      notes: null,
    });
  });
  return lines.slice(0, 200);
}

export async function parseOrderText(text: string): Promise<ParseOrderResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      documentKind: "unknown",
      lines: [],
      warnings: ["Üres szöveg"],
      model: "none",
    };
  }
  if (trimmed.length > 100_000) {
    throw new Error("A szöveg túl hosszú (max ~100k karakter)");
  }

  const heuristic = heuristicParseText(trimmed);
  // Enough clean rows → skip LLM (cost)
  if (heuristic.length >= 3) {
    return {
      documentKind: "spreadsheet_like",
      lines: heuristic,
      warnings: [],
      model: "heuristic",
    };
  }

  const client = getClient();
  const message = await client.messages.create({
    model: TEXT_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "tool", name: "extract_order_lines" },
    messages: [
      {
        role: "user",
        content: `Olvasd ki a rendelési sorokat ebből az emailből / üzenetből / beillesztett szövegből. warnings és notes rövid magyarul.\n\n---\n${trimmed.slice(0, 80000)}\n---`,
      },
    ],
  });

  const result = normalizeResult(toolInputFromMessage(message), TEXT_MODEL);
  if (!result.lines.length && heuristic.length) {
    return {
      documentKind: "email",
      lines: heuristic,
      warnings: ["LLM üres; heurisztikus sorok"],
      model: TEXT_MODEL + "+heuristic",
    };
  }
  return result;
}

export async function parseOrderImage(params: {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
}): Promise<ParseOrderResult> {
  if (!params.base64 || params.base64.length < 32) {
    throw new Error("Érvénytelen kép");
  }
  // ~10MB base64 ceiling
  if (params.base64.length > 14_000_000) {
    throw new Error("A kép túl nagy (max ~10 MB)");
  }

  const client = getClient();
  const message = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "tool", name: "extract_order_lines" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: params.mediaType,
              data: params.base64,
            },
          },
          {
            type: "text",
            text:
              "Olvasd ki a rendelési sorokat erről a fotóról/szkennelt listáról. " +
              "Lehet KÉZÍRÁSOS (magyar nagykereskedelmi lista). " +
              "warnings és notes kizárólag rövid magyar szöveg. " +
              "Kézírásnál konzervatív confidence. Áthúzott sorokat hagyd ki.",
          },
        ],
      },
    ],
  });

  return normalizeResult(toolInputFromMessage(message), VISION_MODEL);
}

export function detectImageMediaType(
  mime: string | null | undefined,
  filename?: string,
): "image/jpeg" | "image/png" | "image/webp" | "image/gif" {
  const m = (mime || "").toLowerCase();
  if (m === "image/png" || m === "image/webp" || m === "image/gif" || m === "image/jpeg") {
    return m;
  }
  const name = (filename || "").toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}
