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
        // no-op
        socketRef.current.disconnect();
      }
      socketRef.current = null;
      setIsConnected(false);
      return;
    }

    // déjà créé ?
    if (socketRef.current?.connected) {
      // already connected; keep it simple
      return;
    }

    // Base URL sans /api
    const baseURL = getApiUrl().replace("/api", "");
    // connect silently unless needed for debugging

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
      // socket connected
      setIsConnected(true);
      socket.emit("register", { token });
    });

    socket.on("disconnect", (reason) => {
      // socket disconnected
      setIsConnected(false);
    });

    socket.on("connect_error", (err) => {
      // connection error silently handled
    });

    socket.on("reconnect_attempt", (attempt) => {
      // reconnecting silently
    });

    // Cleanup
    return () => {
      if (socketRef.current) {
        // cleanup complete
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
