// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config/urls";
import { connectSocket, disconnectSocket } from "../utils/socket";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// util JSON-safe
async function jsonSafe(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  const t = await res.text();
  try { return JSON.parse(t); } catch { return { __raw: t }; }
}

// fetch avec timeout
function fetchWithTimeout(url, opts = {}, ms = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...opts, signal: controller.signal })
    .finally(() => clearTimeout(id));
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState("checking"); // checking | authenticated | guest
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");

  // helper centralisé
  const authFetch = async (path, init = {}, tkn = token) => {
    const res = await fetchWithTimeout(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers || {}),
        ...(tkn ? { Authorization: `Bearer ${tkn}` } : {}),
      },
    }, init.timeout ?? 15000);
    return res;
  };

  // charge l'identité (NOTE: /api/auth/me)
  const loadMe = async (tkn) => {
    if (!tkn) {
      setUser(null);
      setStatus("guest");
      return;
    }
    try {
      const res = await authFetch(`/api/admin/me`, {}, tkn);
      if (res.status === 401) throw new Error("Unauthorized");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const me = await jsonSafe(res);

      // Normaliser permissions éventuelles (array)
      let perms = me?.permissions ?? [];
      if (perms && !Array.isArray(perms)) {
        perms = Object.keys(perms).filter((k) => !!perms[k]);
      }

      const normalizedUser = {
        id: me.id,
        name: me.name,
        email: me.email,
        phone: me.phone,
        role: me.role,                 // "admin" | "client" | "operator"...
        is_super: !!me.is_super,       // si fourni par backend quand admin
        role_name: me.role_name || null,
        permissions: perms,            // permissions admin si middleware les ajoute
        must_change_password: !!me.must_change_password,
      };

      setUser(normalizedUser);
      setStatus("authenticated");
      connectSocket(tkn);
    } catch (e) {
      // token invalide/expiré
      disconnectSocket();
      localStorage.removeItem("token");
      setToken("");
      setUser(null);
      setStatus("guest");
    }
  };

  useEffect(() => {
    loadMe(token);
    return () => disconnectSocket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ LOGIN sur /api/auth/login (identifier + password)
  const login = async (identifier, password) => {
    const res = await fetchWithTimeout(`${API_BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    }, 15000);

    const data = await jsonSafe(res);
    if (!res.ok) {
      const msg = data?.error || data?.message || data?.__raw || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    const newToken = data.token;
    if (!newToken) throw new Error("Token manquant");

    localStorage.setItem("token", newToken);
    setToken(newToken);
    setStatus("checking");
    await loadMe(newToken);

    // tu peux retourner le flag must_change_password si tu veux rediriger
    return { ok: true, must_change_password: !!data?.user?.must_change_password };
  };

  const logout = () => {
    disconnectSocket();
    localStorage.removeItem("token");
    setToken("");
    setUser(null);
    setStatus("guest");
  };

  // RBAC helpers
  const can = (perm) => {
    if (!perm) return true;
    if (user?.is_super) return true;
    return !!user?.permissions?.includes(perm);
  };
  const canAll = (perms = []) => {
    if (user?.is_super) return true;
    return perms.every((p) => user?.permissions?.includes(p));
  };

  const value = useMemo(
    () => ({
      status,
      user,
      token,
      login,
      logout,
      can,
      canAll,
      isSuper: !!user?.is_super,
      mustChangePassword: !!user?.must_change_password,
    }),
    [status, user, token, login, logout, can, canAll]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
