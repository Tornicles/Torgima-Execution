#!/usr/bin/env node
/**
 * Generate PDF from docs/TORGIMA_VALIDATE_IDEA_ROOT_CAUSE_AUDIT.md
 * Usage: node scripts/generate-validate-idea-audit-pdf.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const require = createRequire(
  path.join(root, "artifacts", "api-server", "package.json"),
);
const PDFDocument = require("pdfkit");
const mdPath = path.join(root, "docs", "TORGIMA_VALIDATE_IDEA_ROOT_CAUSE_AUDIT.md");
const outPath = path.join(root, "docs", "TORGIMA_VALIDATE_IDEA_ROOT_CAUSE_AUDIT.pdf");

const md = fs.readFileSync(mdPath, "utf8");

const doc = new PDFDocument({
  size: "A4",
  margins: { top: 50, bottom: 50, left: 55, right: 55 },
  info: {
    Title: "TORGIMA Validate Idea Root Cause Audit",
    Author: "Torgima Execution OS",
    Subject: "structure-goal failure — Worker DATABASE_URL timeout, not Anthropic",
  },
});

fs.mkdirSync(path.dirname(outPath), { recursive: true });
const stream = fs.createWriteStream(outPath);
doc.pipe(stream);

const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
const bodySize = 9.5;
const h1Size = 16;
const h2Size = 12;
const h3Size = 10.5;
let y = doc.page.margins.top;

function ensureSpace(needed) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (y + needed > bottom) {
    doc.addPage();
    y = doc.page.margins.top;
  }
}

function writeBlock(text, opts = {}) {
  const {
    font = "Helvetica",
    size = bodySize,
    color = "#111111",
    indent = 0,
    lineGap = 2,
  } = opts;
  doc.font(font).fontSize(size).fillColor(color);
  const w = pageWidth - indent;
  const height = doc.heightOfString(text, { width: w, lineGap });
  ensureSpace(height + 4);
  doc.text(text, doc.page.margins.left + indent, y, { width: w, lineGap });
  y += height + lineGap + 2;
}

function writeHr() {
  ensureSpace(12);
  doc
    .strokeColor("#cccccc")
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .stroke();
  y += 14;
}

for (const rawLine of md.split(/\r?\n/)) {
  const line = rawLine.trimEnd();

  if (line === "") {
    y += 6;
    continue;
  }

  if (line === "---") {
    writeHr();
    continue;
  }

  if (line.startsWith("# ")) {
    ensureSpace(28);
    y += 4;
    writeBlock(line.slice(2), { font: "Helvetica-Bold", size: h1Size, color: "#0f172a" });
    y += 4;
    continue;
  }

  if (line.startsWith("## ")) {
    y += 8;
    writeBlock(line.slice(3), { font: "Helvetica-Bold", size: h2Size, color: "#1e3a5f" });
    continue;
  }

  if (line.startsWith("### ")) {
    y += 4;
    writeBlock(line.slice(4), { font: "Helvetica-Bold", size: h3Size, color: "#334155" });
    continue;
  }

  if (line.startsWith("|")) {
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cells.every((c) => /^[-:]+$/.test(c))) continue;
    const row = cells.join("  |  ");
    writeBlock(row, { size: 7.5, font: "Courier", lineGap: 1 });
    continue;
  }

  if (line.startsWith("- ")) {
    writeBlock(`• ${line.slice(2)}`, { indent: 8 });
    continue;
  }

  if (/^\d+\.\s/.test(line)) {
    writeBlock(line, { indent: 8 });
    continue;
  }

  if (line.startsWith("```")) continue;

  if (line.startsWith("*") && line.endsWith("*")) {
    writeBlock(line.replace(/^\*|\*$/g, ""), { size: 8.5, color: "#64748b" });
    continue;
  }

  writeBlock(line);
}

doc.end();

stream.on("finish", () => {
  console.log(`Wrote ${outPath}`);
});

stream.on("error", (err) => {
  console.error(err);
  process.exit(1);
});
