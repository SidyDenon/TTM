import twilio from "twilio";
import dotenv from "dotenv";

dotenv.config();

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

export function sendSMS(to, body) {
  return client.messages.create({
    body,
    from: process.env.TWILIO_PHONE,
    to,
  });
}
