const normalizeRole = (role) => {
  const value = String(role || "").toLowerCase().trim();
  if (["operateur", "opérateur"].includes(value)) return "operator";
  if (value === "administrateur") return "admin";
  return value;
};

export const requireRole = (...roles) => {
  const allowed = new Set(roles.flat().map(normalizeRole));
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Non autorisé" });
    if (!allowed.has(normalizeRole(req.user.role))) {
      return res.status(403).json({ error: "Rôle non autorisé" });
    }
    next();
  };
};

export const requireClient = requireRole("client");
export const requireOperator = requireRole("operator");
export const requireAdmin = requireRole("admin");
