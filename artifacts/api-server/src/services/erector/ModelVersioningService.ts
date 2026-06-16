import { eq } from "drizzle-orm";
import { db, erectorModelVersions } from "@workspace/db";
import { ERECTOR_EVENTS } from "../../lib/erector-event-types.js";
import { EVENT_TYPES, writeEvent } from "../EventService.js";

const DEFAULT_COMPONENT_VERSIONS: Record<string, string> = {
  validation_model: "v0.1",
  simulation_model: "v0.1",
  economic_type_model: "v0.1",
  archetype_rule_pack: "v0.1",
  academy_rule: "v0.1",
  outcome_validation: "v0.1",
  framework_rule: "v0.1",
  signal_calculation: "v0.1",
  proof_standard: "v0.1",
  threshold_matrix: "v0.1",
};

export class ModelVersioningService {
  static async getCurrentVersions(): Promise<Record<string, string>> {
    const rows = await db.select().from(erectorModelVersions);
    if (rows.length === 0) {
      return { ...DEFAULT_COMPONENT_VERSIONS };
    }

    const versions = { ...DEFAULT_COMPONENT_VERSIONS };
    for (const row of rows) {
      versions[row.component] = row.current_version;
    }
    return versions;
  }

  static async updateVersion(
    component: string,
    newVersion: string,
    changelog: string,
    activatedBy: string,
  ): Promise<void> {
    const [existing] = await db
      .select()
      .from(erectorModelVersions)
      .where(eq(erectorModelVersions.component, component))
      .limit(1);

    if (existing) {
      await db
        .update(erectorModelVersions)
        .set({
          previous_version: existing.current_version,
          current_version: newVersion,
          changelog,
          activated_at: new Date(),
          activated_by: activatedBy,
        })
        .where(eq(erectorModelVersions.component, component));
    } else {
      await db.insert(erectorModelVersions).values({
        component,
        current_version: newVersion,
        changelog,
        activated_by: activatedBy,
      });
    }

    await writeEvent({
      eventType: EVENT_TYPES.ERECTOR_MODEL_VERSION_UPDATED,
      entityType: "erector_model_version",
      entityId: component,
      payload: {
        component,
        previous_version: existing?.current_version ?? null,
        current_version: newVersion,
        changelog,
        activated_by: activatedBy,
      },
      idempotencyKey: `erector_model_version_updated:${component}:${newVersion}`,
    });
  }
}
