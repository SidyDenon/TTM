import { getBaseCandidates } from "./api";
import { fetchJsonWithTimeout, readCache, writeCache } from "./fetchUtils";

export const DEFAULT_SITE_CONTENT = {
  histoire: {},
  services: {},
  tarifs: {},
  faq: {},
};

const SITE_CONTENT_CACHE_KEY = "ttm:site-content";

export async function fetchSiteContent(apiBase = "") {
  const cached = !apiBase ? readCache(SITE_CONTENT_CACHE_KEY) : null;
  if (cached && typeof cached === "object" && !Array.isArray(cached)) {
    return { ...DEFAULT_SITE_CONTENT, ...cached };
  }

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
      const data = await fetchJsonWithTimeout(`${normalized}/api/config/public`);
      if (!data) continue;
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
      writeCache(SITE_CONTENT_CACHE_KEY, merged);
      return merged;
    } catch {
      continue;
    }
  }

  return DEFAULT_SITE_CONTENT;
}
