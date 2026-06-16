import fs from "node:fs";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(root, ".env.local") });
dotenv.config({ path: join(root, "artifacts/api-server/.env") });

const keys = [
  "DATABASE_URL", "DIRECT_URL", "ANTHROPIC_API_KEY", "SUPABASE_URL",
  "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY",
  "INTERNAL_AUTH_SECRET", "BHUDHI_MODEL", "ERECTOR_VALIDATION_MODEL_VERSION", "FRONTEND_URL",
];
const files = [".env.local", "artifacts/api-server/.env", "artifacts/api-server/.dev.vars"];

function parse(file) {
  const m = {};
  const p = join(root, file);
  if (!fs.existsSync(p)) return m;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    const inline = v.indexOf(" #");
    if (inline >= 0) v = v.slice(0, inline).trim();
    if (v) m[k] = v;
  }
  return m;
}

const merged = {};
for (const f of files) Object.assign(merged, parse(f));
for (const k of keys) {
  const v = merged[k] || process.env[k] || "";
  console.log(`${k}: ${v ? "PASS" : "FAIL"}`);
}
