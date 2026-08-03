// Counts RSC round-trips per client navigation — the binary signal issue #19 is
// actually about. A dynamic route gets 0s of client router cache, so every nav
// (including back to a page you just left) refetches the full RSC payload. A
// static/PPR shell should serve a repeat navigation from cache, with no
// blocking fetch at all.
//
// Blocking fetches are what the user waits on; prefetches are speculative and
// counted separately (both use ?_rsc=, distinguished by Next-Router-Prefetch).
//
// Usage: build, start the server, then run this against it.
//   npx next build
//   TURSO_DATABASE_URL="file:.playwright/e2e.db" npx next start --port 3199
//   node scripts/nav-cost.mjs
import { chromium } from "@playwright/test";

const BASE = process.env.NAV_COST_BASE ?? "http://localhost:3199";

const browser = await chromium.launch();
const page = await browser.newPage();

let blocking = [];
let prefetch = [];
page.on("request", (r) => {
  if (!r.url().includes("_rsc=")) return;
  const path = r.url().replace(BASE, "").split("?")[0] || "/";
  if (r.headers()["next-router-prefetch"] === "1") prefetch.push(path);
  else blocking.push(path);
});

async function leg(label, fn, expect) {
  blocking = [];
  prefetch = [];
  await fn();
  await page.waitForURL(expect, { timeout: 15_000 });
  await page.waitForLoadState("networkidle");
  const extra = prefetch.length ? `  (+${prefetch.length} prefetch)` : "";
  const detail = blocking.length ? ` → ${blocking.join(", ")}` : "";
  console.log(`${label.padEnd(26)} ${blocking.length} blocking${extra}${detail}`);
}

const music = () => page.getByRole("link", { name: "Music — view all" }).click();
const about = () => page.locator("header").getByRole("link", { name: "about" }).click();
const home = () => page.locator("header").getByRole("link", { name: /piano house/ }).click();

await page.goto(BASE, { waitUntil: "networkidle" });

await leg("home → /music", music, "**/music");
await leg("/music → home (back)", () => page.goBack(), BASE + "/");
await leg("home → /music (repeat)", music, "**/music");
await leg("/music → home (back again)", () => page.goBack(), BASE + "/");
await leg("home → /about", about, "**/about");
await leg("/about → home", home, BASE + "/");

await browser.close();
