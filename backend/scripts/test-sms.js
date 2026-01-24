import { sendSMS } from "../config/twilo.js";

const to = process.env.SMS_TEST_TO || "+212600640052";
const message = "TTM test SMS OK";

sendSMS(to, message)
  .then(() => {
    console.log("SMS envoye");
  })
  .catch((err) => {
    console.error("Erreur SMS:", err?.message || err);
    process.exit(1);
  });
