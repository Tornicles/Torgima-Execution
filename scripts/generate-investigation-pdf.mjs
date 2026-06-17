#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mdPath = path.join(root, "TORGIMA_INVESTIGATION_REPORT.md");
const pdfPath = path.join(root, "TORGIMA_INVESTIGATION_REPORT.pdf");

const md = fs.readFileSync(mdPath, "utf8");
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.45;color:#111;max-width:900px;margin:40px auto;padding:0 20px}
h1{font-size:20px;border-bottom:2px solid #333;padding-bottom:8px}
h2{font-size:15px;margin-top:24px;color:#222}
h3{font-size:13px;margin-top:16px}
table{border-collapse:collapse;width:100%;margin:12px 0;font-size:10px}
th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}
th{background:#f0f0f0}
code,pre{font-family:Consolas,monospace;font-size:10px;background:#f6f6f6}
pre{white-space:pre-wrap;padding:10px;border:1px solid #ddd}
.pass{color:#0a0;font-weight:bold}.fail{color:#c00;font-weight:bold}.warn{color:#a60;font-weight:bold}
ul{margin:6px 0 12px 18px}
</style></head><body><pre>${md.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></body></html>`;

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "networkidle0" });
await page.pdf({
  path: pdfPath,
  format: "A4",
  margin: { top: "18mm", bottom: "18mm", left: "14mm", right: "14mm" },
  printBackground: true,
});
await browser.close();
const stat = fs.statSync(pdfPath);
console.log(`PDF written: ${pdfPath} (${stat.size} bytes)`);
