import PDFDocument from "pdfkit";

type PdfDoc = InstanceType<typeof PDFDocument>;
import type { validations } from "@workspace/db";
import {
  enrichedFromValidationRow,
  mapCompetitorsForApi,
  mapOpportunitiesForApi,
  type EconomicContext,
} from "./enrichedValidationIntel.js";
import {
  buildOnboardingValidationResultsPayload,
} from "./buildOnboardingValidationResults.js";
import { userGoalFromRow, userPurposeFromRow } from "./mapValidationIntel.js";

type ValidationRow = typeof validations.$inferSelect;

const BRAND = "#6B21A8";

function na(value: unknown): string {
  if (value == null || value === "" || value === "—") return "Not available";
  return String(value);
}

function sectionTitle(doc: PdfDoc, title: string) {
  doc.moveDown(0.5);
  doc.rect(50, doc.y, 4, 14).fill(BRAND);
  doc.fillColor("#111827").fontSize(13).font("Helvetica-Bold").text(title, 60, doc.y - 14);
  doc.moveDown(0.8);
  doc.font("Helvetica").fontSize(11);
}

function bulletList(doc: PdfDoc, items: string[]) {
  for (const item of items) {
    doc.fillColor("#374151").text(`• ${na(item)}`, { indent: 12 });
  }
}

function newPage(doc: PDFKit.PDFDocument) {
  doc.addPage();
  doc.fillColor("#111827").fontSize(11).font("Helvetica");
}

export function reportFilename(row: ValidationRow): string {
  const goal = userGoalFromRow(row);
  const slug = goal
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .split("-")
    .slice(0, 4)
    .join("-") || "report";
  const date = new Date().toISOString().slice(0, 10);
  return `torgima-validation-${slug}-${date}.pdf`;
}

