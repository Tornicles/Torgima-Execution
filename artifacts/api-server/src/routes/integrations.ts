import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import { success, checkFeatureFlag } from "../lib/utils.js";
import { handleRouteError } from "../lib/route-helpers.js";
import { FEATURE_FLAGS } from "../constants/feature-flags.js";
import { TorgimaError } from "../lib/errors.js";
import {
  connectIntegration,
  connectTelegramIntegration,
  connectZapier,
  getSocialPostMetrics,
  listNotificationChannels,
  resolveCalendarConflict,
  syncAllEngagement,
  testIntegrationConnection,
  createAutomationFlow,
  deleteAutomationFlow,
  deleteWebhook,
  disconnectIntegration,
  executeAutomationFlows,
  getSyncHistory,
  INTEGRATION_TYPES,
  listAutomationFlows,
  listCalendarConflicts,
  listConnectedIntegrations,
  listWebhookLogs,
  publishToPlatforms,
  registerWebhook,
  submitHealthData,
  syncEngagementForPost,
  syncIntegration,
  triggerUserWebhooks,
  updateAutomationFlow,
} from "../engines/integrations/IntegrationsEngine.js";

const router = Router();

async function requireIntegrationsEnabled() {
  const on = await checkFeatureFlag(FEATURE_FLAGS.EXTERNAL_INTEGRATIONS_ENABLED);
  if (!on) {
    throw new TorgimaError("FEATURE_DISABLED", "External integrations are not enabled", false);
  }
}

