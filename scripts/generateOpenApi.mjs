/**
 * GAP G7 — sync OpenAPI from live Express routes (LAW 1).
 * Scans route files, validates critical paths exist in openapi.yaml, copies spec to dist/.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const routesDir = path.join(root, "artifacts", "api-server", "src", "routes");
const specPath = path.join(root, "lib", "api-spec", "openapi.yaml");
const distDir = path.join(root, "lib", "api-spec", "dist");
const manifestPath = path.join(root, "lib", "api-spec", "routes.manifest.json");

const CRITICAL_PATHS = [
  "/onboarding/goal",
  "/onboarding/complete",
  "/blueprints/{id}/activate",
  "/orders/{id}/feedback",
  "/execution/active-order",
  "/execution/feedback",
  "/execution/next-task",
  "/state/dashboard",
  "/feedback/{id}/interrogation",
  "/auth/session",
  "/auth/send-magic-link",
  "/condition/current",
  "/signals/current",
  "/blueprints/select-tier",
  "/blueprints/{id}/tier-preview",
  "/validation/complete",
];

function scanRoutes() {
  const routes = [];
  const routeRe = /router\.(get|post|patch|put|delete)\(\s*["'`]([^"'`]+)["'`]/g;
  for (const file of fs.readdirSync(routesDir)) {
    if (!file.endsWith(".ts")) continue;
    const content = fs.readFileSync(path.join(routesDir, file), "utf8");
    let m;
    while ((m = routeRe.exec(content)) !== null) {
      routes.push({ method: m[1].toUpperCase(), path: m[2], file });
    }
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path));
}

function extractOpenApiPaths(yaml) {
  const paths = new Set();
  for (const line of yaml.split("\n")) {
    const m = line.match(/^  (\/[\w\-/{}]+):\s*$/);
    if (m) paths.add(m[1]);
  }
  return paths;
}

function normalizeExpressPath(p) {
  return p.replace(/:([a-zA-Z_]+)/g, "{$1}");
}

function toOperationId(method, expressPath) {
  const parts = expressPath
    .replace(/^\//, "")
    .split("/")
    .flatMap((seg) => (seg.startsWith(":") ? ["By", seg.slice(1)] : [seg]))
    .filter(Boolean);
  const camel =
    method.toLowerCase() +
    parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
  return camel.replace(/[^a-zA-Z0-9]/g, "") || "apiOperation";
}

function stubPathBlock(method, expressPath) {
  const openApiPath = normalizeExpressPath(expressPath);
  const opId = toOperationId(method, openApiPath);
  const tag = openApiPath.split("/").filter(Boolean)[0] ?? "api";
  return `  ${openApiPath}:
    ${method.toLowerCase()}:
      operationId: ${opId}
      tags: [${tag}]
      summary: Auto-synced from Express route
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ApiSuccessEnvelope"
`;
}

function mergeUndocumentedRoutes(yaml, undocumented) {
  if (undocumented.length === 0) return yaml;
  const marker = "\ncomponents:\n";
  const idx = yaml.indexOf(marker);
  if (idx < 0) return yaml;
  const stubs = undocumented.map((p) => {
    const method = p.method.toLowerCase();
    return stubPathBlock(method, p.path);
  });
  return `${yaml.slice(0, idx)}\n${stubs.join("\n")}${marker}${yaml.slice(idx + marker.length)}`;
}

function main() {
  const liveRoutes = scanRoutes();
  let yaml = fs.readFileSync(specPath, "utf8");
  const openApiPaths = extractOpenApiPaths(yaml);

  const undocumented = liveRoutes
    .map((r) => ({ method: r.method, path: normalizeExpressPath(r.path) }))
    .filter(
      (r) =>
        !openApiPaths.has(r.path) &&
        !yaml.includes(`\n  ${r.path}:\n`) &&
        !yaml.includes(`\n  ${r.path.replace(/\{([^}]+)\}/g, ":$1")}:\n`),
    );

  if (undocumented.length > 0) {
    yaml = mergeUndocumentedRoutes(yaml, undocumented);
    fs.writeFileSync(specPath, yaml, "utf8");
    for (const r of undocumented) openApiPaths.add(r.path);
    console.log(`[generateOpenApi] Appended ${undocumented.length} stub path(s) to openapi.yaml`);
  }

  fs.mkdirSync(distDir, { recursive: true });
  fs.copyFileSync(specPath, path.join(distDir, "openapi.yaml"));
  fs.copyFileSync(specPath, path.join(distDir, "swagger.json"));

  const manifest = {
    generatedAt: new Date().toISOString(),
    routeCount: liveRoutes.length,
    routes: liveRoutes,
    openApiPathCount: openApiPaths.size,
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const missingCritical = [];
  for (const critical of CRITICAL_PATHS) {
    if (!openApiPaths.has(critical)) missingCritical.push(critical);
  }

  const undocumentedPaths = liveRoutes
    .map((r) => normalizeExpressPath(r.path))
    .filter((p) => !openApiPaths.has(p));

  console.log(`[generateOpenApi] Live routes: ${liveRoutes.length}`);
  console.log(`[generateOpenApi] OpenAPI paths: ${openApiPaths.size}`);
  console.log(`[generateOpenApi] Wrote ${path.join(distDir, "swagger.json")}`);

  if (missingCritical.length > 0) {
    console.error("[generateOpenApi] Missing critical OpenAPI paths:", missingCritical.join(", "));
    process.exit(1);
  }

  if (undocumentedPaths.length > 0) {
    console.warn(
      `[generateOpenApi] ${undocumentedPaths.length} route(s) still undocumented. Sample:`,
      undocumentedPaths.slice(0, 8).join(", "),
    );
  }

  console.log("[generateOpenApi] Critical path contract: OK");
}

main();
