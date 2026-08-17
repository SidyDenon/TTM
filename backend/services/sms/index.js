import dotenv from "dotenv";
import { normalizeMessage, normalizePhone } from "./phone.js";

dotenv.config();

const providers = {
  africastalking: () => import("./providers/africastalking.js"),
};

export const getSmsProviderName = () =>
  String(process.env.SMS_PROVIDER || "africastalking").trim().toLowerCase();

export async function sendSMS(to, message) {
  const providerName = getSmsProviderName();
  const loadProvider = providers[providerName];
  if (!loadProvider) {
    throw new Error(
      `Fournisseur SMS non supporté: ${providerName}. Fournisseurs disponibles: ${Object.keys(providers).join(", ")}`
    );
  }
  const provider = await loadProvider();
  return provider.send({
    to: normalizePhone(to),
    message: normalizeMessage(message),
  });
}

export { normalizePhone } from "./phone.js";
