#!/usr/bin/env node
/**
 * TORGIMA production readiness report (MD/JSON/PDF).
 * Usage: node scripts/generate-production-readiness-report.mjs [results.json]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const reportsDir = path.join(root, "reports");
const mdPath = path.join(reportsDir, "TORGIMA_PRODUCTION_READINESS_REPORT.md");
const jsonPath = path.join(reportsDir, "TORGIMA_PRODUCTION_READINESS_REPORT.json");
const pdfPath = path.join(reportsDir, "TORGIMA_PRODUCTION_READINESS_REPORT.pdf");

const require = createRequire(path.join(root, "artifacts", "api-server", "package.json"));
const PDFDocument = require("pdfkit");

function defaultResults() {
  return {
    generated_at: new Date().toISOString(),
    commit: null,
    deploy: { api_health: "unknown", frontend_http: "unknown" },
    pre_commit: {},
    production: {},
    blockers: [],
    verdict: "UNKNOWN",
  };
}

function loadResults() {
  const arg = process.argv[2];
  if (arg && fs.existsSync(arg)) {
    return JSON.parse(fs.readFileSync(arg, "utf8"));
  }
  const embedded = path.join(reportsDir, "_production_readiness_input.json");
  if (fs.existsSync(embedded)) {
    return JSON.parse(fs.readFileSync(embedded, "utf8"));
  }
  return defaultResults();
}

function countStatus(obj) {
  const vals = Object.values(obj ?? {});
  const pass = vals.filter((v) => v === "PASS").length;
  const fail = vals.filter((v) => v === "FAIL" || v === "BLOCKED").length;
  return { pass, fail, total: vals.length };
}

function computeVerdict(data) {
  const pre = countStatus(data.pre_commit);
  const prod = countStatus(data.production);
  if (pre.fail > 0) return "NOT_READY — pre-commit gates failed";
  if (data.deploy?.api_health !== "PASS") return "NOT_READY — API health probe failed";
  if (prod.fail === 0 && prod.total > 0) return "PRODUCTION_READY";
  if (prod.fail > 0) return "CONDITIONAL — deploy live; production verification incomplete";
  return "UNKNOWN";
}

function renderMarkdown(data) {
  const lines = [];
  lines.push("# TORGIMA Production Readiness Report");
  lines.push("");
  lines.push(`*Generated: ${data.generated_at}*`);
  lines.push("");
  if (data.commit) {
    lines.push(`**Commit:** \`${data.commit.sha}\` — ${data.commit.message}`);
    lines.push(`**Branch:** ${data.commit.branch ?? "main"}`);
    lines.push("");
  }
  lines.push("## Executive summary");
  lines.push("");
  lines.push(`**Verdict:** ${data.verdict}`);
  lines.push("");
  if (data.blockers?.length) {
    lines.push("### Blockers");
    for (const b of data.blockers) lines.push(`- ${b}`);
    lines.push("");
  }
  lines.push("## Pre-commit verification (local)");
  lines.push("");
  lines.push("| Check | Result |");
  lines.push("| --- | --- |");
  for (const [k, v] of Object.entries(data.pre_commit ?? {})) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push("");
  lines.push("## Deployment");
  lines.push("");
  lines.push("| Probe | Result | Detail |");
  lines.push("| --- | --- | --- |");
  lines.push(`| API /health | ${data.deploy?.api_health ?? "—"} | ${data.deploy?.api_health_detail ?? ""} |`);
  lines.push(`| Frontend torgima.com | ${data.deploy?.frontend_http ?? "—"} | ${data.deploy?.frontend_detail ?? ""} |`);
  lines.push("");
  lines.push("## Production probes");
  lines.push("");
  lines.push("| Probe | Result | Class |");
  lines.push("| --- | --- | --- |");
  for (const [k, row] of Object.entries(data.probes ?? {})) {
    const ok = row.ok ? "PASS" : row.warn ? "WARN" : "FAIL";
    lines.push(`| ${k} | ${ok} | ${row.class ?? ""} |`);
  }
  lines.push("");
  lines.push("## Production verification");
  lines.push("");
  lines.push("| Check | Result | Notes |");
  lines.push("| --- | --- | --- |");
  for (const [k, row] of Object.entries(data.production ?? {})) {
    const val = typeof row === "string" ? row : row.status;
    const note = typeof row === "object" ? row.note ?? "" : "";
    lines.push(`| ${k} | ${val} | ${note} |`);
  }
  lines.push("");
  lines.push("## Alignment artifacts");
  lines.push("");
  lines.push("- reports/TORGIMA_FULL_SYSTEM_ALIGNMENT_REPORT.md");
  lines.push("- reports/TORGIMA_FULL_SYSTEM_ALIGNMENT_REPORT.json");
  lines.push("- reports/TORGIMA_FULL_SYSTEM_ALIGNMENT_REPORT.pdf");
  lines.push("");
  return lines.join("\n");
}

function writePdfFromMarkdown(md) {
  const doc = new PDFDocument({ size: "A4", margins: { top: 50, bottom: 50, left: 55, right: 55 } });
  fs.mkdirSync(reportsDir, { recursive: true });
  const stream = fs.createWriteStream(pdfPath);
  doc.pipe(stream);
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const lines = md.split(/\r?\n/);

  function stripMd(text) {
    return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
  }

  function ensureSpace(n = 24) {
    if (doc.y + n > doc.page.height - doc.page.margins.bottom) doc.addPage();
  }

  for (const line of lines) {
    if (line.startsWith("# ")) {
      ensureSpace(36);
      doc.font("Helvetica-Bold").fontSize(18).text(stripMd(line.slice(2)), { width: pageWidth });
      doc.moveDown(0.4);
    } else if (line.startsWith("## ")) {
      ensureSpace(30);
      doc.font("Helvetica-Bold").fontSize(13).text(stripMd(line.slice(3)), { width: pageWidth });
      doc.moveDown(0.3);
    } else if (line.startsWith("### ")) {
      ensureSpace(24);
      doc.font("Helvetica-Bold").fontSize(11).text(stripMd(line.slice(4)), { width: pageWidth });
      doc.moveDown(0.2);
    } else if (line.startsWith("- ")) {
      ensureSpace(16);
      doc.font("Helvetica").fontSize(9.5).text(`• ${stripMd(line.slice(2))}`, { width: pageWidth });
      doc.moveDown(0.1);
    } else if (line.startsWith("|") && !/^\|[-| :]+\|$/.test(line.trim())) {
      ensureSpace(14);
      const cells = line
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean)
        .map(stripMd);
      doc.font("Helvetica").fontSize(8).text(cells.join(" | "), { width: pageWidth });
      doc.moveDown(0.08);
    } else if (line.trim()) {
      ensureSpace(18);
      const italic = line.startsWith("*") && line.endsWith("*");
      doc
        .font(italic ? "Helvetica-Oblique" : "Helvetica")
        .fontSize(italic ? 9 : 9.5)
        .text(stripMd(line), { width: pageWidth });
      doc.moveDown(0.15);
    }
  }
  doc.end();
  return new Promise((resolve) => stream.on("finish", resolve));
}

async function main() {
  const data = loadResults();
  data.verdict = data.verdict === "UNKNOWN" ? computeVerdict(data) : data.verdict;
  fs.mkdirSync(reportsDir, { recursive: true });
  const md = renderMarkdown(data);
  fs.writeFileSync(mdPath, md, "utf8");
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), "utf8");
  await writePdfFromMarkdown(md);
  console.log(`Wrote:\n- ${mdPath}\n- ${jsonPath}\n- ${pdfPath}`);
  console.log(`Verdict: ${data.verdict}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
