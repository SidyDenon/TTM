import { useEffect, useState, useCallback } from "react";

/**
 * Hook personnalisé pour gérer les notifications navigateur.
 * Gère la permission, l'affichage et l'état de support.
 */
export default function usePushNotifications() {
  const [permission, setPermission] = useState(Notification?.permission || "default");
  const [supported, setSupported] = useState(true);

  // Vérifie le support navigateur
  useEffect(() => {
    if (!("Notification" in window)) {
      console.warn("🚫 Les notifications ne sont pas supportées sur ce navigateur.");
      setSupported(false);
    }
  }, []);

  //  Demande la permission à l’utilisateur
  const requestPermission = useCallback(async () => {
    if (!supported) return "unsupported";
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch (err) {
      console.error(" Erreur permission notification:", err);
      return "error";
    }
  }, [supported]);

  //  Envoie une notification locale
  const sendNotification = useCallback(
    (title, options = {}) => {
      if (!supported) return console.warn("Notifications non supportées.");
      if (permission !== "granted") {
        console.warn("Notification refusée. Permission actuelle:", permission);
        return;
      }

      const notif = new Notification(title, {
        body: options.body || "",
        icon: options.icon || "/favicon.ico",
        badge: options.badge || "/favicon.ico",
        tag: options.tag || Date.now(),
        vibrate: options.vibrate || [100, 50, 100],
      });

      notif.onclick = () => {
        console.log(" Notification cliquée !");
        if (options.onClick) options.onClick();
      };

      notif.onclose = () => {
        if (options.onClose) options.onClose();
      };

      return notif;
    },
    [permission, supported]
  );

  return {
    supported,      // booléen
    permission,     // "default" | "granted" | "denied"
    requestPermission,
    sendNotification,
  };
}
