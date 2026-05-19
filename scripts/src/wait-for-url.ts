#!/usr/bin/env node

type Args = {
  url: string;
  method: "GET" | "HEAD";
  timeoutMs: number;
  intervalMs: number;
  label: string;
};

function readArgs(): Args {
  const args = new Map<string, string>();
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i];
    const value = process.argv[i + 1];
    if (!key?.startsWith("--") || value === undefined) continue;
    args.set(key.slice(2), value);
  }

  const url = args.get("url");
  if (!url) {
    console.error("Usage: wait-for-url --url <url> [--method GET|HEAD] [--timeout-ms 120000] [--interval-ms 2000]");
    process.exit(2);
  }

  const method = (args.get("method") ?? "GET").toUpperCase();
  return {
    url,
    method: method === "HEAD" ? "HEAD" : "GET",
    timeoutMs: Number(args.get("timeout-ms") ?? 120_000),
    intervalMs: Number(args.get("interval-ms") ?? 2_000),
    label: args.get("label") ?? url,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = readArgs();
  const deadline = Date.now() + args.timeoutMs;
  let attempt = 0;
  let lastError = "";

  while (Date.now() < deadline) {
    attempt += 1;
    try {
      const res = await fetch(args.url, {
        method: args.method,
        redirect: "manual",
        signal: AbortSignal.timeout(Math.min(args.intervalMs, 10_000)),
      });
      if (res.status >= 200 && res.status < 400) {
        console.log(`[ready] ${args.label} responded ${res.status} after ${attempt} attempt(s)`);
        return;
      }
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    console.log(`[wait] ${args.label} not ready (${lastError}); retrying...`);
    await sleep(args.intervalMs);
  }

  console.error(`[timeout] ${args.label} did not become ready within ${args.timeoutMs}ms. Last error: ${lastError}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
