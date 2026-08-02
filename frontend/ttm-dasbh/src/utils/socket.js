import { io } from "socket.io-client";
import { getApiBase } from "../config/urls";

// Instance globale initialisée à la demande (prend la valeur courante de l'API après initApiBase)
let socket = null;

const getSocket = () => {
  if (socket) return socket;
  const url = getApiBase(); // host sans /api
  socket = io(url, {
    transports: ["websocket"],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1500,
  });

  // Logs debug
  socket.on("connect", () => console.log("🟢 Socket connecté :", socket.id));
  socket.on("disconnect", (reason) => console.log(" Socket déconnecté :", reason));
  socket.on("reconnect_attempt", (attempt) => console.log(`♻️ Tentative de reconnexion (${attempt})...`));
  socket.on("connect_error", (err) => console.warn(" Erreur socket :", err.message));

  return socket;
};

// Expose instance for listeners without forcing a connect
export const getSocketInstance = () => getSocket();

// Connexion sécurisée avec token
export const connectSocket = (token) => {
  if (!token) {
    console.warn(" Aucun token fourni, socket non connecté");
    return;
  }
  const s = getSocket();
  s.auth = { token };
  if (!s.connected) s.connect();
};

// Déconnexion
export const disconnectSocket = () => {
  if (socket?.connected) {
    socket.disconnect();
  }
};

// Export facultatif si certains modules ont besoin d'accéder à l'instance
export { socket };
