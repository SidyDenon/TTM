import { useEffect } from "react";
import * as Haptics from "expo-haptics";
import { API_URL } from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import Notifications, { getExpoPushTokenSafe } from "../lib/expoNotifications";
import {
  canUseNotifications as notificationsAvailable,
  requestNotificationPermission,
  setupNotificationChannel,
  showLocalNotification,
} from "../lib/notifications";

/**
 * Hook de notifications temps réel pour l'opérateur
 * @param {Object} options
 * @param {Function} options.onRefreshWallet - callback pour recharger le solde
 * @param {Function} options.onOpenWithdrawals - callback navigation vers les retraits
 */
export default function useNotifications(options = {}) {
  const { token, user } = useAuth();
  const { socket } = useSocket();

  useEffect(() => {
    if (!token || !socket) return;

    // 1️⃣ Enregistre le token Expo push (si disponible)
    if (notificationsAvailable) {
      registerForPushNotificationsAsync().then(async (expoPushToken) => {
        if (expoPushToken && token) {
          await fetch(`${API_URL}/user/push-token`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ token: expoPushToken }),
          });
        }
      });
    } else {
      console.log("⚠️ Notifications indisponibles sur cette build (Expo Go ?)");
    }

    // 3️⃣ Gestion des événements temps réel
    const handleWithdrawalUpdate = async (data) => {
      console.log("💬 Retrait mis à jour :", data);

      await triggerNotification("💸 Retrait mis à jour", data.message);

      // Recharge le solde ou les retraits (optionnel)
      options.onRefreshWallet?.();
    };

    const handleMissionUpdated = async (data) => {
      if (!data?.id) return;
      if (
        user?.id &&
        data.operator_id &&
        Number(data.operator_id) !== Number(user.id)
      ) {
        return;
      }
      console.log("🚨 mission:updated (notifications)", data);
      await triggerNotification(
        "🚨 Nouvelle mission",
        data.message || `Mission #${data.id}`
      );
    };

    // Écoute les événements
    socket.on("withdrawal_update", handleWithdrawalUpdate);
    socket.on("mission:updated", handleMissionUpdated);

    // 4️⃣ Si l'utilisateur clique une notif → ouvre retraits
    const tapSub = notificationsAvailable && Notifications
      ? Notifications.addNotificationResponseReceivedListener((resp) => {
          const type = resp.notification.request.content.data?.type;
          if (type === "withdrawal_update") {
            options.onOpenWithdrawals?.();
          }
        })
      : null;

    // Cleanup
    return () => {
      socket.off("withdrawal_update", handleWithdrawalUpdate);
      socket.off("mission:updated", handleMissionUpdated);
      tapSub?.remove();
    };
  }, [token, socket, user?.id, options]);
}

// 🔔 Notification locale + vibration
async function triggerNotification(title, body) {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await showLocalNotification(
      title,
      body ?? (title.includes("Retrait") ? "Nouvelle mise à jour de retrait" : "Nouvelle notification")
    );
  } catch (err) {
    console.error("❌ Erreur triggerNotification:", err);
  }
}

// 📱 Enregistrement du token Expo
async function registerForPushNotificationsAsync() {
  if (!notificationsAvailable) return null;

  const permission = await requestNotificationPermission();
  if (!permission.granted) {
    return null;
  }

  await setupNotificationChannel();
  const result = await getExpoPushTokenSafe();
  if (!result.token) {
    console.log("⚠️ Impossible d'obtenir un token push:", result.reason);
    return null;
  }

  console.log("🎯 Expo Push Token:", result.token);
  return result.token;
}
