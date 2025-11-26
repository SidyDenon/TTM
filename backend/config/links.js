const RAW_BASE_URL = process.env.BASE_URL || "http://localhost:5000";
export const BASE_URL = RAW_BASE_URL.replace(/\/$/, "");
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
