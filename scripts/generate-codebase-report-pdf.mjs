/**
 * Generates TORGIMA_CODEBASE_REPORT.pdf from markdown using pdfkit (no browser).
 */
import { createWriteStream, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const mdPath = join(root, "docs", "TORGIMA_CODEBASE_REPORT.md");
const pdfPath = join(root, "docs", "TORGIMA_CODEBASE_REPORT.pdf");

const md = readFileSync(mdPath, "utf8");
const lines = md.split("\n");

const doc = new PDFDocument({
  size: "A4",
  margins: { top: 50, bottom: 50, left: 50, right: 50 },
  info: {
    Title: "TORGIMA Codebase Report",
    Author: "Torgima Engineering",
    Subject: "Codebase status — working, not working, launch requirements",
  },
});

doc.pipe(createWriteStream(pdfPath));

const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
const colors = {
  h1: "#0f3460",
  h2: "#16213e",
  h3: "#533483",
  accent: "#e94560",
  body: "#1a1a2e",
  muted: "#666666",
};

function stripMd(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(x| )\]/g, (_, c) => (c === "x" ? "[x]" : "[ ]"));
}

function ensureSpace(needed = 40) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function writeParagraph(text, opts = {}) {
  const cleaned = stripMd(text);
  if (!cleaned.trim()) return;
  ensureSpace(30);
  doc
    .font(opts.italic ? "Helvetica-Oblique" : "Helvetica")
    .fontSize(opts.size ?? 10)
    .fillColor(opts.color ?? colors.body)
    .text(cleaned, { width: pageWidth, align: opts.align ?? "left", lineGap: 2 });
  doc.moveDown(0.3);
}

function writeHeading(text, level) {
  const sizes = { 1: 20, 2: 14, 3: 11 };
  const cols = { 1: colors.h1, 2: colors.h2, 3: colors.h3 };
  ensureSpace(50);
  if (level === 1) doc.moveDown(0.2);
  doc
    .font("Helvetica-Bold")
    .fontSize(sizes[level])
    .fillColor(cols[level])
    .text(stripMd(text), { width: pageWidth });
  if (level <= 2) {
    doc
      .moveTo(doc.page.margins.left, doc.y + 2)
      .lineTo(doc.page.margins.left + pageWidth, doc.y + 2)
      .strokeColor(level === 1 ? colors.accent : "#dddddd")
      .lineWidth(level === 1 ? 2 : 0.5)
      .stroke();
  }
  doc.moveDown(0.5);
}

function writeTable(rows) {
  if (!rows.length) return;
  ensureSpace(30);
  rows.forEach((cells, ri) => {
    ensureSpace(16);
    const rowText = cells.map(stripMd).join("  |  ");
    doc
      .font(ri === 0 ? "Helvetica-Bold" : "Helvetica")
      .fontSize(8)
      .fillColor(ri === 0 ? colors.h2 : colors.body)
      .text(rowText, { width: pageWidth, lineGap: 1 });
    if (ri === 0) {
      doc
        .moveTo(doc.page.margins.left, doc.y + 1)
        .lineTo(doc.page.margins.left + pageWidth, doc.y + 1)
        .strokeColor("#cccccc")
        .stroke();
    }
    doc.moveDown(0.15);
  });
  doc.moveDown(0.3);
}

function writeBullet(text) {
  ensureSpace(20);
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(colors.body)
    .text(`•  ${stripMd(text)}`, { width: pageWidth - 10, indent: 10, lineGap: 1 });
  doc.moveDown(0.15);
}

let i = 0;
while (i < lines.length) {
  const line = lines[i];

  if (line.startsWith("# ")) {
    writeHeading(line.slice(2), 1);
  } else if (line.startsWith("## ")) {
    writeHeading(line.slice(3), 2);
  } else if (line.startsWith("### ")) {
    writeHeading(line.slice(4), 3);
  } else if (line.startsWith("|") && line.includes("|")) {
    const tableLines = [];
    while (i < lines.length && lines[i].startsWith("|")) {
      if (!/^\|[-| :]+\|$/.test(lines[i].trim())) {
        const cells = lines[i]
          .split("|")
          .filter((c) => c.trim())
          .map((c) => c.trim());
        if (cells.length) tableLines.push(cells);
      }
      i++;
    }
    writeTable(tableLines);
    continue;
  } else if (line.startsWith("- ")) {
    writeBullet(line.slice(2));
  } else if (line.startsWith("---")) {
    ensureSpace(20);
    doc
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.margins.left + pageWidth, doc.y)
      .strokeColor("#eeeeee")
      .stroke();
    doc.moveDown(0.5);
  } else if (line.trim() === "") {
    // skip
  } else if (line.startsWith("*") && line.endsWith("*")) {
    writeParagraph(line.slice(1, -1), { italic: true, size: 9, color: colors.muted });
  } else {
    writeParagraph(line);
  }
  i++;
}

doc.end();

await new Promise((resolve, reject) => {
  doc.on("end", resolve);
  doc.on("error", reject);
});

console.log(`PDF written to: ${pdfPath}`);
