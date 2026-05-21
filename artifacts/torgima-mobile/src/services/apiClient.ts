import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../config";

const AUTH_KEY = "authToken";

export async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem(AUTH_KEY);
}

export async function setAuthToken(token: string | null) {
  if (token) await AsyncStorage.setItem(AUTH_KEY, token);
  else await AsyncStorage.removeItem(AUTH_KEY);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { ...init, headers });

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const err = body as { error?: { message?: string; code?: string } };
    throw new ApiError(
      err?.error?.message ?? `Request failed (${res.status})`,
      res.status,
      err?.error?.code,
    );
  }

  const wrapped = body as { ok?: boolean; data?: T };
  if (wrapped && typeof wrapped === "object" && wrapped.ok === true && "data" in wrapped) {
    return wrapped.data as T;
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
};
