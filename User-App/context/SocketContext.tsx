import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { API_URL } from "../utils/api";

type SocketContextType = {
  socket: Socket | null;
  isConnected: boolean;
};

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token || !user) {
      if (socketRef.current) {
        console.log("[SOCKET] Déconnexion car utilisateur null.");
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // 🛑 Empêche double création
    if (socketRef.current?.connected) {
      console.log("[SOCKET] Déjà connecté, aucune recréation.");
      return;
    }

    const baseURL = API_URL.replace("/api", "");
    console.log("[SOCKET] Initialisation Socket.IO sur :", baseURL);

    const socket = io(baseURL, {
      transports: ["websocket"],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ [SOCKET] Connecté :", socket.id);
      setIsConnected(true);
      socket.emit("register", { token });
    });

    socket.on("disconnect", (reason) => {
      console.log("⚠️ [SOCKET] Déconnecté :", reason);
      setIsConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.warn("❌ [SOCKET] Erreur connexion :", err.message);
    });

    return () => {
      if (socketRef.current) {
        console.log("🧹 [SOCKET] Cleanup (démontage contexte)");
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
    };
  }, [token]); // ✅ Ne dépend que du token

  const safeChildren =
    typeof children === "string" ? <Text>{children}</Text> : children || null;

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
      {safeChildren}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
