export function errorHandler(err, req, res, next) {
  console.error("❌ Erreur attrapée:", err);

  res.status(err.status || 500).json({
    error: err.message || "Erreur interne du serveur",
  });
}
