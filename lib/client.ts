export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(url, { ...init, headers, cache: "no-store" });
  if (response.status === 401 && !url.endsWith("/api/auth/login")) {
    window.location.assign("/");
    throw new ApiError("Your session has ended.", 401);
  }
  const type = response.headers.get("content-type") ?? "";
  const data = type.includes("application/json") ? await response.json() : null;
  if (!response.ok) {
    const message = data && typeof data.error === "string" ? data.error : "The portal could not complete that request.";
    throw new ApiError(message, response.status);
  }
  return data as T;
}
