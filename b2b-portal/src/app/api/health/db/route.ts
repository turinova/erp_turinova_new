import { NextResponse } from "next/server";
import { pingDatabase } from "@/lib/db";

/**
 * GET /api/health/db — verifies DATABASE_URL after manual SQL migrations.
 * Does not expose secrets.
 */
export async function GET() {
  try {
    const result = await pingDatabase();
    return NextResponse.json({
      ok: true,
      database: true,
      now: result.now,
      hint: "Run select * from schema_migrations order by filename;",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "db error";
    return NextResponse.json(
      { ok: false, database: false, error: message },
      { status: 503 },
    );
  }
}
