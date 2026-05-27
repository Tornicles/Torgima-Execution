import { describe, expect, it } from "vitest";
import { BhudhiMemoryService } from "../../../bhudhi/BhudhiMemoryService.js";
import { ZoneRouter } from "../../../bhudhi/ZoneRouter.js";
import { DomainIntelligenceService } from "../../../bhudhi/DomainIntelligenceService.js";
import { getContract } from "../../../bhudhi/PromptRegistry.js";

describe("BHUDHI upgrade prompts 1-4", () => {
  it("BhudhiMemoryService rejects credential patterns in writeMemory", async () => {
    const id = await BhudhiMemoryService.writeMemory({
      userId: "00000000-0000-4000-8000-000000000001",
      memoryType: "USER_PREFERENCE",
      scope: "USER",
      content: "my apikey is secret-password",
      sourceType: "FEEDBACK",
      sourceId: "00000000-0000-4000-8000-000000000099",
      confidence: "LOW",
    });
    expect(id).toBeNull();
  });

  it("summarizeForContext formats memory block", () => {
    const text = BhudhiMemoryService.summarizeForContext([
      {
        id: "1",
        userId: "u",
        memoryType: "USER_PREFERENCE",
        scope: "USER",
        content: "Morning execution",
        sourceType: "FEEDBACK",
        confidence: "HIGH",
        relevanceScore: 0.9,
        createdAt: new Date(),
      },
    ]);
    expect(text).toContain("[Memory context]");
    expect(text).toContain("Preference:");
  });

  it("ZoneRouter maps TASK_DRAFTING to EXECUTION ZONE", () => {
    expect(ZoneRouter.getZoneForTrigger("TASK_DRAFTING")).toBe("EXECUTION ZONE");
  });

  it("DomainIntelligenceService exposes domain profiles", () => {
    const profile = DomainIntelligenceService.getDomainProfile("market");
    expect(profile.domain).toBe("MARKET");
    expect(profile.taskStyle).toContain("validate");
  });

  it("registers EIS and PIS prompt contracts", () => {
    expect(getContract("EXTERNAL_INTELLIGENCE_SCAN")?.name).toBe("eis.scan.v1");
    expect(getContract("PREDICTIVE_ANALYSIS")?.name).toBe("pis.analysis.v1");
  });
});
