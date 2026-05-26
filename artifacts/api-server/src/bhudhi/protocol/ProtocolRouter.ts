import { investigationService } from "../investigation/InvestigationService.js";
import { intelligenceService } from "../intelligence/IntelligenceService.js";
import { securityService } from "../security/SecurityService.js";
import { operatingService } from "../operating/OperatingService.js";
import { preservationService } from "../preservation/PreservationService.js";
import { BhudhiProtocol, bhudhiProtocol } from "./BhudhiProtocol.js";
import { eventBus } from "../kernel/event-bus/EventBus.js";
import { uriToEventType } from "./uriToEventType.js";
import type { ProtocolHandler, StoredProtocolMessage } from "./contracts/types.js";
import { logger } from "../../lib/logger.js";

const DEFAULT_ROUTE_DEFS = [
  {
    pattern: "bhudhi://investigation/*",
    handler: "investigationHandler",
    requestSchema: { blueprintId: "string" },
  },
  {
    pattern: "bhudhi://intelligence/*",
    handler: "intelligenceHandler",
    requestSchema: { blueprintId: "string" },
  },
  {
    pattern: "bhudhi://security/*",
    handler: "securityHandler",
    requestSchema: { recommendation: "object" },
  },
  {
    pattern: "bhudhi://operating/*",
    handler: "operatingHandler",
    requestSchema: { recommendation: "object" },
  },
  {
    pattern: "bhudhi://preservation/*",
    handler: "preservationHandler",
    requestSchema: { blueprintId: "string" },
  },
] as const;

const DEFAULT_CONTRACTS = [
  { engineA: "investigation", engineB: "intelligence", messageTypes: ["complete"], guarantees: ["delivery"] },
  { engineA: "intelligence", engineB: "security", messageTypes: ["recommend"], guarantees: ["delivery"] },
  { engineA: "security", engineB: "operating", messageTypes: ["validate", "approved"], guarantees: ["delivery"] },
  { engineA: "operating", engineB: "preservation", messageTypes: ["execute", "complete"], guarantees: ["delivery"] },
  { engineA: "preservation", engineB: "intelligence", messageTypes: ["learn"], guarantees: ["delivery"] },
] as const;

export class ProtocolRouter {
  private readonly routes = new Map<string, ProtocolHandler>();
  private readonly protocol: BhudhiProtocol;
  private defaultsReady = false;

  constructor(protocol: BhudhiProtocol = bhudhiProtocol) {
    this.protocol = protocol;
  }

  register(pattern: string, handler: ProtocolHandler): void {
    this.routes.set(pattern, handler);
  }

  async ensureDefaults(): Promise<void> {
    if (this.defaultsReady) return;

    for (const def of DEFAULT_ROUTE_DEFS) {
      await this.protocol.registerRoute(
        def.pattern,
        def.handler,
        def.requestSchema,
        { ok: "boolean" },
        `Default route for ${def.pattern}`,
      );
    }

    for (const c of DEFAULT_CONTRACTS) {
      await this.protocol.createContract(c.engineA, c.engineB, [...c.messageTypes], [...c.guarantees]);
    }

    this.register("bhudhi://investigation/*", async (payload, message) => {
      const blueprintId = (payload.blueprintId as string) ?? message.blueprintId;
      const investigations = await investigationService.investigateBlueprint(blueprintId);
      return { investigated: true, investigations };
    });

    this.register("bhudhi://intelligence/*", async (payload, message) => {
      const blueprintId = (payload.blueprintId as string) ?? message.blueprintId;
      const recommendations = await intelligenceService.analyzeAndRecommend(blueprintId);
      return { recommended: true, recommendations };
    });

    this.register("bhudhi://security/*", async (payload) => {
      const rec = payload.recommendation as { id?: string } | undefined;
      if (!rec?.id) return { validated: false, violations: ["No recommendation"] };
      const blueprintId = payload.blueprintId as string;
      const validation = await securityService.validateRecommendation(rec.id, blueprintId);
      return { validated: validation.valid, violations: validation.violations };
    });

    this.register("bhudhi://operating/*", async (payload) => {
      const rec = payload.recommendation as { id?: string } | undefined;
      if (!rec?.id) return { executed: false };
      const result = await operatingService.executeRecommendation(rec.id);
      return { executed: true, result };
    });

    this.register("bhudhi://preservation/*", async (payload, message) => {
      const blueprintId = (payload.blueprintId as string) ?? message.blueprintId;
      const learned = await preservationService.consolidateKnowledge(blueprintId);
      return { learned: true, result: learned };
    });

    this.defaultsReady = true;
  }

  async route(blueprintId: string, messageId: string): Promise<unknown> {
    await this.ensureDefaults();

    const message = await this.protocol.receive(messageId);
    const parsed = this.protocol.parseUri(message.uri);
    const pattern = `bhudhi://${parsed.system}/*`;
    const handler = this.routes.get(pattern);

    if (!handler) {
      await this.protocol.acknowledge(messageId, "failed");
      throw new Error(`No handler for ${pattern}`);
    }

    const valid = await this.protocol.validateMessage(message.uri, message.payload);
    if (!valid) {
      await this.protocol.acknowledge(messageId, "failed");
      throw new Error(`Invalid payload for ${message.uri}`);
    }

    try {
      const result = await handler(message.payload, message);
      await this.protocol.acknowledge(messageId, "processed");

      const eventType = uriToEventType(message.uri);
      if (eventType) {
        await eventBus.publish({
          blueprintId,
          eventType,
          sourceEngine: message.from,
          targetEngine: message.to,
          payload: { ...message.payload, protocolResult: result },
          chainId: `protocol_${messageId}`,
          parentEventId: messageId,
        });
      }

      return result;
    } catch (err) {
      logger.error({ err, messageId, uri: message.uri }, "[ProtocolRouter] route failed");
      await this.protocol.acknowledge(messageId, "failed");
      throw err;
    }
  }

  /** Send protocol message and optionally dispatch to handler + event bus. */
  async sendAndRoute(
    blueprintId: string,
    from: string,
    to: string,
    uri: string,
    payload: Record<string, unknown>,
    messageType: "request" | "response" | "event" | "query" = "event",
    autoRoute = true,
  ): Promise<{ messageId: string; result?: unknown }> {
    await this.ensureDefaults();

    const message = this.protocol.createMessage(from, to, uri, payload, messageType);
    const messageId = await this.protocol.send(blueprintId, message);

    if (!autoRoute) return { messageId };

    const result = await this.route(blueprintId, messageId);
    return { messageId, result };
  }
}

export const protocolRouter = new ProtocolRouter();
