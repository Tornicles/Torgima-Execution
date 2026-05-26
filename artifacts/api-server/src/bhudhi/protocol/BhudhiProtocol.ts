import {
  fetchProtocolHistory,
  fetchProtocolMessage,
  fetchProtocolRouteByPattern,
  getNextSequenceNumber,
  hasProtocolContract,
  listProtocolRoutes,
  persistProtocolMessage,
  updateProtocolMessageStatus,
  upsertProtocolContract,
  upsertProtocolRoute,
} from "./protocolData.js";
import type {
  BhudhiMessage,
  ParsedBhudhiUri,
  ProtocolMessageType,
  StoredProtocolMessage,
} from "./contracts/types.js";

export class BhudhiProtocol {
  parseUri(uri: string): ParsedBhudhiUri {
    const match = uri.match(/^bhudhi:\/\/([^/]+)\/([^?]+)(?:\?(.*))?$/);
    if (!match) {
      throw new Error(`Invalid BHUDHI URI: ${uri}`);
    }

    const [, system, action, queryString] = match;
    const params: Record<string, string> = {};
    if (queryString) {
      for (const part of queryString.split("&")) {
        const [key, value] = part.split("=");
        if (key) params[decodeURIComponent(key)] = decodeURIComponent(value ?? "");
      }
    }

    return { system, action, params };
  }

  createMessage(
    from: string,
    to: string,
    uri: string,
    payload: Record<string, unknown>,
    messageType: ProtocolMessageType = "event",
  ): BhudhiMessage {
    return {
      version: "1.0",
      messageType,
      from,
      to,
      uri,
      payload,
    };
  }

  getRouteId(uri: string): string {
    return uri.split("?")[0];
  }

  patternForUri(uri: string): string {
    const { system } = this.parseUri(uri);
    return `bhudhi://${system}/*`;
  }

  async send(blueprintId: string, message: BhudhiMessage): Promise<string> {
    const sequenceNumber = await getNextSequenceNumber(blueprintId);
    const routeId = this.getRouteId(message.uri);
    const stored = await persistProtocolMessage(blueprintId, message, routeId, sequenceNumber);
    return stored.id;
  }

  async receive(messageId: string): Promise<StoredProtocolMessage> {
    const message = await fetchProtocolMessage(messageId);
    if (!message) {
      throw new Error(`Message not found: ${messageId}`);
    }
    return message;
  }

  async acknowledge(
    messageId: string,
    status: "processed" | "failed" | "delivered" = "processed",
  ): Promise<StoredProtocolMessage | null> {
    const message = await fetchProtocolMessage(messageId);
    if (!message) return null;

    const latencyMs = Date.now() - message.sentAt.getTime();
    return updateProtocolMessageStatus(messageId, status, latencyMs);
  }

  async registerRoute(
    pattern: string,
    handler: string,
    requestSchema: Record<string, unknown> = {},
    responseSchema: Record<string, unknown> = {},
    description?: string,
  ) {
    return upsertProtocolRoute(
      pattern,
      handler,
      requestSchema,
      responseSchema,
      description ?? `Route for ${pattern}`,
    );
  }

  async getRoute(uri: string) {
    const pattern = this.patternForUri(uri);
    return fetchProtocolRouteByPattern(pattern);
  }

  async validateMessage(uri: string, payload: Record<string, unknown>): Promise<boolean> {
    const route = await this.getRoute(uri);
    if (!route) return false;
    return this.validateAgainstSchema(payload, route.requestSchema);
  }

  async createContract(
    engineA: string,
    engineB: string,
    messageTypes: string[],
    guarantees: string[],
  ) {
    await upsertProtocolContract(engineA, engineB, messageTypes, guarantees);
    return { engineA, engineB, messageTypes, guarantees, active: true };
  }

  async hasContract(engineA: string, engineB: string): Promise<boolean> {
    return hasProtocolContract(engineA, engineB);
  }

  async getHistory(
    blueprintId: string,
    from?: string,
    to?: string,
    limit = 100,
  ): Promise<StoredProtocolMessage[]> {
    return fetchProtocolHistory(blueprintId, from, to, limit);
  }

  async listRoutes() {
    return listProtocolRoutes();
  }

  private validateAgainstSchema(data: Record<string, unknown>, schema: Record<string, unknown>): boolean {
    if (!schema || Object.keys(schema).length === 0) return true;
    return !!data && typeof data === "object";
  }
}

export const bhudhiProtocol = new BhudhiProtocol();
