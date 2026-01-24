import twilio from "twilio";
import dotenv from "dotenv";

dotenv.config();

const twilioSid =
  process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID || "";
const twilioToken =
  process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_AUTH || "";
const twilioFrom =
  process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_PHONE || "";

const client = twilio(twilioSid, twilioToken);

export function sendSMS(to, body) {
  return client.messages.create({
    from: twilioFrom,
    to,
    body,
  });
}
