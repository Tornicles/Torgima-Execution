import { describe, expect, it } from "vitest";
import {
  classifyDatabaseProbeError,
  evaluatePoolerExpectations,
  evaluateSupabaseRestUrlIssues,
  extractDatabaseErrorFields,
  parseDatabaseTargetSafe,
  resolveSupabaseRestBaseUrl,
  sanitizeDatabaseErrorMessage,
} from "../../../lib/databaseTargetDebug.js";

describe("databaseTargetDebug", () => {
  it("parses pooler URL without exposing password", () => {
    const target = parseDatabaseTargetSafe(
      "postgresql://postgres.fmynbziciuadnvjlojub:sec%40ret@aws-0-us-west-2.pooler.supabase.com:6543/postgres?sslmode=require",
    );
    expect(target.host).toBe("aws-0-us-west-2.pooler.supabase.com");
    expect(target.port).toBe("6543");
    expect(target.database).toBe("postgres");
    expect(target.usernamePrefix).toBe("postgres.");
    expect(target.projectRef).toBe("fmynbziciuadnvjlojub");
    expect(target.isPoolerHost).toBe(true);
    expect(target.isTransactionPoolerPort).toBe(true);
    expect(target.passwordPresent).toBe(true);
    expect(target.sslEnabled).toBe(true);
  });

  it("flags direct Supabase host as misconfigured for Workers", () => {
    const target = parseDatabaseTargetSafe(
      "postgresql://postgres.fmynbziciuadnvjlojub:pass@db.fmynbziciuadnvjlojub.supabase.co:5432/postgres?sslmode=require",
    );
    const issues = evaluatePoolerExpectations(target);
    expect(target.isPoolerHost).toBe(false);
    expect(issues.some((i) => i.includes("direct Supabase"))).toBe(true);
    expect(issues.some((i) => i.includes("6543"))).toBe(true);
  });

  it("classifies 8s timeout as TIMEOUT", () => {
    const { errorClass } = classifyDatabaseProbeError("connect ETIMEDOUT", 8100);
    expect(errorClass).toBe("TIMEOUT");
  });

  it("sanitizes credentials from error messages", () => {
    const clean = sanitizeDatabaseErrorMessage(
      "connection failed postgresql://postgres:MyP@ss@db.example.com:5432/postgres",
    );
    expect(clean).not.toContain("MyP@ss");
    expect(clean).toContain("postgresql://***@");
  });

  it("extracts postgres error code from drizzle-wrapped errors", () => {
    const err = Object.assign(new Error("Failed query: SELECT 1"), {
      cause: Object.assign(new Error("password authentication failed for user"), { code: "28P01" }),
    });
    const fields = extractDatabaseErrorFields(err);
    expect(fields.error_code).toBe("28P01");
    expect(fields.error_message_safe).toContain("authentication failed");
  });

  it("resolves PostgREST URL from DATABASE_URL project ref when SUPABASE_URL is pooler host", () => {
    const dbUrl =
      "postgresql://postgres.fmynbziciuadnvjlojub:pass@aws-1-us-west-2.pooler.supabase.com:6543/postgres";
    const resolved = resolveSupabaseRestBaseUrl(
      "https://aws-1-us-west-2.pooler.supabase.com",
      dbUrl,
    );
    expect(resolved?.url).toBe("https://fmynbziciuadnvjlojub.supabase.co");
    expect(resolved?.resolvedFrom).toBe("DATABASE_URL_PROJECT_REF");
    expect(resolved?.corrected).toBe(true);
  });

  it("derives REST URL from db.<ref>.supabase.co SUPABASE_URL", () => {
    const resolved = resolveSupabaseRestBaseUrl("https://db.fmynbziciuadnvjlojub.supabase.co");
    expect(resolved?.url).toBe("https://fmynbziciuadnvjlojub.supabase.co");
    expect(resolved?.corrected).toBe(true);
  });

  it("flags pooler hostname in SUPABASE_URL secret", () => {
    const issues = evaluateSupabaseRestUrlIssues(
      "https://aws-1-us-west-2.pooler.supabase.com",
      "postgresql://postgres.fmynbziciuadnvjlojub:pass@aws-1-us-west-2.pooler.supabase.com:6543/postgres",
    );
    expect(issues.some((i) => i.includes("pooler"))).toBe(true);
  });
});
