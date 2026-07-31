import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/health — unauthenticated monitor target (UptimeRobot, prompt-lab's
// daily health email). Shallow by default: 200 {"ok":true}, no dependencies
// touched, safe to poll every 5 minutes.
//
// GET /api/health?db=1 — deep variant. Asserts Turso is reachable; 503 if not.
// Turso is the only hard dependency: sessions, follows, and the connect form
// all fail without it. Deliberately NOT checked: prompt-lab's
// /api/public_history (soft — cached 1h, degrades to empty in lib/history.ts,
// and polling someone else's API every 5 minutes is cost plus coupling),
// Resend (send-only, no read probe without a side effect).

export const dynamic = "force-dynamic";

type Check = { name: string; ok: boolean; ms: number; error?: string };

export async function GET(req: NextRequest) {
  const deep = req.nextUrl.searchParams.get("db") === "1";
  const headers = { "Cache-Control": "no-store" };

  if (!deep) {
    return NextResponse.json({ ok: true }, { headers });
  }

  const checks: Check[] = [];
  const start = Date.now();
  try {
    await db().execute("SELECT 1");
    checks.push({ name: "turso", ok: true, ms: Date.now() - start });
  } catch (err) {
    checks.push({
      name: "turso",
      ok: false,
      ms: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const ok = checks.every((c) => c.ok);
  return NextResponse.json(
    { ok, checks, timestamp: new Date().toISOString() },
    { status: ok ? 200 : 503, headers }
  );
}
