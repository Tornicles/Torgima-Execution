import fs from "fs";
import path from "path";

const docs = process.argv.slice(2);
if (docs.length === 0) {
  console.error("Usage: node scripts/extract-docx-text.mjs <docx> [out.txt]");
  process.exit(1);
}

const docx = docs[0];
const out = docs[1] ?? docx.replace(/\.docx$/i, "_extracted.txt");

const { execSync } = await import("child_process");
const tmp = path.join(path.dirname(out), `_tmp_${path.basename(docx, ".docx")}`);
fs.mkdirSync(tmp, { recursive: true });
const zipPath = path.join(tmp, "doc.zip");
fs.copyFileSync(docx, zipPath);
execSync(
  `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${tmp.replace(/'/g, "''")}' -Force"`,
  { stdio: "inherit" },
);

const xmlPath = path.join(tmp, "word", "document.xml");
const xml = fs.readFileSync(xmlPath, "utf8");
const texts = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]);
const lines = [];
let buf = "";
for (const t of texts) {
  if (!t) continue;
  if (t.endsWith("\n") || /^Route\s+\d+/i.test(t) || /^POST |^GET |^PATCH |^DELETE /i.test(t)) {
    if (buf.trim()) lines.push(buf.trim());
    buf = t;
  } else {
    buf += (buf && !buf.endsWith(" ") ? " " : "") + t;
  }
}
if (buf.trim()) lines.push(buf.trim());

fs.writeFileSync(out, lines.join("\n"), "utf8");
console.log(`Wrote ${lines.length} lines to ${out}`);
