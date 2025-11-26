// src/utils/socket.js
import { io } from "socket.io-client";
import { API_BASE } from "../config/urls";

// ✅ Crée une instance globale et stable du socket
export const socket = io(API_BASE, {
  transports: ["websocket"],
  autoConnect: false, // ❌ pas de connexion auto avant authentification
  reconnection: true, // ✅ permet la reconnexion automatique
  reconnectionAttempts: 10, // 🔁 jusqu’à 10 essais
  reconnectionDelay: 1500, // ⏳ délai entre les tentatives
});

// ✅ Méthode pour se connecter avec un token JWT
export const connectSocket = (token) => {
  if (!token) {
    console.warn("⚠️ Aucun token fourni, socket non connecté");
    return;
  }

  // 🔐 Envoie le token au handshake
  socket.auth = { token };

  if (!socket.connected) {
    socket.connect();
  }
};

// ✅ Déconnexion propre
export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};

// 🧠 Logs pour le débogage
socket.on("connect", () => {
  console.log("🟢 Socket connecté :", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("🔴 Socket déconnecté :", reason);
});

socket.on("reconnect_attempt", (attempt) => {
  console.log(`♻️ Tentative de reconnexion (${attempt})...`);
});

socket.on("connect_error", (err) => {
  console.warn("⚠️ Erreur socket :", err.message);
});
