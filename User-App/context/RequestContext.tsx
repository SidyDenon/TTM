import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext";
import Toast from "react-native-toast-message";

/* ----------- Types ----------- */
type Photo = {
  uri: string;
  fileName?: string;
  mimeType?: string;
};

type Request = {
  id: number;
  service: string;
  address: string;
  description?: string;
  status: string;
  created_at: string;
};

type RequestContextType = {
  requests: Request[];
  setRequests: React.Dispatch<React.SetStateAction<Request[]>>;
  photos: Photo[];
  setPhotos: React.Dispatch<React.SetStateAction<Photo[]>>;
  loading: boolean;
  fetchRequests: () => Promise<void>;
  createRequest: (data: Omit<Request, "id" | "created_at" | "status">) => Promise<void>;
};

/* ----------- Contexte ----------- */
const RequestContext = createContext<RequestContextType | undefined>(undefined);

/* ----------- Provider ----------- */
export const RequestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const { apiFetch, user } = useAuth();
  const lastErrorRef = useRef<string | null>(null);

  /* ✅ Chargement automatique des requêtes de l’utilisateur connecté */
  useEffect(() => {
    if (user?.role === "user") {
      fetchRequests();
    } else {
      // opérateur/admin : pas de requêtes client
      setRequests([]);
    }
  }, [user]);

  /* 🔄 Récupération des demandes */
  const fetchRequests = useCallback(async () => {
    if (!user || user.role !== "user") return;

    try {
      setLoading(true);
      const data = await apiFetch<{ data?: Request[] }>("/requests");
      setRequests(data.data || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      // éviter de spammer le même toast
      if (lastErrorRef.current !== msg) {
        lastErrorRef.current = msg;
        Toast.show({
          type: "error",
          position: "top",
          text1: "Impossible de charger les missions",
          text2: msg,
          visibilityTime: 3000,
          topOffset: 55,
        });
      }
      console.error("❌ Erreur fetchRequests:", err);
    } finally {
      setLoading(false);
    }
  }, [user, apiFetch]);

  /* 🆕 Création d’une demande */
  const createRequest = useCallback(
    async (data: Omit<Request, "id" | "created_at" | "status">) => {
      if (!user || user.role !== "user") return;
      try {
        setLoading(true);
        const newReq = await apiFetch<Request>("/requests", {
          method: "POST",
          body: JSON.stringify(data),
        });
        setRequests((prev) => [newReq, ...prev]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        Toast.show({
          type: "error",
          position: "top",
          text1: "Création échouée",
          text2: msg,
          visibilityTime: 3000,
          topOffset: 55,
        });
        console.error("❌ Erreur createRequest:", err);
      } finally {
        setLoading(false);
      }
    },
    [apiFetch]
  );

  return (
    <RequestContext.Provider
      value={{
        requests,
        setRequests,
        photos,
        setPhotos,
        loading,
        fetchRequests,
        createRequest,
      }}
    >
      {children}
    </RequestContext.Provider>
  );
};

/* ----------- Hook personnalisé ----------- */
export const useRequest = () => {
  const ctx = useContext(RequestContext);
  if (!ctx) throw new Error("useRequest must be used within a RequestProvider");
  return ctx;
};
