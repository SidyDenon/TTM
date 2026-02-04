import express from "express";
const router = express.Router();

export default () => {
  router.get("/whoami", (req, res) => {
    const out = {
      id: req.user?.id,
      role: req.user?.role,
      isSuperAdmin: !!req.isSuperAdmin,
      permissions: req.adminPermissions || [],
    };
    res.json(out);
  });

  return router;
};
