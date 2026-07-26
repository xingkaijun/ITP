// API 访问层：统一携带 Bearer token，401 时广播登出事件
export const API_BASE = (import.meta.env.VITE_API_BASE || "/api").replace(/\/+$/, "");
export const NBINS_API = (import.meta.env.VITE_NBINS_API_BASE || "").replace(/\/+$/, "");
export const BUILD_TAG = "20260726.3";

let currentToken = "";

export function setAuthToken(token) {
  currentToken = token || "";
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function parseError(response) {
  const body = await response.json().catch(() => null);
  const detail = body && (body.detail || body.error);
  return new ApiError(
    typeof detail === "string" && detail ? detail : `Request failed (${response.status})`,
    response.status,
  );
}

function notifyUnauthorized() {
  window.dispatchEvent(new CustomEvent("itp-unauthorized"));
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (currentToken) headers.Authorization = `Bearer ${currentToken}`;
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (response.status === 401) {
    notifyUnauthorized();
    throw await parseError(response);
  }
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  get: (path) => request(path),
  post: (path, data) =>
    request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data ?? {}),
    }),
  put: (path, data) =>
    request(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data ?? {}),
    }),
  delete: (path) => request(path, { method: "DELETE" }),
  upload: (path, formData) => request(path, { method: "POST", body: formData }),
};

// 二进制下载（Excel / PDF），从 Content-Disposition 提取文件名
export async function downloadFile(path, fallbackName) {
  const headers = currentToken ? { Authorization: `Bearer ${currentToken}` } : {};
  const response = await fetch(`${API_BASE}${path}`, { headers });
  if (response.status === 401) {
    notifyUnauthorized();
    throw await parseError(response);
  }
  if (!response.ok) throw await parseError(response);
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  let filename = fallbackName;
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  if (utf8Match) filename = decodeURIComponent(utf8Match[1]);
  else if (plainMatch) filename = plainMatch[1];
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function errorMessage(error) {
  return error instanceof Error && error.message ? error.message : "Request failed";
}
