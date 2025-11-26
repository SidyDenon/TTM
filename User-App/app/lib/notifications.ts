import { Alert, Platform } from "react-native";
import Notifications, { isExpoGo } from "./expoNotifications";

const warnExpoGo = () =>
  console.log("⚠️ Expo Go détecté — notifications push/système désactivées dans ce mode");

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} else {
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
      "⚠️ Autorisez les notifications pour suivre vos missions."
    );
    return { granted: false, reason: "denied" };
  }

  return { granted: true, reason: "ok" };
}

export async function setupNotificationChannel() {
  if (!Notifications || Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Notifications TowTruck",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "towtruck_alert.wav",
  });
}

export async function showLocalNotification(title: string, body: string) {
  if (!Notifications) {
    warnExpoGo();
    return;
  }

  if (Platform.OS === "android") {
    await setupNotificationChannel();
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: Platform.OS === "ios" ? "towtruck_alert.wav" : undefined,
      channelId: Platform.OS === "android" ? "default" : undefined,
    },
    trigger: null,
  });
}

export const canUseNotifications = !!Notifications && !isExpoGo;
