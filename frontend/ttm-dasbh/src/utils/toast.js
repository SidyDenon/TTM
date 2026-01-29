import { toast as baseToast } from "react-toastify";

const buildId = (type, message, explicitId) => {
  if (explicitId) return explicitId;
  if (typeof message === "string" && message.trim().length > 0) {
    return `${type}:${message}`;
  }
  return undefined;
};

export const toast = {
  success: (message, options = {}) =>
    baseToast.success(message, {
      ...options,
      toastId: buildId("success", message, options.toastId),
    }),
  error: (message, options = {}) =>
    baseToast.error(message, {
      ...options,
      toastId: buildId("error", message, options.toastId),
    }),
  info: (message, options = {}) =>
    baseToast.info(message, {
      ...options,
      toastId: buildId("info", message, options.toastId),
    }),
  warn: (message, options = {}) =>
    baseToast.warn(message, {
      ...options,
      toastId: buildId("warn", message, options.toastId),
    }),
};

