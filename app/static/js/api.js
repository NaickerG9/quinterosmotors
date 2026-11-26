export class ApiError extends Error {
  constructor(message, status, code, fields) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields || {};
  }
}

function csrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content || "";
}

export async function api(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = {
    Accept: "application/json",
    ...(options.headers || {}),
  };
  const init = {
    method,
    headers,
    credentials: "same-origin",
    body: undefined,
  };

  if (options.formData) {
    init.body = options.formData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const token = csrfToken();
    if (token) headers["X-CSRFToken"] = token;
  }

  let response;
  try {
    response = await fetch(path, init);
  } catch (error) {
    throw new ApiError(
      "No se pudo conectar con el servidor. Verifica tu conexión.",
      0,
      "RED",
    );
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : null;

  if (!response.ok) {
    if (
      response.status === 401 &&
      !window.location.pathname.startsWith("/login") &&
      path !== "/api/v1/auth/login"
    ) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new ApiError(
      payload?.error?.message || `Error ${response.status}`,
      response.status,
      payload?.error?.code || "ERROR",
      payload?.error?.fields || {},
    );
  }

  return payload;
}

export const get = (path) => api(path);
export const post = (path, body) => api(path, { method: "POST", body });
export const put = (path, body) => api(path, { method: "PUT", body });
export const patch = (path, body) => api(path, { method: "PATCH", body });
export const del = (path) => api(path, { method: "DELETE" });
