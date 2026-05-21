import fs from "fs";
import { execSync } from "child_process";
import path from "path";

const src = process.argv[2];
const out = process.argv[3] ?? src.replace(/\.docx$/i, "_text.txt");
const tmp = path.join(path.dirname(out), "_docx_tmp");
fs.mkdirSync(tmp, { recursive: true });
const zip = path.join(tmp, "doc.zip");
fs.copyFileSync(src, zip);
execSync(
  `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${tmp.replace(/'/g, "''")}' -Force"`,
);
const xml = fs.readFileSync(path.join(tmp, "word", "document.xml"), "utf8");
const text = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("");
fs.writeFileSync(out, text);
console.log(text.length);
console.log(text);
