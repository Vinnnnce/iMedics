/**
 * API fetch helper for client-side requests.
 */

const API_BASE = "/api";

export class ApiError extends Error {
  /** The parsed error response body, when the server sent JSON. */
  body?: unknown;

  constructor(public status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.body = body;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    let body: unknown;
    try {
      body = await response.json();
      const errorBody = body as {
        issues?: { message?: string }[];
        error?: string;
        message?: string;
      };
      message = errorBody.issues?.[0]?.message || errorBody.error || errorBody.message || message;
    } catch {
      // ignore
    }
    throw new ApiError(response.status, message, body);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(endpoint: string) =>
    request<T>(endpoint, { method: "GET" }),

  post: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: "DELETE",
      body: data ? JSON.stringify(data) : undefined,
    }),
};
