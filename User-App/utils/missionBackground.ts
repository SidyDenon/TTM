import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "./api";
import { showLocalNotification } from "../lib/notifications";

const TASK_NAME = "mission-status-background-task";
const STORAGE_LAST_STATUS = "mission_last_status";
const STORAGE_LAST_ID = "mission_last_id";
let taskDefined = false;

const getBackgroundFetch = () => {
  try {
    // Lazy require: not available in Expo Go
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("expo-background-fetch");
  } catch {
    return null;
  }
};

type ActiveMission = {
  id?: number | string;
  status?: string | null;
};

const fetchActiveMission = async (token: string): Promise<ActiveMission | null> => {
  const res = await fetch(`${API_URL}/requests/active`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) return null;
  const data = Array.isArray(json?.data) ? json.data[0] : json?.data;
  if (!data) return null;
  return { id: data.id, status: data.status };
};

const shouldNotifyStatusChange = (prevStatus?: string | null, nextStatus?: string | null) =>
  !!nextStatus && nextStatus !== prevStatus;

const ensureTaskDefined = () => {
  if (taskDefined) return true;
  const BackgroundFetch = getBackgroundFetch();
  if (!BackgroundFetch) return false;

  TaskManager.defineTask(TASK_NAME, async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return BackgroundFetch.BackgroundFetchResult.NoData;

      const active = await fetchActiveMission(token);
      if (!active?.id) {
        await AsyncStorage.multiRemove([STORAGE_LAST_ID, STORAGE_LAST_STATUS]);
        return BackgroundFetch.BackgroundFetchResult.NoData;
      }

      const [prevId, prevStatus] = await AsyncStorage.multiGet([STORAGE_LAST_ID, STORAGE_LAST_STATUS]);
      const lastId = prevId?.[1];
      const lastStatus = prevStatus?.[1];

      const nextId = String(active.id);
      const nextStatus = active.status ?? null;

      await AsyncStorage.setItem(STORAGE_LAST_ID, nextId);
      if (nextStatus) await AsyncStorage.setItem(STORAGE_LAST_STATUS, nextStatus);

      if (lastId === nextId && shouldNotifyStatusChange(lastStatus, nextStatus)) {
        await showLocalNotification(
          "Mise à jour de mission",
          `Statut : ${nextStatus.replace(/_/g, " ")}`
        );
        return BackgroundFetch.BackgroundFetchResult.NewData;
      }

      return BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (err) {
      console.warn("⚠️ Background mission check failed:", err);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });

  taskDefined = true;
  return true;
};

export async function startMissionBackgroundTracking() {
  const BackgroundFetch = getBackgroundFetch();
  if (!BackgroundFetch) {
    console.warn("⚠️ Expo Go détecté — BackgroundFetch indisponible");
    return;
  }

  if (!ensureTaskDefined()) return;

  const status = await BackgroundFetch.getStatusAsync();
  if (status !== BackgroundFetch.BackgroundFetchStatus.Available) {
    console.warn("⚠️ BackgroundFetch indisponible:", status);
    return;
  }

  const tasks = await TaskManager.getRegisteredTasksAsync();
  const alreadyRegistered = tasks?.some((t) => t.taskName === TASK_NAME);
  if (alreadyRegistered) return;

  await BackgroundFetch.registerTaskAsync(TASK_NAME, {
    minimumInterval: 300,
    stopOnTerminate: false,
    startOnBoot: true,
  });
}

export async function stopMissionBackgroundTracking() {
  const BackgroundFetch = getBackgroundFetch();
  const tasks = await TaskManager.getRegisteredTasksAsync();
  const alreadyRegistered = tasks?.some((t) => t.taskName === TASK_NAME);
  if (alreadyRegistered && BackgroundFetch) {
    await BackgroundFetch.unregisterTaskAsync(TASK_NAME);
  }
  await AsyncStorage.multiRemove([STORAGE_LAST_ID, STORAGE_LAST_STATUS]);
}
