export type Environment = "development" | "staging" | "production";

export interface EnvironmentConfig {
  name: Environment;
  apiUrl: string;
  database: string;
  logging: {
    level: "debug" | "info" | "warn" | "error";
    service: "console" | "file" | "cloud";
  };
  features: {
    monitoring: boolean;
    rateLimit: boolean;
    caching: boolean;
    analytics: boolean;
  };
  limits: {
    requestsPerMinute: number;
    blueprintsPerUser: number;
    enginesParallel: number;
    memoryNodes: number;
  };
  telemetry: {
    enabled: boolean;
    sampleRate: number;
  };
}

function resolveApiUrl(env: Environment): string {
  const override =
    process.env.API_PUBLIC_URL?.trim() ||
    process.env.PUBLIC_API_URL?.trim() ||
    process.env.VITE_API_BASE_URL?.trim();
  if (override) return override.replace(/\/$/, "");

  switch (env) {
    case "production":
      return "https://api.torgima-execution.com";
    case "staging":
      return "https://staging-api.torgima-execution.com";
    default:
      return "http://localhost:3000";
  }
}

const DEFAULT_API_URLS: Record<Environment, string> = {
  development: "http://localhost:3000",
  staging: "https://staging-api.torgima-execution.com",
  production: "https://api.torgima-execution.com",
};

export const environments: Record<Environment, EnvironmentConfig> = {
  development: {
    name: "development",
    apiUrl: DEFAULT_API_URLS.development,
    database: process.env.DATABASE_URL || "",
    logging: { level: "debug", service: "console" },
    features: {
      monitoring: false,
      rateLimit: false,
      caching: false,
      analytics: false,
    },
    limits: {
      requestsPerMinute: 10000,
      blueprintsPerUser: 100,
      enginesParallel: 10,
      memoryNodes: 100000,
    },
    telemetry: { enabled: false, sampleRate: 0 },
  },

  staging: {
    name: "staging",
    apiUrl: DEFAULT_API_URLS.staging,
    database: process.env.DATABASE_URL || "",
    logging: { level: "info", service: "file" },
    features: {
      monitoring: true,
      rateLimit: true,
      caching: true,
      analytics: true,
    },
    limits: {
      requestsPerMinute: 1000,
      blueprintsPerUser: 50,
      enginesParallel: 5,
      memoryNodes: 50000,
    },
    telemetry: { enabled: true, sampleRate: 0.5 },
  },

  production: {
    name: "production",
    apiUrl: DEFAULT_API_URLS.production,
    database: process.env.DATABASE_URL || "",
    logging: { level: "warn", service: "cloud" },
    features: {
      monitoring: true,
      rateLimit: true,
      caching: true,
      analytics: true,
    },
    limits: {
      requestsPerMinute: 100,
      blueprintsPerUser: 10,
      enginesParallel: 2,
      memoryNodes: 10000,
    },
    telemetry: { enabled: true, sampleRate: 0.1 },
  },
};

/** Resolve active deployment environment from ENVIRONMENT / NODE_ENV / VERCEL_ENV. */
export function resolveEnvironmentName(): Environment {
  const explicit = process.env.ENVIRONMENT?.trim().toLowerCase();
  if (explicit === "development" || explicit === "staging" || explicit === "production") {
    return explicit;
  }
  if (process.env.VERCEL_ENV === "preview") return "staging";
  if (process.env.NODE_ENV === "production") return "production";
  return "development";
}

export function getEnvironment(): EnvironmentConfig {
  const name = resolveEnvironmentName();
  const base = environments[name];
  return {
    ...base,
    apiUrl: resolveApiUrl(name),
    database: process.env.DATABASE_URL || base.database,
  };
}
