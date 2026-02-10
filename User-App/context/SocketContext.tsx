import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { Text } from "react-native";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { getApiUrl } from "../config/urls"; // ⚠️ version auto-selection

// -------------------------
// Types
// -------------------------
type SocketContextType = {
  socket: Socket | null;
  isConnected: boolean;
};

type ProviderProps = {
  children: ReactNode;
};

// -------------------------
// Context default
// -------------------------
const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

// -------------------------
// Provider
// -------------------------
export const SocketProvider: React.FC<ProviderProps> = ({ children }) => {
  const { token, user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token || !user) {
      if (socketRef.current) {
        console.log("[SOCKET] Déconnexion car user null");
        socketRef.current.disconnect();
      }
      socketRef.current = null;
      setIsConnected(false);
      return;
    }

    // déjà créé ?
    if (socketRef.current?.connected) {
      console.log("[SOCKET] Déjà connecté, pas de recréation.");
      return;
    }

    // Base URL sans /api
    const baseURL = getApiUrl().replace("/api", "");
    console.log("[SOCKET] Connexion Socket.IO sur :", baseURL);

    const socket = io(baseURL, {
      transports: ["websocket"],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 8000,
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

    socket.on("reconnect_attempt", (attempt) => {
      console.log("🔄 [SOCKET] Reconnect attempt:", attempt);
    });

    // Cleanup
    return () => {
      if (socketRef.current) {
        console.log("🧹 [SOCKET] Cleanup");
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
    };
  }, [token]);

  return (
    <SocketContext.Provider
      value={{ socket: socketRef.current, isConnected }}
    >
      {typeof children === "string" ? <Text>{children}</Text> : children}
    </SocketContext.Provider>
  );
};

// -------------------------
// Hook
// -------------------------
export const useSocket = () => useContext(SocketContext);
