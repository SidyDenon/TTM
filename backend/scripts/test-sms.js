import { sendSMS } from "../utils/sms.js";

const to = String(process.env.SMS_TEST_TO || "").trim();
const message = "TTM test SMS OK";

if (!to) {
  console.error("SMS_TEST_TO est requis. Aucun SMS n'a été envoyé.");
  process.exit(1);
}

sendSMS(to, message)
  .then(() => {
    console.log("SMS envoye");
  })
  .catch((err) => {
    console.error("Erreur SMS:", err?.message || err);
    process.exit(1);
  });
