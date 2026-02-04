import express from "express";
import { notifyOperators } from "../socket/index.js";

const router = express.Router();

export default () => {
  router.post("/socket", async (req, res) => {
    const { message } = req.body;
    const payload = {
      message: message || "Test Socket.IO",
      timestamp: new Date().toISOString(),
    };

    console.log("Envoi test socket :", payload);
    notifyOperators("test_notification", payload);

    res.json({ success: true, sent: payload });
  });

  return router;
};
