import fs from "fs";
import { execSync } from "child_process";
import path from "path";

const src = process.argv[2];
const out = process.argv[3];
if (!src || !out) {
  console.error("Usage: node extract-docx.mjs <input.docx> <output.txt>");
  process.exit(1);
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const zip = path.join(root, "_tmp_doc.zip");
const dir = path.join(root, "_tmp_docx");

fs.copyFileSync(src, zip);
fs.rmSync(dir, { recursive: true, force: true });
execSync(
  `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${dir.replace(/'/g, "''")}' -Force"`,
  { stdio: "inherit" },
);

const xml = fs.readFileSync(path.join(dir, "word", "document.xml"), "utf8");
const texts = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]);
fs.writeFileSync(out, texts.join(""), "utf8");
console.log("Wrote", out, "chars:", texts.join("").length);
