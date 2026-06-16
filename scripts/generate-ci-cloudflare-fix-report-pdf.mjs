import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const htmlPath = join(repoRoot, "docs", "CI_CLOUDFLARE_FIX_REPORT.html");
const pdfPath = join(repoRoot, "docs", "TORGIMA_CI_CLOUDFLARE_FIX_REPORT.pdf");

async function main() {
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  const html = readFileSync(htmlPath, "utf8");
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: "18mm", bottom: "18mm", left: "14mm", right: "14mm" },
  });
  await browser.close();
  console.log(`Wrote ${pdfPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