export async function generateValidationReportPdf(row: ValidationRow): Promise<Buffer> {
  const shaped = buildOnboardingValidationResultsPayload(row);
  const enriched = enrichedFromValidationRow(row);
  const competitors = mapCompetitorsForApi(enriched.competitors);
  const opportunities = mapOpportunitiesForApi(enriched.opportunities);
  const economic = enriched.economicContext;
  const goal = userGoalFromRow(row);
  const purpose = userPurposeFromRow(row);
  const generated = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // PAGE 1 — COVER
    doc.fontSize(22).font("Helvetica-Bold").fillColor(BRAND).text("TORGIMA VALIDATION REPORT", { align: "center" });
    doc.moveDown(1);
    doc.fontSize(16).fillColor("#111827").text(goal || "Your Idea", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(11).font("Helvetica").fillColor("#6B7280").text(generated, { align: "center" });
    doc.text("Validated by Bhudhi · Erector Execution Intelligence", { align: "center" });

    // PAGE 2 — YOUR IDEA
    newPage(doc);
    sectionTitle(doc, "YOUR IDEA");
    doc.text(`Goal: ${na(goal)}`);
    doc.text(`Purpose: ${na(purpose)}`);
    doc.text(`Location: ${na(row.location_country)}`);
    doc.text(`Industry: ${na(row.domain)}`);
    doc.text(`Timeframe: ${na(row.timeframe)} (${na(row.timeframe_days)} days)`);
    doc.text(`Commitment: ${na(row.commitment_level)}`);
    doc.text(`Selected Direction: ${na(shaped.selectedPath)}`);

    // PAGE 3 — VALIDATION SUMMARY
    newPage(doc);
    sectionTitle(doc, "VALIDATION SUMMARY");
    doc.text(`Reality Score: ${shaped.realityScore}%`);
    doc.text(`Final Verdict: ${na(shaped.verdict)}`);
    doc.text(`Verdict Label: ${na(shaped.verdictLabel)}`);
    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").text("AT A GLANCE:");
    doc.font("Helvetica");
    const glance = shaped.atAGlance as Record<string, unknown>;
    doc.text(`Problem Exists: ${na(glance.problemExists)}`);
    doc.text(`Market Demand: ${na(glance.marketDemand)}`);
    doc.text(`Competition Level: ${na(glance.competitionLevel)}`);
    doc.text(`Feasibility: ${na(glance.feasibility)}`);
    doc.text(`Timing: ${na(glance.timing)}`);
    doc.text(`Execution Fit: ${na(glance.executionFit)}`);
    doc.text(`Current Trends: ${na(shaped.trendPosition)} · ${na(shaped.growthRate)}`);

    // PAGE 4 — ECONOMIC ENVIRONMENT
    newPage(doc);
    writeEconomicPage(doc, economic);

    // PAGE 5 — COMPETITORS
    newPage(doc);
    sectionTitle(doc, "TOP 3 COMPETITORS");
    competitors.forEach((c, i) => {
      if (i > 0) doc.moveDown(0.5);
      doc.font("Helvetica-Bold").text(`COMPETITOR ${i + 1}: ${na(c.name)}`);
      doc.font("Helvetica").text(na(c.tagline));
      doc.text(na(c.description));
      doc.text(`Founded: ${na(c.founded)} | Revenue: ${na(c.estimatedRevenue)} | Users: ${na(c.userBase)}`);
      doc.text(`Geography: ${na(c.geography)}`);
      doc.font("Helvetica-Bold").text("STRENGTHS:");
      doc.font("Helvetica");
      bulletList(doc, c.strengths);
      doc.font("Helvetica-Bold").text("WEAKNESSES:");
      doc.font("Helvetica");
      bulletList(doc, c.weaknesses);
      doc.text(`Market Share: ${na(c.marketShare)}`);
      doc.font("Helvetica-Bold").text(`WHERE YOUR IDEA FITS RELATIVE TO ${na(c.name)}:`);
      doc.font("Helvetica").text(na(c.whereYourIdeaFits));
    });

    // PAGE 6 — OPPORTUNITIES
    newPage(doc);
    sectionTitle(doc, "TOP OPPORTUNITIES");
    opportunities.forEach((o, i) => {
      if (i > 0) doc.moveDown(0.5);
      doc.font("Helvetica-Bold").text(`OPPORTUNITY: ${na(o.title)}`);
      doc.font("Helvetica").text(`Impact: ${na(o.impact).toUpperCase()}`);
      doc.text(`Time Window: ${na(o.timeWindow)}`);
      doc.font("Helvetica-Bold").text("FULL SUMMARY:");
      doc.font("Helvetica").text(na(o.summary));
      doc.text(`Market Signal: ${na(o.marketSignal)}`);
    });

    // PAGE 7 — PROS & CONS
    newPage(doc);
    sectionTitle(doc, "PROS & CONS");
    doc.font("Helvetica-Bold").text("PROS:");
    doc.font("Helvetica");
    bulletList(doc, shaped.pros as string[]);
    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").text("CONS:");
    doc.font("Helvetica");
    bulletList(doc, shaped.cons as string[]);

    // PAGE 8 — RISKS
    newPage(doc);
    sectionTitle(doc, "RISK SUMMARY");
    const risks = shaped.risks as Array<{ title?: string; description?: string; severity?: string }>;
    for (const risk of risks) {
      doc.font("Helvetica-Bold").text(`${na(risk.title)} — ${na(risk.severity).toUpperCase()}`);
      doc.font("Helvetica").text(na(risk.description));
      doc.moveDown(0.3);
    }

    // PAGE 9 — PATHS
    newPage(doc);
    sectionTitle(doc, "PATH OUTCOMES COMPARISON");
    const paths = shaped.paths as Record<string, Record<string, unknown>>;
    const adjusted = paths.adjusted ?? {};
    doc.font("Helvetica-Bold").text(`RECOMMENDED: ${na(adjusted.label)}`);
    doc.font("Helvetica").text(na(adjusted.description));
    doc.text(`Success Potential: ${na(adjusted.successPotential)}`);
    doc.text(`Estimated Outcome: ${na(adjusted.estimatedOutcome)}`);
    doc.text(`Time to Traction: ${na(adjusted.timeToTraction)}`);
    doc.moveDown(0.5);
    const current = paths.current ?? {};
    doc.text(
      `CURRENT PATH (AS IS): ${na(current.description)} | Success: ${na(current.successPotential)} | Time: ${na(current.timeToTraction)}`,
    );
    const alt = paths.alternative ?? {};
    doc.text(
      `ALTERNATIVE PATH (PIVOT): ${na(alt.description)} | Success: ${na(alt.successPotential)} | Time: ${na(alt.timeToTraction)}`,
    );

    // PAGE 10 — MILESTONES
    newPage(doc);
    sectionTitle(doc, "SUCCESS PLAN — KEY MILESTONES");
    const milestones = shaped.milestones as Array<{ number?: number; title?: string; timeframe?: string }>;
    milestones.forEach((m, i) => {
      doc.text(`${i + 1}. ${na(m.title)} — ${na(m.timeframe)}`);
    });

    // PAGE 11 — FOOTER
    newPage(doc);
    sectionTitle(doc, "REPORT FOOTER");
    doc.text("Generated by Torgima Execution System");
    doc.text("Powered by Bhudhi Intelligence");
    doc.text(`Validation ID: ${row.id}`);
    doc.text(`Date: ${generated}`);
    doc.text("This report is confidential and generated for the account holder.");

    doc.end();
  });
}

function writeEconomicPage(doc: PdfDoc, economic: EconomicContext) {
  sectionTitle(doc, `ECONOMIC ENVIRONMENT — ${na(economic.country).toUpperCase()}`);
  doc.text(`Country: ${na(economic.country)}`);
  doc.text(`Region: ${na(economic.region)}`);
  doc.text(`Economic Zone: ${na(economic.economicZone)}`);
  doc.text(`Market Maturity: ${na(economic.marketMaturity)}`);
  doc.text(`Digital Penetration: ${na(economic.digitalPenetration)}`);
  doc.text(`Political Climate: ${na(economic.politicalClimate)}`);
  doc.text(`Regulatory Environment: ${na(economic.regulatoryEnvironment)}`);
  doc.text(`Business Environment / Rating: ${na(economic.economicOpportunityRating)}`);
  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").text("LOCAL MARKET DYNAMICS:");
  doc.font("Helvetica").text(na(economic.localMarketDynamics));
  doc.font("Helvetica-Bold").text("GLOBAL MARKET ACCESS:");
  doc.font("Helvetica").text(na(economic.globalMarketAccess));
  doc.font("Helvetica-Bold").text(`ECONOMIC OPPORTUNITY RATING: ${na(economic.economicOpportunityRating).toUpperCase()}`);
  doc.font("Helvetica-Bold").text("ECONOMIC SUMMARY:");
  doc.font("Helvetica").text(na(economic.economicSummary));
}
