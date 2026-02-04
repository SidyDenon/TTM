import express from "express";

const router = express.Router();

export default (db) => {
  router.get("/", async (req, res) => {
    try {
      let commission = 10;
      let currency = "FCFA";
      let support_phone = "+22373585046";
      let support_whatsapp = "0022373585046";
      let support_email = "support@ttm.com";
      try {
        const [[row]] = await db.query(
          "SELECT commission_percent, currency, support_phone, support_whatsapp, support_email FROM configurations LIMIT 1"
        );
        if (row) {
          if (row.commission_percent != null)
            commission = Number(row.commission_percent);
          if (row.currency) currency = row.currency;
          if (row.support_phone) support_phone = row.support_phone;
          if (row.support_whatsapp) support_whatsapp = row.support_whatsapp;
          if (row.support_email) support_email = row.support_email;
        }
      } catch (e) {
        try {
          const [[row]] = await db.query(
            "SELECT commission_percent, currency FROM configurations LIMIT 1"
          );
          if (row) {
            if (row.commission_percent != null)
              commission = Number(row.commission_percent);
            if (row.currency) currency = row.currency;
          }
        } catch {
          // table absente -> valeurs par defaut
        }
      }
      res.json({
        commission_percent: commission,
        currency,
        support_phone,
        support_whatsapp,
        support_email,
      });
    } catch (err) {
      res.status(500).json({ error: "CONFIG_FAIL" });
    }
  });

  return router;
};
