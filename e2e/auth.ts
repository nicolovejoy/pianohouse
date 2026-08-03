import crypto from "node:crypto";
import { createClient } from "@libsql/client";
import type { BrowserContext } from "@playwright/test";

// Same disposable DB the webServer runs against (playwright.config.ts).
const E2E_DB = "file:.playwright/e2e.db";
const SESSION_COOKIE = "ph_session";

/** Seeded by scripts/seed-dev.mjs, which also clears this user's sessions per run. */
export const SEED_USER = { id: "seed-user-dev", email: "dev@localhost", name: "Dev User" };

/** Written by the `setup` project, consumed via test.use({ storageState }). */
export const STORAGE_STATE = ".playwright/signed-in.json";

/**
 * Mint a session the way lib/auth.ts does — the cookie carries a raw token and
 * only its sha256 is stored — and hand it to the browser. Going through the real
 * magic-link flow would mean intercepting an email; writing the row directly
 * still exercises the same read path getSessionUser() takes.
 *
 * Called once, from the serial `setup` project. Doing this per-test raced the
 * running server for the SQLite write lock and failed with SQLITE_BUSY.
 */
export async function mintSession(context: BrowserContext, user = SEED_USER): Promise<void> {
  const token = crypto.randomBytes(32).toString("base64url");
  const id = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const db = createClient({ url: E2E_DB });
  try {
    await db.execute({
      sql: `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`,
      args: [id, user.id, expiresAt],
    });
  } finally {
    db.close();
  }

  await context.addCookies([
    { name: SESSION_COOKIE, value: token, domain: "localhost", path: "/" },
  ]);
}
