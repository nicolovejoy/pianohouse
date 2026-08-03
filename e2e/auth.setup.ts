import { test as setup } from "@playwright/test";
import { mintSession, STORAGE_STATE } from "./auth";

// Runs once, before every other project, with the webServer already up — so
// migrate + seed have both run and the seed user exists.
setup("mint a signed-in session", async ({ context }) => {
  await mintSession(context);
  await context.storageState({ path: STORAGE_STATE });
});
