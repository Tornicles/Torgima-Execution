import { setupE2eEnvironment } from "@workspace/test/setup/e2e";

let ready = false;

export async function ensureDoc36E2eReady(): Promise<void> {
  if (ready) return;
  await setupE2eEnvironment();
  ready = true;
}
