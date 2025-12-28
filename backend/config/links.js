import os from "os";

const getLocalIPv4 = () => {
  try {
    const nics = os.networkInterfaces();
    for (const name of Object.keys(nics)) {
      for (const info of nics[name] || []) {
        if (info && info.family === "IPv4" && !info.internal) {
          return info.address;
        }
      }
    }
  } catch {}
  return "127.0.0.1";
};

const port = process.env.PORT || 5000;
const localIp = process.env.LOCAL_IP || getLocalIPv4();
const fallbackBase = `http://${localIp}:${port}`;
const RAW_BASE_URL = (process.env.BASE_URL || fallbackBase).replace(/\/$/, "");

export const BASE_URL = RAW_BASE_URL;
export const ADMIN_LOGIN_URL =
  process.env.ADMIN_LOGIN_URL || "https://example.com/admin/login";

export const buildPublicUrl = (path = "") => {
  if (!path) return BASE_URL;
  if (path.startsWith("http")) return path;
  const prefix = path.startsWith("/") ? "" : "/";
  return `${BASE_URL}${prefix}${path}`;
};

export const buildUploadUrl = (path = "") => {
  if (!path) return null;
  return buildPublicUrl(path.startsWith("/") ? path : `/${path}`);
};
