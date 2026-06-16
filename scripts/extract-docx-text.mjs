import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const docxPath = process.argv[2];
const outputPath = process.argv[3];
const cacheKey = process.argv[4] ?? "default";

if (!docxPath) {
  console.error("Usage: node extract-docx-text.mjs <path-to-docx> [output.txt] [cache-key]");
  process.exit(1);
}

const tempDir = path.join(os.tmpdir(), `erector_docx_${cacheKey}`);
const extractDir = path.join(tempDir, "extracted");
const xmlPath = path.join(extractDir, "word", "document.xml");

if (!fs.existsSync(xmlPath)) {
  fs.mkdirSync(extractDir, { recursive: true });
  fs.copyFileSync(docxPath, path.join(tempDir, "doc.zip"));
  const { execSync } = await import("node:child_process");
  execSync(
    `powershell -NoProfile -Command "Expand-Archive -Path '${path.join(tempDir, "doc.zip").replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force"`,
    { stdio: "inherit" },
  );
}

let xml = fs.readFileSync(xmlPath, "utf8");
xml = xml
  .replace(/<w:tab[^>]*\/>/g, "\t")
  .replace(/<\/w:p>/g, "\n")
  .replace(/<w:br[^>]*\/>/g, "\n")
  .replace(/<[^>]+>/g, "")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'");

if (outputPath) {
  fs.writeFileSync(outputPath, xml);
} else {
  console.log(xml);
}
