import AfricasTalking from "africastalking";

const acceptedStatusCodes = new Set([100, 101, 102]);
const acceptedStatuses = new Set(["success", "sent", "queued", "processed"]);

let smsClient;

const getClient = () => {
  const username = process.env.AFRICAS_TALKING_USERNAME || process.env.AT_USERNAME || "";
  const apiKey = process.env.AFRICAS_TALKING_API_KEY || process.env.AT_API_KEY || "";
  if (!username || !apiKey || username === "dummy_username" || apiKey === "dummy_api_key") {
    throw new Error("AFRICAS_TALKING credentials non configurés");
  }
  if (!smsClient) smsClient = AfricasTalking({ username, apiKey }).SMS;
  return smsClient;
};

const validateResponse = (response) => {
  const recipients = response?.SMSMessageData?.Recipients;
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new Error("Africa's Talking n'a confirmé aucun destinataire");
  }
  const rejected = recipients.filter((recipient) => {
    const code = Number(recipient?.statusCode);
    const status = String(recipient?.status || "").toLowerCase();
    return !acceptedStatusCodes.has(code) && !acceptedStatuses.has(status);
  });
  if (rejected.length) {
    const reason = rejected[0]?.status || rejected[0]?.statusCode || "refus fournisseur";
    throw new Error(`SMS refusé par Africa's Talking (${reason})`);
  }
  return response;
};

export async function send({ to, message }) {
  const payload = { to: [to], message };
  const senderId = process.env.AFRICAS_TALKING_SENDER_ID || process.env.AT_SENDER_ID || "";
  if (senderId) payload.senderId = senderId;

  const response = await Promise.race([
    getClient().send(payload),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Délai d'envoi SMS dépassé")), 15000)
    ),
  ]);
  return validateResponse(response);
}
