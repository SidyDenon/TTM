import { buildApiPath } from "./urls";

export const SUPPORT_PHONE = "+22373585046";
export const SUPPORT_WHATSAPP = "0022373585046";
export const SUPPORT_EMAIL = "support@ttm.com";
export const SUPPORT_WHATSAPP_LINK = `https://wa.me/${SUPPORT_WHATSAPP.replace(/^\+|^00/, "")}`;

export type SupportConfig = {
	support_phone: string;
	support_whatsapp: string;
	support_email: string;
};

export async function fetchPublicSupportConfig(): Promise<SupportConfig> {
	const fallback: SupportConfig = {
		support_phone: SUPPORT_PHONE,
		support_whatsapp: SUPPORT_WHATSAPP,
		support_email: SUPPORT_EMAIL,
	};

	try {
		const res = await fetch(buildApiPath("/config/public"));
		const data = await res.json();
		if (!res.ok) return fallback;

		return {
			support_phone: data?.support_phone
				? String(data.support_phone)
				: fallback.support_phone,
			support_whatsapp: data?.support_whatsapp
				? String(data.support_whatsapp)
				: fallback.support_whatsapp,
			support_email: data?.support_email
				? String(data.support_email)
				: fallback.support_email,
		};
	} catch {
		return fallback;
	}
}
