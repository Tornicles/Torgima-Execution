import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const files = process.argv.slice(2);
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function extractDocx(docxPath) {
  const { execSync } = require("child_process");
  const tmp = path.join(outDir, "_docx_tmp_" + Date.now());
  fs.mkdirSync(tmp, { recursive: true });
  try {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Path '${docxPath.replace(/'/g, "''")}' -DestinationPath '${tmp.replace(/'/g, "''")}' -Force"`,
      { stdio: "pipe" },
    );
  } catch {
    // docx may need copy to .zip
    const zipPath = tmp + ".zip";
    fs.copyFileSync(docxPath, zipPath);
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${tmp.replace(/'/g, "''")}' -Force"`,
      { stdio: "pipe" },
    );
  }
  const xmlPath = path.join(tmp, "word", "document.xml");
  if (!fs.existsSync(xmlPath)) throw new Error("no document.xml");
  let x = fs.readFileSync(xmlPath, "utf8");
  x = x.replace(/<w:tab[^/]*\/>/g, "\t");
  x = x.replace(/<\/w:p>/g, "\n");
  x = x.replace(/<[^>]+>/g, "");
  x = x
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  return x.replace(/\n{3,}/g, "\n\n").trim();
}

for (const f of files) {
  const base = path.basename(f, ".docx");
  const text = extractDocx(f);
  const out = path.join(outDir, `_tier_${base}.txt`);
  fs.writeFileSync(out, text);
  console.log("Wrote", out, text.length);
}
