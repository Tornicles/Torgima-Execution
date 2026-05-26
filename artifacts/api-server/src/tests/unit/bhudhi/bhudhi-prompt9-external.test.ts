import { describe, it, expect } from "vitest";
import {
  fetchCRMData,
  fetchHRMSData,
  fetchDataPlatformData,
  fetchCommunicationData,
} from "../../../bhudhi/external/externalDataProviders.js";
import {
  findPatterns,
  findAnomalies,
  extractInsights,
} from "../../../bhudhi/external/externalAnalysis.js";
import {
  encryptCredentials,
  normalizeExternalData,
  payloadFromNormalized,
  buildAuthHeaders,
} from "../../../bhudhi/external/externalLogic.js";

describe("BHUDHI PROMPT 9 — External Integration", () => {
  it("provides CRM, HRMS, data platform, and communication payloads", () => {
    expect(fetchCRMData().revenue).toBeDefined();
    expect(fetchHRMSData().employees).toBeDefined();
    expect(fetchDataPlatformData().metrics).toBeDefined();
    expect(fetchCommunicationData().sentiment).toBeDefined();
  });

  it("normalizes external payloads with quality metadata", () => {
    const raw = fetchCRMData();
    const normalized = normalizeExternalData(raw, "crm");
    expect(normalized.source).toBe("crm");
    expect(normalized.normalized).toBe(true);
    expect(normalized.quality_score).toBe(0.95);
    expect(payloadFromNormalized(normalized).deals).toBeDefined();
  });

  it("detects patterns, anomalies, and insights from CRM data", () => {
    const data = fetchCRMData();
    const patterns = findPatterns(data);
    const insights = extractInsights(data);

    expect(patterns).toContain("Revenue is increasing");
    expect(insights).toContain("Revenue forecast is positive");
    expect(insights).toContain("Sales team has high win rate");
  });

  it("flags HRMS turnover and communication sentiment anomalies", () => {
    const hrms = { ...fetchHRMSData(), employees: { total: 10, turnover: 0.2 } };
    expect(findAnomalies(hrms)).toContain("Unusual employee turnover");

    const comm = {
      ...fetchCommunicationData(),
      sentiment: { positive: 0.5, neutral: 0.2, negative: 0.35 },
    };
    expect(findAnomalies(comm)).toContain("Negative sentiment detected");
  });

  it("encrypts credentials and builds auth headers", () => {
    const encrypted = encryptCredentials({
      authType: "oauth",
      accessToken: "test-token",
      apiKey: "key-123",
    });
    expect(encrypted.apiKeyEncrypted.length).toBeGreaterThan(0);
    expect(encrypted.credentialsEncrypted.length).toBeGreaterThan(0);

    const headers = buildAuthHeaders({ apiKey: "key-123" }, encrypted.apiKeyEncrypted);
    expect(headers.Authorization).toBe("Bearer key-123");
  });
});