router.get("/integrations/types", async (req, res) => {
  try {
    await requireIntegrationsEnabled();
    await requireAuth(req, "USER_SESSION");
    success(res, { types: INTEGRATION_TYPES });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

const connectBodySchema = z.object({
  code: z.string().optional(),
  accountIdentifier: z.string().optional(),
  scopes: z.array(z.string()).optional(),
});

async function handleConnect(
  req: import("express").Request,
  res: import("express").Response,
  integrationType: string,
) {
  await requireIntegrationsEnabled();
  const auth = await requireAuth(req, "USER_SESSION");
  const code =
    (req.query.code as string | undefined) ??
    connectBodySchema.parse(req.body ?? {}).code;
  const body = connectBodySchema.parse({ ...req.body, code });
  const integration = await connectIntegration(auth.userId, integrationType, body);
  success(res, { integration });
}

router.post("/integrations/connect/:integrationType", async (req, res) => {
  try {
    await handleConnect(req, res, z.string().parse(req.params.integrationType));
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/integrations/slack/connect", async (req, res) => {
  try {
    await handleConnect(req, res, "slack");
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/integrations/discord/connect", async (req, res) => {
  try {
    await handleConnect(req, res, "discord");
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/integrations/linkedin/connect", async (req, res) => {
  try {
    await handleConnect(req, res, "linkedin");
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/integrations/twitter/connect", async (req, res) => {
  try {
    await handleConnect(req, res, "twitter");
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/integrations/telegram/connect", async (req, res) => {
  try {
    await requireIntegrationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z.object({ botToken: z.string(), chatId: z.string() }).parse(req.body);
    const integration = await connectTelegramIntegration(
      auth.userId,
      body.botToken,
      body.chatId,
    );
    success(res, { integration });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/integrations/notification-channels", async (req, res) => {
  try {
    await requireIntegrationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const channels = await listNotificationChannels(auth.userId);
    success(res, { channels });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/integrations/test/:integrationType", async (req, res) => {
  try {
    await requireIntegrationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const integrationType = z.string().parse(req.params.integrationType);
    const result = await testIntegrationConnection(auth.userId, integrationType);
    success(res, result);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/integrations/calendar/conflicts/:conflictId/resolve", async (req, res) => {
  try {
    await requireIntegrationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const conflictId = z.string().uuid().parse(req.params.conflictId);
    const body = z
      .object({
        resolutionStrategy: z.enum(["torgima-wins", "external-wins", "manual"]),
      })
      .parse(req.body);
    const conflict = await resolveCalendarConflict(
      auth.userId,
      conflictId,
      body.resolutionStrategy,
    );
    success(res, { conflict });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/integrations/social/post/:postId/metrics", async (req, res) => {
  try {
    await requireIntegrationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const postId = z.string().uuid().parse(req.params.postId);
    const data = await getSocialPostMetrics(auth.userId, postId);
    success(res, data);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/integrations/connected", async (req, res) => {
  try {
    await requireIntegrationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const integrations = await listConnectedIntegrations(auth.userId);
    success(res, { integrations });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.delete("/integrations/:integrationId", async (req, res) => {
  try {
    await requireIntegrationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const integrationId = z.string().uuid().parse(req.params.integrationId);
    const integration = await disconnectIntegration(auth.userId, integrationId);
    success(res, { integration });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/integrations/:integrationId/sync", async (req, res) => {
  try {
    await requireIntegrationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const integrationId = z.string().uuid().parse(req.params.integrationId);
    const result = await syncIntegration(auth.userId, integrationId);
    success(res, result);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/integrations/sync-history/:integrationId", async (req, res) => {
  try {
    await requireIntegrationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const integrationId = z.string().uuid().parse(req.params.integrationId);
    const history = await getSyncHistory(auth.userId, integrationId);
    success(res, history);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/integrations/calendar/conflicts", async (req, res) => {
  try {
    await requireIntegrationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const conflicts = await listCalendarConflicts(auth.userId);
    success(res, { conflicts });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/integrations/health-data", async (req, res) => {
  try {
    await requireIntegrationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        metricType: z.string(),
        value: z.number(),
        unit: z.string(),
        date: z.string().optional(),
      })
      .parse(req.body);
    const row = await submitHealthData(auth.userId, body);
    success(res, { health: row });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/integrations/social/publish", async (req, res) => {
  try {
    await requireIntegrationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        content: z.string().min(1),
        platforms: z.array(z.string()).min(1),
        publishedContentId: z.string().uuid().optional(),
      })
      .parse(req.body);
    const posts = await publishToPlatforms(
      auth.userId,
      body.content,
      body.platforms,
      body.publishedContentId,
    );
    success(res, { posts });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/integrations/social/sync-engagement", async (req, res) => {
  try {
    await requireIntegrationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z.object({ postId: z.string().uuid().optional() }).parse(req.body ?? {});
    if (body.postId) {
      const metrics = await syncEngagementForPost(auth.userId, body.postId);
      success(res, { metrics });
      return;
    }
    const metrics = await syncAllEngagement(auth.userId);
    success(res, { metrics, synced: metrics.length });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/integrations/webhooks/register", async (req, res) => {
  try {
    await requireIntegrationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z.object({ eventType: z.string(), webhookUrl: z.string().url() }).parse(req.body);
    const webhook = await registerWebhook(auth.userId, body.eventType, body.webhookUrl);
    success(res, { webhook });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.delete("/integrations/webhooks/:webhookId", async (req, res) => {
  try {
    await requireIntegrationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const webhookId = z.string().uuid().parse(req.params.webhookId);
    await deleteWebhook(auth.userId, webhookId);
    success(res, { deleted: true });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/integrations/webhooks/logs/:webhookId", async (req, res) => {
  try {
    await requireIntegrationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const webhookId = z.string().uuid().parse(req.params.webhookId);
    const logs = await listWebhookLogs(auth.userId, webhookId);
    success(res, { logs });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/integrations/zapier/connect", async (req, res) => {
  try {
    await requireIntegrationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        zapierId: z.string(),
        integrationType: z.string(),
      })
      .parse(req.body ?? {});
    const connection = await connectZapier(auth.userId, body.zapierId, body.integrationType);
    success(res, { connection });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/integrations/automation-flows", async (req, res) => {
  try {
    await requireIntegrationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const flows = await listAutomationFlows(auth.userId);
    success(res, { flows });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/integrations/automation-flows", async (req, res) => {
  try {
    await requireIntegrationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        name: z.string(),
        description: z.string().optional(),
        trigger: z.string(),
        triggerConditions: z.record(z.unknown()).optional(),
        actions: z.array(z.unknown()),
      })
      .parse(req.body);
    const flow = await createAutomationFlow(auth.userId, body);
    success(res, { flow });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.put("/integrations/automation-flows/:flowId", async (req, res) => {
  try {
    await requireIntegrationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const flowId = z.string().uuid().parse(req.params.flowId);
    const body = z
      .object({
        name: z.string().optional(),
        description: z.string().optional(),
        trigger: z.string().optional(),
        triggerConditions: z.record(z.unknown()).optional(),
        actions: z.array(z.unknown()).optional(),
        isActive: z.boolean().optional(),
      })
      .parse(req.body);
    const flow = await updateAutomationFlow(auth.userId, flowId, body);
    success(res, { flow });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.delete("/integrations/automation-flows/:flowId", async (req, res) => {
  try {
    await requireIntegrationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const flowId = z.string().uuid().parse(req.params.flowId);
    await deleteAutomationFlow(auth.userId, flowId);
    success(res, { deleted: true });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/integrations/automation-flows/execute", async (req, res) => {
  try {
    await requireIntegrationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        trigger: z.string(),
        context: z.record(z.unknown()).default({}),
      })
      .parse(req.body);
    const executed = await executeAutomationFlows(auth.userId, body.trigger, body.context);
    success(res, { executed });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/integrations/webhooks/trigger", async (req, res) => {
  try {
    await requireIntegrationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        eventType: z.string(),
        payload: z.record(z.unknown()).default({}),
      })
      .parse(req.body);
    const results = await triggerUserWebhooks(auth.userId, body.eventType, body.payload);
    success(res, { results });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

export default router;
