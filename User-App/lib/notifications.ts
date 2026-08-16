import { Alert, Platform } from "react-native";
import Notifications, { isExpoGo } from "./expoNotifications";

const DEFAULT_NOTIFICATION_SOUND = "default";
const CUSTOM_NOTIFICATION_SOUND = "notify.wav";
const DEFAULT_CHANNEL_ID = "default";
// Nouveau canal: Android ne permet pas de modifier le son d'un canal déjà créé.
const MISSION_CHANNEL_ID = "mission_v3";

let expoGoWarned = false;
const warnExpoGo = () => {
  if (expoGoWarned) return;
  expoGoWarned = true;
  console.log(" Expo Go détecté — notifications push/système désactivées dans ce mode");
};

if (!Notifications) {
  warnExpoGo();
}

export async function requestNotificationPermission() {
  if (!Notifications) {
    warnExpoGo();
    return { granted: false, reason: "expo-go" };
  }

  const { status } = await Notifications.getPermissionsAsync();
  const granted = status === "granted";
  if (!granted) {
    const { status: requestedStatus } = await Notifications.requestPermissionsAsync();
    if (requestedStatus === "granted") {
      return { granted: true, reason: "ok" };
    }
    Alert.alert(
      "Autorisation requise",
      " Autorisez les notifications pour suivre vos missions."
    );
    return { granted: false, reason: "denied" };
  }

  return { granted: true, reason: "ok" };
}

export async function setupNotificationChannel() {
  if (!Notifications || Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
    name: "Notifications TowTruck",
    importance: Notifications.AndroidImportance.HIGH,
  });
  await Notifications.setNotificationChannelAsync(MISSION_CHANNEL_ID, {
    name: "Missions TowTruck",
    importance: Notifications.AndroidImportance.HIGH,
    sound: CUSTOM_NOTIFICATION_SOUND,
  });
}

function isMissionRelatedNotification(title: string) {
  const text = `${title}`.toLowerCase();
  return text.includes("mission") || text.includes("missions");
}

function isClientCancellationNotification(title: string, body = "") {
  const text = `${title} ${body}`.toLowerCase();
  return text.includes("annulee_client") || text.includes("annulée par le client");
}

export async function showLocalNotification(title: string, body: string) {
  if (!Notifications) {
    warnExpoGo();
    return;
  }

  // Règle produit: ne jamais notifier l'annulation faite par le client.
  if (isClientCancellationNotification(title, body)) {
    return;
  }

  if (Platform.OS === "android") {
    await setupNotificationChannel();
  }

  const isMissionNotification = isMissionRelatedNotification(title);
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: isMissionNotification ? CUSTOM_NOTIFICATION_SOUND : DEFAULT_NOTIFICATION_SOUND,
    },
    trigger:
      Platform.OS === "android" && isMissionNotification
        ? { channelId: MISSION_CHANNEL_ID }
        : null,
  });
}

export const canUseNotifications = !!Notifications && !isExpoGo;
