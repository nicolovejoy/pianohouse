import crypto from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const SESSION_COOKIE = "ph_session";
const MAGIC_TTL_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function randomToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function isoIn(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

export type SessionUser = { id: string; email: string; name: string | null };

/** Site admin (moderation rights) = the signed-in user matching ADMIN_EMAIL. */
export function isAdmin(user: SessionUser | null): boolean {
  const admin = process.env.ADMIN_EMAIL?.toLowerCase();
  return !!user && !!admin && user.email.toLowerCase() === admin;
}

// ---- magic tokens (raw token emailed; only its hash is stored) ----

export async function createMagicToken(email: string, ip: string | null): Promise<string> {
  const token = randomToken();
  await db().execute({
    sql: `INSERT INTO magic_tokens (token_hash, email, expires_at, ip) VALUES (?, ?, ?, ?)`,
    args: [sha256(token), email.toLowerCase(), isoIn(MAGIC_TTL_MS), ip],
  });
  return token;
}

/** Tokens minted in the last 15 minutes, for rate limiting sign-in requests. */
export async function countRecentMagicTokens(
  email: string,
  ip: string | null,
): Promise<{ byEmail: number; byIp: number }> {
  const res = await db().execute({
    sql: `SELECT COALESCE(SUM(email = ?), 0) AS by_email,
                 COALESCE(SUM(ip = ?), 0) AS by_ip
            FROM magic_tokens
           WHERE created_at > datetime('now', '-15 minutes')`,
    args: [email.toLowerCase(), ip ?? ""],
  });
  const row = res.rows[0];
  return { byEmail: Number(row?.by_email ?? 0), byIp: Number(row?.by_ip ?? 0) };
}

/** Single-use: the token is deleted on lookup regardless of validity. */
export async function consumeMagicToken(token: string): Promise<string | null> {
  const hash = sha256(token);
  const res = await db().execute({
    sql: `SELECT email, expires_at FROM magic_tokens WHERE token_hash = ?`,
    args: [hash],
  });
  await db().execute({ sql: `DELETE FROM magic_tokens WHERE token_hash = ?`, args: [hash] });
  const row = res.rows[0];
  if (!row) return null;
  if (new Date(String(row.expires_at)).getTime() < Date.now()) return null;
  return String(row.email);
}

// ---- users ----

export async function findOrCreateUser(email: string): Promise<string> {
  const e = email.toLowerCase();
  const found = await db().execute({ sql: `SELECT id FROM users WHERE email = ?`, args: [e] });
  if (found.rows[0]) return String(found.rows[0].id);
  const id = crypto.randomUUID();
  await db().execute({ sql: `INSERT INTO users (id, email) VALUES (?, ?)`, args: [id, e] });
  return id;
}

// ---- sessions (opaque token in an httpOnly cookie; only its hash is stored) ----

export async function createSession(userId: string): Promise<void> {
  const token = randomToken();
  await db().execute({
    sql: `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`,
    args: [sha256(token), userId, isoIn(SESSION_TTL_MS)],
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

/**
 * Memoized per request: nav and the page body both resolve the session, and
 * the cookie holds an opaque token, so every call is a remote Turso round-trip.
 * Without this, a signed-in render of /projects/[slug] pays for two.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null; // anonymous visitors never hit the DB
  try {
    const res = await db().execute({
      sql: `SELECT u.id, u.email, u.name, s.expires_at
              FROM sessions s JOIN users u ON u.id = s.user_id
             WHERE s.id = ?`,
      args: [sha256(token)],
    });
    const row = res.rows[0];
    if (!row) return null;
    if (new Date(String(row.expires_at)).getTime() < Date.now()) return null;
    return {
      id: String(row.id),
      email: String(row.email),
      name: row.name ? String(row.name) : null,
    };
  } catch (err) {
    console.error("[auth] session lookup failed", err);
    return null; // misconfigured DB → treat as logged out, don't crash the page
  }
});

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await db().execute({ sql: `DELETE FROM sessions WHERE id = ?`, args: [sha256(token)] });
    } catch (err) {
      console.error("[auth] session delete failed", err);
    }
  }
  jar.delete(SESSION_COOKIE);
}
