/**
 * CLI for event loop verify / bounded drain.
 * Usage: pnpm -F @workspace/api-server exec tsx src/scripts/events-cli.ts verify|drain-once
 */

import { drainEventsOnce, getEventLoopSnapshot } from "../services/EventLoopProcessor.js";

const command = process.argv[2] ?? "verify";

async function verify(): Promise<void> {
  const snapshot = await getEventLoopSnapshot();
  console.log(JSON.stringify(snapshot, null, 2));
  const unhealthy =
    snapshot.unresolved_dead_letters > 0 || snapshot.unhandled_event_types.length > 0;
  if (unhealthy) process.exit(1);
}

async function drainOnce(): Promise<void> {
  const result = await drainEventsOnce({ batchSize: 5, maxBatches: 1, maxRuntimeMs: 10_000 });
  console.log(JSON.stringify(result, null, 2));
}

async function main(): Promise<void> {
  if (command === "verify") {
    await verify();
    return;
  }
  if (command === "drain-once") {
    await drainOnce();
    return;
  }
  console.error(`Unknown command: ${command}. Use verify or drain-once.`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
