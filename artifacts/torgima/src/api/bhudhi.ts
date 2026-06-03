import { apiRequest } from "./client";
import type { ApiResponse } from "./types";

export function postExplainState(input: {
  blueprintId: string;
  focus?: string | null;
}): Promise<ApiResponse<{ explanation?: string | null; fallbackUsed?: boolean }>> {
  return apiRequest("/api/bhudhi/explain-state", {
    method: "POST",
    body: {
      blueprintId: input.blueprintId,
      focus: input.focus ?? null,
    },
  });
}
