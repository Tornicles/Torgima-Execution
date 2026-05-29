import { vi } from "vitest";

/** Drizzle-style chainable select mock for Bhudhi unit tests. */
export function emptyDbQueryResult(): Promise<unknown[]> & {
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  innerJoin?: ReturnType<typeof vi.fn>;
} {
  const promise = Promise.resolve([]) as unknown as Promise<unknown[]> & {
    orderBy: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    innerJoin?: ReturnType<typeof vi.fn>;
  };
  promise.orderBy = vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) }));
  promise.limit = vi.fn().mockResolvedValue([]);
  promise.innerJoin = vi.fn(() => ({
    where: vi.fn(() => ({
      orderBy: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })),
    })),
  }));
  return promise;
}
