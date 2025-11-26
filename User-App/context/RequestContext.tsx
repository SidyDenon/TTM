import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";

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

  /* ✅ Chargement automatique des requêtes de l’utilisateur connecté */
  useEffect(() => {
    if (user) {
      fetchRequests();
    } else {
      setRequests([]); // réinitialise à la déconnexion
    }
  }, [user]);

  /* 🔄 Récupération des demandes */
  const fetchRequests = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const data = await apiFetch<{ data?: Request[] }>("/requests");
      setRequests(data.data || []);
    } catch (err) {
      console.error("❌ Erreur fetchRequests:", err);
    } finally {
      setLoading(false);
    }
  }, [user, apiFetch]);

  /* 🆕 Création d’une demande */
  const createRequest = useCallback(
    async (data: Omit<Request, "id" | "created_at" | "status">) => {
      try {
        setLoading(true);
        const newReq = await apiFetch<Request>("/requests", {
          method: "POST",
          body: JSON.stringify(data),
        });
        setRequests((prev) => [newReq, ...prev]);
      } catch (err) {
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
