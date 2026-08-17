import crypto from "crypto";

export function requestContext(req, res, next) {
  const incoming = String(req.headers["x-request-id"] || "").trim();
  req.requestId = incoming.slice(0, 100) || crypto.randomUUID();
  res.setHeader("X-Request-ID", req.requestId);

  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    if (res.statusCode >= 500 && payload && typeof payload === "object" && !Array.isArray(payload)) {
      return originalJson({ ...payload, request_id: req.requestId });
    }
    return originalJson(payload);
  };
  next();
}
