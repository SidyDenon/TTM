const stripSlash = (value = "") => String(value).replace(/\/+$/, "");

export function resolveApiBase() {
  const envBase =
    typeof import.meta !== "undefined" ? import.meta.env.VITE_API_BASE || "" : "";
  if (envBase) return stripSlash(envBase);

  if (typeof window === "undefined") return "";

  const { protocol, hostname } = window.location;
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local") ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("172.16.") ||
    hostname.startsWith("172.17.") ||
    hostname.startsWith("172.18.") ||
    hostname.startsWith("172.19.") ||
    hostname.startsWith("172.2") ||
    hostname.startsWith("172.3");

  if (isLocal) {
    return stripSlash(`${protocol}//${hostname}:5000`);
  }

  return "";
}
