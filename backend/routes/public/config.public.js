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
      let site_content = {};
      try {
        const [[row]] = await db.query(
          "SELECT commission_percent, currency, support_phone, support_whatsapp, support_email, site_content_json FROM configurations LIMIT 1"
        );
        if (row) {
          if (row.commission_percent != null)
            commission = Number(row.commission_percent);
          if (row.currency) currency = row.currency;
          if (row.support_phone) support_phone = row.support_phone;
          if (row.support_whatsapp) support_whatsapp = row.support_whatsapp;
          if (row.support_email) support_email = row.support_email;
          if (row.site_content_json) {
            if (typeof row.site_content_json === "string") {
              try {
                site_content = JSON.parse(row.site_content_json);
              } catch {
                site_content = {};
              }
            } else {
              site_content = row.site_content_json;
            }
          }
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
        site_content,
      });
    } catch (err) {
      res.status(500).json({ error: "CONFIG_FAIL" });
    }
  });

  return router;
};
