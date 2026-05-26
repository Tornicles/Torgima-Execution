/** Map BHUDHI:// URI actions to kernel event-bus event types. */
export function uriToEventType(uri: string): string | null {
  const match = uri.match(/^bhudhi:\/\/([^/]+)\/([^?]+)/);
  if (!match) return null;

  const [, system, action] = match;
  const actionNorm = action.replace(/-/g, ".");

  if (system === "kernel" && actionNorm === "cycle") return "kernel.cycle";
  if (system === "investigation" && actionNorm === "complete") return "investigation.complete";
  if (system === "investigation" && actionNorm === "start") return "investigation.start";
  if (system === "intelligence" && actionNorm === "recommend") return "intelligence.complete";
  if (system === "intelligence" && actionNorm === "start") return "intelligence.start";
  if (system === "security" && actionNorm === "validate") return "security.validate";
  if (system === "security" && actionNorm === "approved") return "security.approved";
  if (system === "operating" && actionNorm === "execute") return "operating.execute";
  if (system === "operating" && actionNorm === "complete") return "operating.complete";
  if (system === "preservation" && actionNorm === "learn") return "preservation.learn";
  if (system === "preservation" && actionNorm === "complete") return "preservation.complete";

  return `${system}.${actionNorm}`;
}
