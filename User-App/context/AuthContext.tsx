import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../utils/api";
import { initApiBase } from "../config/urls";

type User = {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  role?: string;
  must_change_password?: number;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<User>;
  register: (name: string, phone: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  apiFetch: <T = any>(endpoint: string, options?: RequestInit) => Promise<T>;
  refreshUser: (customToken?: string) => Promise<User | null>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 🔄 Charger la session locale
  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      try {
        // s'assure que l'API (local/prod) est initialisée avant toute requête /me
        await initApiBase();
        const storedToken = await AsyncStorage.getItem("token");
        const storedUser = await AsyncStorage.getItem("user");

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));

          // Sécurité : timeout pour ne pas bloquer le chargement si le backend ne répond pas
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const res = await fetch(`${API_URL}/me`, {
            headers: { Authorization: `Bearer ${storedToken}` },
            signal: controller.signal,
          }).finally(() => clearTimeout(timeout));

          if (res.status === 401) {
            await logout();
          } else if (res.ok) {
            const data = await res.json();
            const u = (data && (data.user || data)) || null;
            if (active) {
              setUser(u);
              if (u) {
                await AsyncStorage.setItem("user", JSON.stringify(u));
              } else {
                await AsyncStorage.removeItem("user");
              }
            }
          } else {
            // Erreur temporaire (503, réseau, etc.) : on garde la session locale
            console.warn("⚠️ Impossible de rafraîchir la session (statut)", res.status);
          }
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          console.error("❌ Erreur loadSession:", err);
        }
        // ne pas forcer logout sur erreur réseau : on garde la session locale
      } finally {
        if (active) setLoading(false);
      }
    };

    loadSession();
    return () => {
      active = false;
    };
  }, []);

  // 🔁 Rafraîchir les infos user
  const refreshUser = async (customToken?: string): Promise<User | null> => {
    try {
      const t = customToken || token;
      if (!t) return null;

      const res = await fetch(`${API_URL}/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });

      if (res.status === 401) {
        await logout();
        return null;
      }
      if (!res.ok) {
        // Erreur non auth : on garde la session locale
        console.warn("⚠️ refreshUser non 200 :", res.status);
        return user;
      }

      const data = await res.json();
      const u = (data && (data.user || data)) || null;
      setUser(u);
      if (u) {
        await AsyncStorage.setItem("user", JSON.stringify(u));
      } else {
        await AsyncStorage.removeItem("user");
      }
      return u;
    } catch (err) {
      console.error("❌ Erreur refreshUser:", err);
      // on ne force pas le logout sur erreur réseau
      return user;
    }
  };

  // 👤 Connexion
  const login = async (identifier: string, password: string): Promise<User> => {
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });

    const text = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      /* laisse data vide */
    }

    if (!res.ok) {
      const msg =
        data?.error ||
        data?.message ||
        (res.status === 401
          ? "Identifiants incorrects ou utilisateur introuvable."
          : `Erreur ${res.status}: connexion impossible`);
      throw new Error(msg);
    }

    if (!data.token || !data.user) {
      throw new Error("Réponse invalide du serveur (login)");
    }

    setToken(data.token);
    setUser(data.user);
    await AsyncStorage.setItem("token", data.token);
    await AsyncStorage.setItem("user", JSON.stringify(data.user));

    return data.user as User;
  };

  // 📝 Inscription
  const register = async (name: string, phone: string, password: string): Promise<User> => {
    const res = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, password }),
    });

    const data = await res.json();
    if (!data.user) throw new Error("Réponse invalide du serveur (register)");
    return data.user as User;
  };

  // 🚪 Déconnexion
  const logout = async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.multiRemove(["token", "user"]);
  };

  // 🌍 API centralisée typée
  const apiFetch = async <T = any>(endpoint: string, options: RequestInit = {}): Promise<T> => {
    const storedToken = token || (await AsyncStorage.getItem("token"));
    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        ...(storedToken ? { Authorization: `Bearer ${storedToken}` } : {}),
      },
    });

    if (res.status === 401) {
      console.log("⚠️ Session expirée — déconnexion automatique");
      setTimeout(async () => await logout(), 300);
      throw new Error("Session expirée, veuillez vous reconnecter.");
    }

    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Réponse invalide du serveur: ${text}`);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, logout, apiFetch, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
