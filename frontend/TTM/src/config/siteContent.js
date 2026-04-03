import { getBaseCandidates } from "./api";

export const DEFAULT_SITE_CONTENT = {
  histoire: {},
  services: {},
  tarifs: {},
  faq: {},
};

export async function fetchSiteContent(apiBase = "") {
  const bases = apiBase ? [apiBase] : getBaseCandidates();

  for (const base of bases) {
    try {
      const normalized = base.replace(/\/+$/, "");
      const toAbsolute = (value) => {
        if (!value || typeof value !== "string") return value;
        const raw = value.trim();
        if (!raw) return "";
        if (/^https?:\/\//i.test(raw)) return raw;
        const path = raw.startsWith("/") ? raw : `/${raw}`;
        return `${normalized}${path}`;
      };
      const res = await fetch(`${normalized}/api/config/public`);
      if (!res.ok) continue;
      const data = await res.json();
      const content = data?.site_content;
      if (!content || typeof content !== "object" || Array.isArray(content)) continue;
      const merged = { ...DEFAULT_SITE_CONTENT, ...content };
      if (merged?.services?.logoImage) merged.services.logoImage = toAbsolute(merged.services.logoImage);
      if (merged?.tarifs?.logoImage) merged.tarifs.logoImage = toAbsolute(merged.tarifs.logoImage);
      if (merged?.histoire?.image) merged.histoire.image = toAbsolute(merged.histoire.image);
      if (merged?.faq?.image) merged.faq.image = toAbsolute(merged.faq.image);
      if (merged?.tarifs?.photos && typeof merged.tarifs.photos === "object" && !Array.isArray(merged.tarifs.photos)) {
        const normalizedPhotos = {};
        Object.entries(merged.tarifs.photos).forEach(([k, v]) => { normalizedPhotos[k] = toAbsolute(v); });
        merged.tarifs.photos = normalizedPhotos;
      }
      return merged;
    } catch {
      continue;
    }
  }

  return DEFAULT_SITE_CONTENT;
}
