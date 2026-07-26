import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { API_BASE, NBINS_API, setAuthToken } from "./api";

const STORAGE_KEY = "itp.auth.v1";
const LOCAL_TTL_MS = 8 * 60 * 60 * 1000; // 本地 token 与后端 8h 有效期一致

function decodeJwtExp(token) {
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw);
    if (!stored?.token || !stored?.expiresAt) return null;
    if (Date.now() >= stored.expiresAt - 30_000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return stored;
  } catch {
    return null;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const stored = loadStored();
    if (stored) setAuthToken(stored.token);
    return stored;
  });

  const persist = useCallback((next) => {
    setSession(next);
    setAuthToken(next?.token || "");
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const loginWithNbins = useCallback(
    async (username, password) => {
      if (!NBINS_API) {
        throw new Error("NBINS login is not configured (VITE_NBINS_API_BASE).");
      }
      const response = await fetch(`${NBINS_API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        const detail = typeof result.error === "string" ? result.error : "Invalid username or password";
        throw new Error(detail);
      }
      const nbinsUser = result.data.user;
      const token = result.data.token;
      persist({
        token,
        source: "nbins",
        role: nbinsUser.role === "admin" || nbinsUser.role === "manager" ? "admin" : "user",
        user: nbinsUser.displayName || nbinsUser.username,
        expiresAt: decodeJwtExp(token) ?? Date.now() + LOCAL_TTL_MS,
      });
    },
    [persist],
  );

  const loginWithLocal = useCallback(
    async (password) => {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof result.detail === "string" ? result.detail : "Invalid password");
      }
      persist({
        token: result.token,
        source: "local",
        role: result.role,
        user: result.user,
        expiresAt: Date.now() + LOCAL_TTL_MS,
      });
    },
    [persist],
  );

  const logout = useCallback(() => persist(null), [persist]);

  // API 层遇到 401 时广播；到期或密钥轮换后自动登出
  useEffect(() => {
    const handler = () => persist(null);
    window.addEventListener("itp-unauthorized", handler);
    return () => window.removeEventListener("itp-unauthorized", handler);
  }, [persist]);

  const value = useMemo(
    () => ({
      session,
      isLoggedIn: Boolean(session),
      role: session?.role || "user",
      isAdmin: session?.role === "admin",
      user: session?.user || "",
      loginWithNbins,
      loginWithLocal,
      logout,
    }),
    [session, loginWithNbins, loginWithLocal, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
