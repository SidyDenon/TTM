import Constants from "expo-constants";
import * as Device from "expo-device";
import type * as NotificationsType from "expo-notifications";

export const isExpoGo =
  Constants.executionEnvironment === "storeClient" || Constants.appOwnership === "expo";

const canUseNativeNotifications = Device.isDevice && !isExpoGo;

const Notifications: typeof NotificationsType | null = canUseNativeNotifications
  ? // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("expo-notifications")
  : null;

export default Notifications;

type PushTokenResult =
  | { token: string; reason: "ok" }
  | { token: null; reason: "expo-go" | "missing-projectId" | "denied" | string };

export async function getExpoPushTokenSafe(): Promise<PushTokenResult> {
  if (!Notifications || isExpoGo) {
    return { token: null, reason: "expo-go" };
  }

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId ?? null;
  if (!projectId) {
    return { token: null, reason: "missing-projectId" };
  }

  const { status } = await Notifications.getPermissionsAsync();
  let finalStatus = status;
  if (status !== "granted") {
    const { status: requested } = await Notifications.requestPermissionsAsync();
    finalStatus = requested;
  }

  if (finalStatus !== "granted") {
    return { token: null, reason: "denied" };
  }

  try {
    const expoToken = await Notifications.getExpoPushTokenAsync({ projectId });
    return { token: expoToken.data, reason: "ok" };
  } catch (err) {
    return { token: null, reason: err?.message || "token-error" };
  }
}
