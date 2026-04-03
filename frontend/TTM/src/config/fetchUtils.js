const DEFAULT_TIMEOUT_MS = 6000;

export async function fetchJsonWithTimeout(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

const canUseStorage = () => typeof window !== "undefined" && !!window.localStorage;

export function readCache(cacheKey, maxAgeMs = 5 * 60 * 1000) {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const ts = Number(parsed?.ts || 0);
    if (!ts || Date.now() - ts > maxAgeMs) return null;
    return parsed?.data ?? null;
  } catch {
    return null;
  }
}

export function writeCache(cacheKey, data) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // ignore storage quota or serialization issues
  }
}
