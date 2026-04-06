export function errorHandler(err, req, res, next) {
  console.error("❌ Erreur attrapée:", err);

  const isProd = process.env.NODE_ENV === "production";
  const status = Number(err?.status) || 500;
  const safeMessage = status >= 500
    ? "Erreur interne du serveur"
    : err?.message || "Requête invalide";

  res.status(status).json(
    isProd
      ? { error: safeMessage }
      : { error: safeMessage, details: err?.message || null }
  );
}
