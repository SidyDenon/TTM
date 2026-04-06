import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "token";

async function canUseSecureStore() {
  try {
    if (typeof SecureStore?.isAvailableAsync === "function") {
      return await SecureStore.isAvailableAsync();
    }
    return true;
  } catch {
    return false;
  }
}

export async function getStoredToken() {
  const useSecure = await canUseSecureStore();
  if (useSecure) {
    const secure = await SecureStore.getItemAsync(TOKEN_KEY);
    if (secure) return secure;
  }
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setStoredToken(token: string) {
  const useSecure = await canUseSecureStore();
  if (useSecure) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await AsyncStorage.removeItem(TOKEN_KEY);
    return;
  }
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearStoredToken() {
  const useSecure = await canUseSecureStore();
  if (useSecure) {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function migrateTokenFromAsyncStorage() {
  const useSecure = await canUseSecureStore();
  if (!useSecure) return;
  const current = await SecureStore.getItemAsync(TOKEN_KEY);
  if (current) return;
  const legacy = await AsyncStorage.getItem(TOKEN_KEY);
  if (!legacy) return;
  await SecureStore.setItemAsync(TOKEN_KEY, legacy);
  await AsyncStorage.removeItem(TOKEN_KEY);
}
