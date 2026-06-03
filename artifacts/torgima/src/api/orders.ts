import { apiRequest, generateIdempotencyKey } from "./client";
import type { ApiResponse } from "./types";

export function fetchCurrentOrder(): Promise<ApiResponse<{ order: Record<string, unknown> | null }>> {
  return apiRequest("/api/orders/current");
}

export function fetchOrderDetail(orderId: string): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest(`/api/orders/${orderId}`);
}

export function startOrder(
  orderId: string,
  expectedStateVersion: number,
  idempotencyKey = generateIdempotencyKey("order-start"),
): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest(`/api/orders/${orderId}/start`, {
    method: "POST",
    body: { expectedStateVersion, idempotencyKey },
    expectedStateVersion,
    idempotencyKey,
  });
}

export function uploadProofFile(input: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  orderId?: string;
  blueprintId?: string;
}): Promise<string> {
  return apiRequest<{ fileId: string }>("/api/uploads/proof", {
    method: "POST",
    body: {
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      orderId: input.orderId,
      blueprintId: input.blueprintId,
      idempotencyKey: generateIdempotencyKey("proof-upload"),
    },
  }).then((res) => {
    if (!res.ok || !res.data?.fileId) {
      throw new Error(res.error?.message ?? "Upload failed");
    }
    return res.data.fileId;
  });
}

export function submitOrderFeedback(
  orderId: string,
  payload: Record<string, unknown> & { expectedStateVersion: number },
): Promise<ApiResponse<Record<string, unknown>>> {
  const idempotencyKey =
    typeof payload.idempotencyKey === "string"
      ? payload.idempotencyKey
      : generateIdempotencyKey("feedback");
  return apiRequest(`/api/orders/${orderId}/feedback`, {
    method: "POST",
    body: { ...payload, idempotencyKey },
    expectedStateVersion: payload.expectedStateVersion,
    idempotencyKey,
  });
}
