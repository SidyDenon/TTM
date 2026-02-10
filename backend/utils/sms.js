import AfricasTalking from "africastalking";

const username =
  process.env.AFRICAS_TALKING_USERNAME ||
  process.env.AT_USERNAME ||
  "";
const apiKey =
  process.env.AFRICAS_TALKING_API_KEY ||
  process.env.AT_API_KEY ||
  "";
const senderId =
  process.env.AFRICAS_TALKING_SENDER_ID ||
  process.env.AT_SENDER_ID ||
  "";

const atClient = AfricasTalking({ username, apiKey });
const sms = atClient.SMS;

const normalizePhone = (raw) => {
  const val = String(raw || "").trim();
  if (!val) return "";
  if (val.startsWith("+")) return val;
  return `+223${val}`;
};

export async function sendSMS(to, message) {
  if (!username || !apiKey) {
    throw new Error("AFRICAS_TALKING credentials missing");
  }
  const normalized = normalizePhone(to);
  const payload = {
    to: [normalized],
    message,
  };
  if (senderId) payload.from = senderId;
  return sms.send(payload);
}
