import { Router } from "express";
import { z } from "zod/v4";
import { and, eq, inArray } from "drizzle-orm";
import {
  academyProof,
  academyTasks,
  db,
  erectorCapabilityGaps,
  erectorCapabilityProfiles,
} from "@workspace/db";
import { requireAuth } from "../../lib/auth.js";
import { handleError, failure } from "../../lib/utils.js";
import {
  erectorSuccess,
  finishErectorApiLog,
  getActiveBlueprintId,
  readIdempotencyKey,
  withApiIdempotency,
} from "../../lib/erectorApiHelpers.js";
import { validateErectorAcademyProof } from "../../engines/erector/academy/AcademyProofValidator.js";

const router = Router();

const proofSubmitSchema = z.object({
  academy_task_id: z.string().uuid(),
  proof_json: z.record(z.string(), z.unknown()),
  reflection: z.string().min(1),
});

router.post("/proof/submit", async (req, res) => {
  try {
    const started = Date.now();
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = proofSubmitSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid academy proof body", 400);
      return;
    }

    const idempotencyKey = readIdempotencyKey(req);
    const outcome = await withApiIdempotency("academy_proof_submit", idempotencyKey, async () => {
      const [proofRow] = await db
        .insert(academyProof)
        .values({
          academy_task_id: parsed.data.academy_task_id,
          user_id: auth.userId,
          proof_json: parsed.data.proof_json,
          reflection: parsed.data.reflection,
          validation_status: "submitted",
        })
        .returning({ id: academyProof.id });

      if (!proofRow) throw new Error("Failed to store academy proof");

      const result = await validateErectorAcademyProof({
        academyTaskId: parsed.data.academy_task_id,
        userId: auth.userId,
        academyProofId: proofRow.id,
        proofJson: parsed.data.proof_json,
        reflection: parsed.data.reflection,
      });

      return {
        status: 201,
        body: {
          ok: true as const,
          data: {
            academy_proof_id: proofRow.id,
            ...result,
          },
          message: result.validated
            ? "Academy proof accepted."
            : "Academy proof recorded — additional evidence may be required.",
        },
      };
    });

    const [task] = await db
      .select({ blueprint_id: academyTasks.blueprint_id })
      .from(academyTasks)
      .where(eq(academyTasks.id, parsed.data.academy_task_id))
      .limit(1);

    await erectorSuccess(res, outcome.body.data, {
      status: outcome.cached ? 200 : outcome.status,
      message: String(outcome.body.message ?? "Academy proof recorded."),
      blueprintId: task?.blueprint_id,
    });

    await finishErectorApiLog({
      runType: "erector_api_academy_proof",
      req,
      userId: auth.userId,
      blueprintId: task?.blueprint_id,
      startedAt: started,
      statusCode: outcome.cached ? 200 : outcome.status,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

router.get("/gaps/active", async (req, res) => {
  try {
    const started = Date.now();
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId =
      typeof req.query.blueprint_id === "string"
        ? req.query.blueprint_id
        : await getActiveBlueprintId(auth.userId);

    if (!blueprintId) {
      failure(res, "NOT_FOUND", "No active blueprint found", 404);
      return;
    }

    const gaps = await db
      .select()
      .from(erectorCapabilityGaps)
      .where(
        and(
          eq(erectorCapabilityGaps.user_id, auth.userId),
          eq(erectorCapabilityGaps.blueprint_id, blueprintId),
          inArray(erectorCapabilityGaps.status, ["open", "in_academy"]),
        ),
      );

    await erectorSuccess(
      res,
      { blueprint_id: blueprintId, gaps },
      { message: "Open capability gaps loaded.", blueprintId },
    );

    await finishErectorApiLog({
      runType: "erector_api_academy_gaps",
      req,
      userId: auth.userId,
      blueprintId,
      startedAt: started,
      statusCode: 200,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

const capabilityRouter = Router();

capabilityRouter.get("/:capabilityId/profile", async (req, res) => {
  try {
    const started = Date.now();
    const auth = await requireAuth(req, "USER_SESSION");
    const [profile] = await db
      .select()
      .from(erectorCapabilityProfiles)
      .where(
        and(
          eq(erectorCapabilityProfiles.user_id, auth.userId),
          eq(erectorCapabilityProfiles.capability_id, req.params.capabilityId),
        ),
      )
      .limit(1);

    if (!profile) {
      failure(res, "NOT_FOUND", "Capability profile not found", 404);
      return;
    }

    await erectorSuccess(res, profile, {
      message: "Capability profile loaded.",
      blueprintId: profile.blueprint_id,
    });

    await finishErectorApiLog({
      runType: "erector_api_capability_profile",
      req,
      userId: auth.userId,
      blueprintId: profile.blueprint_id,
      startedAt: started,
      statusCode: 200,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

export { capabilityRouter };
export default router;
