import { describe, it, expect, vi } from "vitest";
import { benchScale } from "./benchScale.js";

const BP = "00000000-0000-4000-8000-00000000b038p";
const messagesStore: Array<Record<string, unknown>> = [];

vi.mock("@workspace/db", () => {
  const T = { messages: Symbol("messages") };
  const empty = (data: unknown[] = []) => {
    const p = Promise.resolve(data) as Promise<unknown[]> & { orderBy: ReturnType<typeof vi.fn>; limit: ReturnType<typeof vi.fn> };
    p.orderBy = vi.fn(() => ({ limit: vi.fn().mockResolvedValue(data) }));
    p.limit = vi.fn().mockResolvedValue(data);
    return p;
  };
  return {
    db: {
      insert: vi.fn(() => ({
        values: vi.fn((vals: Record<string, unknown>) => {
          const row = {
            id: `msg-${messagesStore.length}`,
            sent_at: new Date(),
            status: "sent",
            ...vals,
          };
          messagesStore.push(row);
          return { returning: vi.fn().mockResolvedValue([row]) };
        }),
      })),
      select: vi.fn((projection?: Record<string, unknown>) => ({
        from: vi.fn(() => ({
          where: vi.fn(() => {
            if (projection && "maxSeq" in projection) {
              const max = messagesStore.reduce(
                (m, r) => Math.max(m, Number(r.sequence_number ?? 0)),
                0,
              );
              return empty([{ maxSeq: max }]);
            }
            return empty([...messagesStore]);
          }),
        })),
      })),
    },
    bhudhiProtocolMessages: T.messages,
    bhudhiProtocolRoutes: {},
  };
});

describe("BHUDHI Prompt 38 — Protocol benchmarks", () => {
  it("sends benchmark message volume", async () => {
    const messageCount = benchScale(1000, 100);
    const { BhudhiProtocol } = await import("../../bhudhi/protocol/BhudhiProtocol.js");
    const protocol = new BhudhiProtocol();
    const start = Date.now();
    await Promise.all(
      Array.from({ length: messageCount }, (_, i) =>
        protocol.send(
          BP,
          protocol.createMessage("benchmark", "broadcast", "bhudhi://test/message", { index: i }),
        ),
      ),
    );
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(2000);
    expect(messagesStore.length).toBe(messageCount);
  });
});
