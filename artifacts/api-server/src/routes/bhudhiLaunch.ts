import { Router } from "express";
import { z } from "zod/v4";
import { db, users } from "@workspace/db";
import { eq } from "drizzle-orm";
import { bhudhiSuccess } from "../bhudhi/api/bhudhiApiEnvelope.js";
import { getEnvironment, resolveEnvironmentName } from "../config/environments.js";
import { pricingTiers, userTierFromPricingTier, type PricingTier } from "../pricing/bhudhiTiers.js";
import { launchLimitsService } from "../launch/LaunchLimitsService.js";
import { telemetry, type TelemetryEvent } from "../telemetry/Telemetry.js";
import { requireAuth } from "../lib/auth.js";
import { handleError, failure } from "../lib/utils.js";

const router = Router();

/** GET /api/bhudhi/launch/status — launch readiness manifest (Prompt 40) */
router.get("/bhudhi/launch/status", async (_req, res) => {
  try {
    const env = getEnvironment();
    bhudhiSuccess(res, {
      success: true,
      phase: "launch",
      status: "ready",
      version: "BHUDHI 2.0",
      environment: resolveEnvironmentName(),
      features: env.features,
      telemetry: env.telemetry,
      routes: [
        "GET /api/bhudhi/launch/status",
        "GET /api/bhudhi/launch/config",
        "POST /api/bhudhi/launch/onboard",
        "POST /api/telemetry",
      ],
      dashboard: ["/app/bhudhi/launch", "/app/bhudhi/onboarding"],
      docs: {
        launch: "docs/BHUDHI_LAUNCH.md",
        deploymentChecklist: "docs/DEPLOYMENT_CHECKLIST.md",
        releaseNotes: "docs/RELEASE_NOTES.md",
      },
      insight: "Bhudhi 2.0 launch stack configured — environments, tiers, telemetry, onboarding.",
      nextSteps: [
        "Complete /app/bhudhi/onboarding",
        "GET /api/bhudhi/certification before production cutover",
        "Apply docs/DEPLOYMENT_CHECKLIST.md",
      ],
    });
  } catch (err) {
    handleError(_req, res, err);
  }
});

/** GET /api/bhudhi/launch/config — environment + pricing (public) */
router.get("/bhudhi/launch/config", (_req, res) => {
  const env = getEnvironment();
  bhudhiSuccess(res, {
    success: true,
    environment: {
      name: env.name,
      apiUrl: env.apiUrl,
      features: env.features,
      limits: env.limits,
      telemetry: env.telemetry,
    },
    pricing: Object.entries(pricingTiers).map(([id, tier]) => ({
      id: id as PricingTier,
      name: tier.name,
      monthlyPrice: tier.monthlyPrice,
      description: tier.description,
      torgimaTier: tier.torgimaTier,
      limits: tier.limits,
    })),
  });
});

const onboardSchema = z.object({
  name: z.string().min(1).max(200),
  organization: z.string().max(200).optional(),
  useCase: z.string().min(5).max(2000),
  tier: z.enum(["free", "pro", "enterprise"]),
});

/** POST /api/bhudhi/launch/onboard — Bhudhi launch onboarding (auth) */
router.post("/bhudhi/launch/onboard", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = onboardSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid onboarding body", 400);
      return;
    }

    const { name, organization, useCase, tier } = parsed.data;
    const torgimaTier = userTierFromPricingTier(tier);

    const [existing] = await db
      .select({ metadata: users.metadata, display_name: users.display_name })
      .from(users)
      .where(eq(users.id, auth.userId))
      .limit(1);

    const prior =
      existing?.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
        ? (existing.metadata as Record<string, unknown>)
        : {};

    const bhudhiLaunch = {
      completedAt: new Date().toISOString(),
      name,
      organization: organization ?? null,
      useCase,
      pricingTier: tier,
      torgimaTier,
    };

    await db
      .update(users)
      .set({
        display_name: existing?.display_name || name,
        tier: torgimaTier,
        metadata: { ...prior, bhudhiLaunch },
      })
      .where(eq(users.id, auth.userId));

    telemetry.track({
      event: "bhudhi.launch.onboard",
      userId: auth.userId,
      properties: { tier, torgimaTier },
    });

    const limits = await launchLimitsService.checkBlueprintLimit(auth.userId);

    bhudhiSuccess(res, {
      success: true,
      onboarding: bhudhiLaunch,
      limits,
      redirect: "/app/bhudhi",
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

/** GET /api/bhudhi/launch/limits — tier limits for current user */
router.get("/bhudhi/launch/limits", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const limits = await launchLimitsService.checkBlueprintLimit(auth.userId);
    bhudhiSuccess(res, { success: true, limits });
  } catch (err) {
    handleError(req, res, err);
  }
});

const telemetryBodySchema = z.object({
  events: z
    .array(
      z.object({
        event: z.string().min(1).max(120),
        userId: z.string().uuid().optional(),
        blueprintId: z.string().uuid().optional(),
        properties: z.record(z.string(), z.unknown()).optional(),
        timestamp: z.union([z.string(), z.number()]).optional(),
      }),
    )
    .min(1)
    .max(50),
});

/** POST /api/telemetry — ingest client/server telemetry batches */
router.post("/telemetry", async (req, res) => {
  try {
    const auth = await requireAuth(req, "OPTIONAL_SESSION");
    const userId = auth.userId || undefined;

    const parsed = telemetryBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid telemetry payload", 400);
      return;
    }

    const normalized: TelemetryEvent[] = parsed.data.events.map((e) => ({
      event: e.event,
      userId: e.userId ?? userId,
      blueprintId: e.blueprintId,
      properties: e.properties,
      timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
    }));

    telemetry.ingest(normalized);
    bhudhiSuccess(res, { success: true, accepted: normalized.length });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
