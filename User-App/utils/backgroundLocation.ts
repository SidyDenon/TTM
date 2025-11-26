import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { io } from "socket.io-client";
import { API_URL } from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LOCATION_TASK_NAME = "background-location-task";
// Ne connecte pas automatiquement; on passera le token avant
const socket = io(API_URL.replace('/api',''), { transports: ["websocket"], autoConnect: false });

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("Erreur Background GPS:", error);
    return;
  }
  const { locations } = data as any;
  const loc = locations[0];
  if (!loc) return;

  const operatorId = await AsyncStorage.getItem("operatorId");
  const requestId = await AsyncStorage.getItem("currentMissionId");
  const token = await AsyncStorage.getItem("token");

  if (operatorId && requestId && token) {
    try {
      // Auth handshake si nécessaire
      socket.auth = { token } as any;
      if (!socket.connected) await new Promise<void>((resolve) => {
        socket.once('connect', () => resolve());
        socket.connect();
      });
      socket.emit("operator_location", {
        operatorId,
        requestId,
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      });
    } catch (e) {
      console.warn("⚠️ Background socket emit échoué:", (e as any)?.message || e);
    }
  }
});

export async function startBackgroundLocation(operatorId: number, requestId: number) {
  await AsyncStorage.setItem("operatorId", String(operatorId));
  await AsyncStorage.setItem("currentMissionId", String(requestId));

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return console.warn("Permission GPS refusée");

  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") return console.warn("Permission arrière-plan refusée");

  const isActive = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (!isActive) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Highest,
      timeInterval: 5000,
      distanceInterval: 5,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "Tow Truck Mali",
        notificationBody: "Suivi GPS actif pendant la mission.",
        notificationColor: "#E53935",
      },
    });
  }
}

export async function stopBackgroundLocation() {
  const isActive = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (isActive) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  await AsyncStorage.removeItem("operatorId");
  await AsyncStorage.removeItem("currentMissionId");
}
