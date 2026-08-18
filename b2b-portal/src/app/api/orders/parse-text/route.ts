import { parseOrderText } from "@/lib/parse-order";
import { jsonWithCors, optionsCors } from "@/lib/cors";

export async function OPTIONS(request: Request) {
  return optionsCors(request);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: string };
    const text = typeof body.text === "string" ? body.text : "";
    if (!text.trim()) {
      return jsonWithCors(
        request,
        { error: "text required" },
        { status: 400 },
      );
    }
    const result = await parseOrderText(text);
    return jsonWithCors(request, result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "parse-text failed";
    const status = /ANTHROPIC_API_KEY/i.test(msg) ? 503 : 500;
    return jsonWithCors(request, { error: msg }, { status });
  }
}
