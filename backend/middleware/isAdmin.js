// middleware/isAdmin.js
export function isAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Réservé aux administrateurs" });
  }
  next();
}
