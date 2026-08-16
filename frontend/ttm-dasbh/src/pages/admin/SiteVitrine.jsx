// src/pages/admin/SiteVitrine.jsx
/* eslint-disable no-unused-vars */
import { useEffect, useMemo, useState, useRef } from "react";
import { toast } from "../../utils/toast";
import * as FaIcons from "react-icons/fa";      // UI buttons (edit/save/…)
import * as Fa6Icons from "react-icons/fa6";    // FontAwesome 6 Free (compat Expo)
import * as IoIcons from "react-icons/io5";     // Ionicons 5
import * as FiIcons from "react-icons/fi";      // Feather
import * as AiIcons from "react-icons/ai";      // AntDesign
import * as MdIcons from "react-icons/md";      // Material Icons
import * as GoIcons from "react-icons/go";      // Octicons
import * as SlIcons from "react-icons/sl";      // SimpleLineIcons
import { FaEdit, FaSave, FaTrash, FaPlus, FaPercent, FaWrench, FaKey, FaBriefcase, FaHeadset, FaPaperPlane, FaEye } from "react-icons/fa";
import { FaRegCircleUser } from "react-icons/fa6";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { API_BASE } from "../../config/urls";
import { useAuth } from "../../context/AuthContext";
import { can, isSuper } from "../../utils/rbac"; //  RBAC (même pattern)
import { useModalOrigin } from "../../hooks/useModalOrigin";

export default function SiteVitrine() {
  const { user, token } = useAuth();

  // ─────────── Permissions (RBAC)
  const canViewServices =
    isSuper(user) ||
    can(user, "services_view") ||
    can(user, "services_manage") ||
    can(user, "site_view") ||
    can(user, "site_manage");
  const canManageServices =
    isSuper(user) || can(user, "services_manage") || can(user, "site_manage");

  const canViewConfig =
    isSuper(user) ||
    can(user, "config_view") ||
    can(user, "config_manage") ||
    can(user, "site_view") ||
    can(user, "site_manage");
  const canManageConfig =
    isSuper(user) || can(user, "config_manage") || can(user, "site_manage");

  const canAccessPage =
    isSuper(user) || can(user, "site_view") || can(user, "site_manage");
  const canManageSiteContent = isSuper(user) || can(user, "site_manage");

  // ─────────── Profile
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [closingEditProfile, setClosingEditProfile] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [closingPasswordModal, setClosingPasswordModal] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [profile, setProfile] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");

  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });

  // ─────────── Services
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [inlineSaving, setInlineSaving] = useState(null);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    subtitle: "",
    description: "",
    price: "",
    icon: "",
    is_internal: false,
  });
  const [addImageFile, setAddImageFile] = useState(null);
  const [addImagePreview, setAddImagePreview] = useState("");
  const [rowImageFiles, setRowImageFiles] = useState({});
  const [rowImagePreviews, setRowImagePreviews] = useState({});
  const [servicesOpen, setServicesOpen] = useState(true);
  const [histoireOpen, setHistoireOpen] = useState(true);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [closingAddServiceModal, setClosingAddServiceModal] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
  const [iconList, setIconList] = useState([]);
  const [iconsLoading, setIconsLoading] = useState(false);
  const iconCache = useRef({});
  const [confirmService, setConfirmService] = useState(null);
  const [closingConfirmService, setClosingConfirmService] = useState(false);
  const [confirmServiceLoading, setConfirmServiceLoading] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [closingEditServiceModal, setClosingEditServiceModal] = useState(false);
  const [editServiceDraft, setEditServiceDraft] = useState({
    name: "",
    subtitle: "",
    description: "",
    price: "",
    icon: "",
    image_file: null,
  });
  const [editServiceOriginal, setEditServiceOriginal] = useState(null);
  const [showEditServicePreview, setShowEditServicePreview] = useState(false);
  const [editServiceIconPickerOpen, setEditServiceIconPickerOpen] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [imageViewerUrl, setImageViewerUrl] = useState("");
  const [descriptionViewerOpen, setDescriptionViewerOpen] = useState(false);
  const [descriptionViewerContent, setDescriptionViewerContent] = useState("");
  const [descriptionEditorOpen, setDescriptionEditorOpen] = useState(false);
  const [descriptionEditorDraft, setDescriptionEditorDraft] = useState("");
  const [showTestSmsModal, setShowTestSmsModal] = useState(false);
  const [closingTestSmsModal, setClosingTestSmsModal] = useState(false);
  const [testSmsPhone, setTestSmsPhone] = useState("");
  const [sendingTestSms, setSendingTestSms] = useState(false);
  const confirmServiceModalRef = useModalOrigin(!!confirmService);
  const editProfileModalRef = useModalOrigin(showEditProfile);
  const passwordModalRef = useModalOrigin(showPasswordModal);
  const addServiceModalRef = useModalOrigin(showAddServiceModal);
  const testSmsModalRef = useModalOrigin(showTestSmsModal);

  // ─────────── Business config
  const [commission, setCommission] = useState("");              // %
  const [towingPricePerKm, setTowingPricePerKm] = useState("");  // prix / km
  const [towingBasePrice, setTowingBasePrice] = useState("");    // prix de base
  const [operatorMissionRadius, setOperatorMissionRadius] = useState(""); // rayon standard
  const [operatorTowingRadius, setOperatorTowingRadius] = useState(""); // rayon remorquage
  const [currency, setCurrency] = useState("FCFA");               // devise
  const [supportPhone, setSupportPhone] = useState("");
  const [supportWhatsApp, setSupportWhatsApp] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [businessOpen, setBusinessOpen] = useState(true);
  const [supportOpen, setSupportOpen] = useState(true);

  const [savingBusinessConfig, setSavingBusinessConfig] = useState(false);
  const [savingSupportContacts, setSavingSupportContacts] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [siteContentLoading, setSiteContentLoading] = useState(true);
  const [siteContentSaving, setSiteContentSaving] = useState(false);
  const [siteContent, setSiteContent] = useState({
    histoire: {
      title: "",
      intro1: "",
      intro2: "",
      image: "",
      modalTitle: "",
      modalSubtitle: "",
      modalBody: "",
    },
    services: { title: "", logoImage: "" },
    tarifs: { title: "", subtitle: "", logoImage: "", photos: {} },
    faq: { title: "", subtitle: "", image: "" },
  });
  const [tarifsPhotosRaw, setTarifsPhotosRaw] = useState("{}");
  const [histoireEditorOpen, setHistoireEditorOpen] = useState(false);
  const [histoirePreviewOpen, setHistoirePreviewOpen] = useState(false);
  const [histoireDraft, setHistoireDraft] = useState({
    modalSubtitle: "",
    modalBody: "",
  });

  const isLogged = useMemo(() => Boolean(token), [token]);

  const buildConfigPayload = (currValue) => ({
    commission_percent: Number(commission),
    towing_price_per_km: Number(towingPricePerKm),
    towing_base_price: Number(towingBasePrice),
    operator_mission_radius_km: Number(operatorMissionRadius),
    operator_towing_radius_km: Number(operatorTowingRadius),
    currency: currValue,
    support_phone: supportPhone.trim(),
    support_whatsapp: supportWhatsApp.trim(),
    support_email: supportEmail.trim(),
  });

  const resolveIcon = (iconName) => {
    if (!iconName) return null;
    const raw = String(iconName).trim();
    const normalizeIconToken = (token = "") => {
      const cleaned = String(token || "").trim();
      if (!cleaned) return "";
      const withoutFaPrefix = cleaned.replace(/^fa[srlbd]?\s+/i, "").replace(/^fa-/i, "");
      if (/^[A-Z][A-Za-z0-9]+$/.test(withoutFaPrefix)) {
        return withoutFaPrefix
          .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
          .toLowerCase();
      }
      return withoutFaPrefix.replace(/_/g, "-").toLowerCase();
    };
    const [packPrefix, rawName] =
      raw.includes(":") ? raw.split(":") : [null, raw];
    const key = normalizeIconToken(packPrefix ? rawName : raw);
    const cacheKey = `${packPrefix || "any"}:${key}`;
    if (iconCache.current[cacheKey]) return iconCache.current[cacheKey];

    const packs = [
      { entries: FaIcons, prefix: "Fa", tag: "fa" },   // legacy FontAwesome (fa:)
      // si packPrefix=fa, on tentera aussi fa6 plus bas
      { entries: Fa6Icons, prefix: "Fa", tag: "fa6" },
      { entries: IoIcons, prefix: "Io", tag: "io5" },
      { entries: FiIcons, prefix: "Fi", tag: "fi" },
      { entries: AiIcons, prefix: "Ai", tag: "ai" },
      { entries: MdIcons, prefix: "Md", tag: "md" },
      { entries: GoIcons, prefix: "Go", tag: "go" },
      { entries: SlIcons, prefix: "Sl", tag: "sl" },
    ];
    const toKebab = (rawComp, prefix) =>
      rawComp
        .replace(new RegExp(`^${prefix}`), "")
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .toLowerCase();

    for (const pack of packs) {
      const prefix = packPrefix ? packPrefix.toLowerCase() : null;
      if (prefix && prefix !== pack.tag) {
        // cas fa: → tenter fa6 après fa
        if (!(prefix === "fa" && pack.tag === "fa6")) continue;
        if (prefix !== "fa" && pack.tag === "fa6") continue;
      }
      for (const [compName, Comp] of Object.entries(pack.entries)) {
        if (typeof Comp !== "function" || !compName.startsWith(pack.prefix))
          continue;
        if (toKebab(compName, pack.prefix) === key) {
          iconCache.current[cacheKey] = Comp;
          return Comp;
        }
      }
    }
    iconCache.current[cacheKey] = null;
    return null;
  };

  const renderIcon = (iconName, size = 24) => {
    let Comp = FaWrench;
    const resolved = resolveIcon(iconName);
    if (resolved) {
      Comp = resolved;
    } else if (iconList.length > 0) {
      const raw = String(iconName || "").trim().toLowerCase();
      const normalizedName = raw.includes(":") ? raw.split(":")[1] : raw;
      const found = iconList.find(
        (i) => i.name === normalizedName || `${i.pack}:${i.name}` === raw
      );
      Comp = found?.Comp || FaWrench;
    }
    return <Comp style={{ fontSize: size }} />;
  };

  // Ancienne version : simple concaténation ou usage direct
  const toAssetUrl = (value) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    const apiBase = String(API_BASE || "").replace(/\/+$/, "");
    try {
      if (/^https?:\/\//i.test(raw)) {
        const currentApi = new URL(`${apiBase}/`);
        const assetUrl = new URL(raw);
        if (assetUrl.pathname.startsWith("/uploads/") && ["localhost", "127.0.0.1", "::1"].includes(assetUrl.hostname)) {
          return `${currentApi.origin}${assetUrl.pathname}${assetUrl.search}`;
        }
        return assetUrl.toString();
      }
      const normalizedPath = raw.startsWith("/") ? raw : `/${raw}`;
      return new URL(normalizedPath, `${apiBase}/`).toString();
    } catch {
      const normalizedPath = raw.replace(/^\/+/, "");
      return `${apiBase}/${normalizedPath}`;
    }
  };

  const normalizeOptionalValue = (value) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    const lower = raw.toLowerCase();
    if (lower === "null" || lower === "undefined" || lower === "none") return "";
    return raw;
  };

  const invalidatePublicVitrineCache = () => {
    try {
      if (typeof window === "undefined" || !window.localStorage) return;
      window.localStorage.removeItem("ttm:public-services:v3");
      window.localStorage.removeItem("ttm:public-services:v4");
      window.localStorage.removeItem("ttm:site-content");
    } catch {
      // ignore storage access issues
    }
  };

  const formatDescriptionPreview = (value) => {
    const escapeHtml = (input) =>
      String(input || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    return escapeHtml(value)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/\n/g, "<br />");
  };

  // Chargement paresseux de la grosse liste d'icônes (évite de bloquer au montage)
  useEffect(() => {
    if ((!iconPickerOpen && !editServiceIconPickerOpen) || iconList.length > 0 || iconsLoading) return;
    setIconsLoading(true);
    const list = [];
    const pushIcons = (entries, prefix, pack) => {
      Object.entries(entries).forEach(([key, Comp]) => {
        if (typeof Comp !== "function" || !key.startsWith(prefix)) return;
        const kebab = key
          .replace(new RegExp(`^${prefix}`), "")
          .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
          .toLowerCase();
        list.push({
          key,
          name: kebab,
          label: `${pack} ${kebab.replace(/-/g, " ")}`,
          Comp,
          pack,
        });
      });
    };
    // Legacy fa (lecture uniquement) non proposé en picker pour éviter les icônes non dispo mobile
    // pushIcons(FaIcons, "Fa", "fa");
    pushIcons(Fa6Icons, "Fa", "fa6");
    pushIcons(IoIcons, "Io", "io5");
    pushIcons(FiIcons, "Fi", "fi");
    pushIcons(AiIcons, "Ai", "ai");
    pushIcons(MdIcons, "Md", "md");
    pushIcons(GoIcons, "Go", "go");
    pushIcons(SlIcons, "Sl", "sl");
    setIconList(list);
    setIconsLoading(false);
  }, [iconPickerOpen, editServiceIconPickerOpen, iconList.length, iconsLoading]);

  const filteredIcons = useMemo(() => {
    if (!iconList.length) return [];
    const qRaw = (iconSearch || "").toLowerCase().trim();
    const q = qRaw.includes(":") ? qRaw.split(":")[1] : qRaw;
    const matches = iconList.filter((ico) => {
      if (!q) return true;
      return (
        ico.name.includes(q) ||
        ico.label.toLowerCase().includes(q) ||
        `${ico.pack}:${ico.name}`.includes(qRaw)
      );
    });
    // limiter l'affichage pour ne pas lagger l'UI
    return matches.slice(0, 200);
  }, [iconList, iconSearch, addForm.icon]);

  const isHomeOilService = (name) => {
    const key = String(name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return (
      key.includes("domicile") ||
      key.includes("huile") ||
      key.includes("oil") ||
      key.includes("vidange")
    );
  };

  const isPinnedProtectedService = (name) => {
    const key = String(name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return key.includes("remorqu") || isHomeOilService(name);
  };

  const sortPinnedServices = (list = []) => {
    const arr = Array.isArray(list) ? [...list] : [];
    const priority = (srv) => {
      const key = String(srv?.name || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      if (key.includes("remorqu")) return 0;
      if (isHomeOilService(srv?.name)) return 1;
      return 2;
    };
    return arr.sort((a, b) => {
      const pa = priority(a);
      const pb = priority(b);
      if (pa !== pb) return pa - pb;
      return String(a?.name || "").localeCompare(String(b?.name || ""), "fr");
    });
  };

  // ─────────── Fetchers
  const loadServices = async () => {
    if (!canViewServices) return; // RBAC
    setLoadingServices(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/vitrine/services`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur chargement services");
      setServices(sortPinnedServices(data.data || []));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoadingServices(false);
    }
  };

  const loadConfig = async () => {
    if (!canViewConfig) return; // RBAC
    setLoadingConfig(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur chargement config");

      //  map sur la réponse du backend
      setCommission(String(data.commission_percent ?? "0"));
      setTowingPricePerKm(String(data.towing_price_per_km ?? "0"));
      setTowingBasePrice(String(data.towing_base_price ?? "0"));
      setOperatorMissionRadius(String(data.operator_mission_radius_km ?? "5"));
      setOperatorTowingRadius(String(data.operator_towing_radius_km ?? "100"));
      setCurrency(data.currency || "FCFA");
      setSupportPhone(data.support_phone || "");
      setSupportWhatsApp(data.support_whatsapp || "");
      setSupportEmail(data.support_email || "");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoadingConfig(false);
    }
  };

  const loadSiteContent = async () => {
    setSiteContentLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/config/site-content`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur chargement contenu vitrine");
      const raw = data?.data || {};
      const next = {
        histoire: { ...siteContent.histoire, ...(raw.histoire || {}) },
        services: { ...siteContent.services, ...(raw.services || {}) },
        tarifs: { ...siteContent.tarifs, ...(raw.tarifs || {}) },
        faq: { ...siteContent.faq, ...(raw.faq || {}) },
      };
      setSiteContent(next);
      setTarifsPhotosRaw(
        JSON.stringify(
          next?.tarifs?.photos && typeof next.tarifs.photos === "object"
            ? next.tarifs.photos
            : {},
          null,
          2
        )
      );
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSiteContentLoading(false);
    }
  };

  useEffect(() => {
    if (!isLogged) return;
    loadServices();
    loadConfig();
    if (canAccessPage) loadSiteContent();
     
  }, [isLogged, canViewServices, canViewConfig, canAccessPage]);

  const updateSiteSection = (section, key, value) => {
    setSiteContent((prev) => ({
      ...prev,
      [section]: { ...(prev[section] || {}), [key]: value },
    }));
  };

  const saveSiteContent = async () => {
    if (!canManageSiteContent) return toast.error("Droit requis: site_manage");
    let photosParsed = {};
    try {
      const parsed = JSON.parse(tarifsPhotosRaw || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Le JSON des photos tarifs doit être un objet");
      }
      photosParsed = parsed;
    } catch (e) {
      return toast.error(e.message || "JSON photos tarifs invalide");
    }
    try {
      setSiteContentSaving(true);
      const payload = {
        ...siteContent,
        tarifs: { ...(siteContent.tarifs || {}), photos: photosParsed },
      };
      const res = await fetch(`${API_BASE}/api/admin/config/site-content`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ site_content: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur sauvegarde contenu vitrine");
      toast.success("Contenu vitrine mis à jour ");
      invalidatePublicVitrineCache();
      setSiteContent(payload);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSiteContentSaving(false);
    }
  };

  if (!canAccessPage) {
    return (
      <div
        className="p-6 rounded theme-fade"
        style={{ background: "var(--bg-card)", color: "var(--text-color)" }}
      >
        <h2 className="text-xl font-bold text-red-500"> Accès refusé</h2>
        <p>Vous n’avez pas les droits pour consulter cette page.</p>
      </div>
    );
  }

  // ─────────── Handlers (profil)
  const onPickAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const saveProfile = async () => {
    try {
      setSavingProfile(true);
      const formData = new FormData();
      formData.append("name", profile.name || "");
      formData.append("email", profile.email || "");
      formData.append("phone", profile.phone || "");
      if (avatarFile) formData.append("avatar", avatarFile);

      const res = await fetch(
        `${API_BASE}/api/admin/dashboard/utilisateurs/${user.id}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur mise à jour profil");
      toast.success("Profil mis à jour ");
      setClosingEditProfile(true);
      setTimeout(() => {
        setShowEditProfile(false);
        setClosingEditProfile(false);
      }, 180);
      setAvatarFile(null);
      setAvatarPreview("");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    if (!pwd.current || !pwd.next)
      return toast.error("Champs mot de passe requis");
    if (pwd.next !== pwd.confirm)
      return toast.error("Les mots de passe ne correspondent pas");
    try {
      setSavingPassword(true);
      const res = await fetch(`${API_BASE}/api/auth/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current: pwd.current,
          new: pwd.next,
          confirm: pwd.confirm,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Erreur changement mot de passe");
      toast.success("Mot de passe mis à jour ");
      setPwd({ current: "", next: "", confirm: "" });
      setClosingPasswordModal(true);
      setTimeout(() => {
        setShowPasswordModal(false);
        setClosingPasswordModal(false);
      }, 180);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingPassword(false);
    }
  };

  // ─────────── Handlers (services)
  const saveInlinePrice = async (srv) => {
    if (!canManageServices) {
      return toast.error(
        "Vous n’avez pas les droits pour modifier les services."
      );
    }
    const price = Number(srv.price);
    if (isNaN(price) || price < 0) return toast.error("Prix invalide");
    try {
      setInlineSaving(srv.id);
      const payload = new FormData();
      payload.append("name", String(srv.name || "").trim());
      payload.append("subtitle", String(srv.subtitle || "").trim());
      payload.append("description", String(srv.description || "").trim());
      payload.append("price", String(price));
      if (rowImageFiles[srv.id]) {
        payload.append("image", rowImageFiles[srv.id]);
      }
      const res = await fetch(`${API_BASE}/api/admin/vitrine/services/${srv.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: payload,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur mise à jour service");
      toast.success(`Service "${srv.name}" mis à jour `);
      invalidatePublicVitrineCache();
      setServices((prev) =>
        prev.map((s) => (s.id === srv.id ? { ...s, ...(data?.data || {}), price } : s))
      );
      setRowImageFiles((prev) => {
        const next = { ...prev };
        delete next[srv.id];
        return next;
      });
      setRowImagePreviews((prev) => {
        const next = { ...prev };
        delete next[srv.id];
        return next;
      });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setInlineSaving(null);
    }
  };

  const openServiceEditor = (srv) => {
    const normalizedIcon = normalizeOptionalValue(srv.icon);
    const normalizedIconUrl = normalizeOptionalValue(srv.icon_url);
    const normalizedImageUrl = normalizeOptionalValue(srv.image_url);
    const iconFromService = [normalizedIcon, normalizedIconUrl].find(
      (value) => /^[a-z0-9]+:/i.test(value)
    ) || normalizedIcon || "";
    setClosingEditServiceModal(false);
    setEditingService(srv);
    setEditServiceDraft({
      name: srv.name || "",
      subtitle: srv.subtitle || "",
      description: srv.description || "",
      price: String(srv.price || ""),
      icon: iconFromService,
      image_file: null,
    });
    setEditServiceOriginal({
      name: srv.name || "",
      subtitle: srv.subtitle || "",
      description: srv.description || "",
      price: String(srv.price || ""),
      icon: iconFromService,
      icon_url: normalizedIconUrl,
      image_url: normalizedImageUrl,
    });
    setShowEditServicePreview(false);
    setEditServiceIconPickerOpen(false);
    setIconSearch(iconFromService);
  };

  const closeServiceEditor = () => {
    if (inlineSaving) return;
    setClosingEditServiceModal(true);
    setTimeout(() => {
      setEditingService(null);
      setClosingEditServiceModal(false);
      setShowEditServicePreview(false);
      setEditServiceIconPickerOpen(false);
    }, 180);
  };

  const saveServiceFromModal = async () => {
    if (!editingService || inlineSaving) return;
    const price = Number(editServiceDraft.price);
    if (!editServiceDraft.name) return toast.error("Nom du service requis");
    if (isNaN(price) || price < 0) return toast.error("Prix invalide");

    try {
      setInlineSaving(editingService.id);
      const payload = new FormData();
      payload.append("name", String(editServiceDraft.name || "").trim());
      payload.append("subtitle", String(editServiceDraft.subtitle || "").trim());
      payload.append("description", String(editServiceDraft.description || "").trim());
      payload.append("price", String(price));
      payload.append("icon_name", editServiceDraft.icon || "");
      if (editServiceDraft.image_file) {
        payload.append("image", editServiceDraft.image_file);
      }

      const res = await fetch(`${API_BASE}/api/admin/vitrine/services/${editingService.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: payload,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur mise à jour service");

      toast.success(`Service "${editServiceDraft.name}" mis à jour `);
      invalidatePublicVitrineCache();
      setServices((prev) =>
        prev.map((s) => (s.id === editingService.id ? { ...s, ...(data?.data || {}) } : s))
      );
      closeServiceEditor();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setInlineSaving(null);
    }
  };

  const performDeleteService = async (srv) => {
    if (!canManageServices) {
      return toast.error(
        "Vous n’avez pas les droits pour supprimer un service."
      );
    }
    if (isPinnedProtectedService(srv?.name)) {
      toast.error('Les services "Remorquage" et "Service à Domicile" sont protégés.');
      return false;
    }

    try {
      setConfirmServiceLoading(true);
      const res = await fetch(`${API_BASE}/api/admin/vitrine/services/${srv.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Erreur suppression service");
      toast.success(`Service "${srv.name}" supprimé `);
      invalidatePublicVitrineCache();
      setServices((prev) => sortPinnedServices(prev.filter((s) => s.id !== srv.id)));
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    } finally {
      setConfirmServiceLoading(false);
    }
  };

  const deleteService = (srv) => {
    if (isPinnedProtectedService(srv?.name)) {
      toast.error('Les services "Remorquage" et "Service à Domicile" sont protégés.');
      return;
    }
    setClosingConfirmService(false);
    setConfirmService(srv);
  };

  const addService = async () => {
    if (!canManageServices) {
      return toast.error(
        "Vous n’avez pas les droits pour ajouter un service."
      );
    }
    const price = Number(addForm.price);
    if (!addForm.name) return toast.error("Nom du service requis");
    if (isNaN(price) || price < 0) return toast.error("Prix invalide");
    try {
      setAdding(true);
      const payload = new FormData();
      payload.append("name", addForm.name.trim());
      payload.append("subtitle", addForm.subtitle.trim());
      payload.append("description", addForm.description.trim());
      payload.append("price", String(price));
      payload.append("icon_name", addForm.icon || "");
      payload.append("is_internal", addForm.is_internal ? "1" : "0");
      if (addImageFile) payload.append("image", addImageFile);

      const res = await fetch(`${API_BASE}/api/admin/vitrine/services`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: payload,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur ajout service");
      toast.success("Service ajouté ");
      invalidatePublicVitrineCache();
      setAddForm({ name: "", subtitle: "", description: "", price: "", icon: "", is_internal: false });
      setAddImageFile(null);
      setAddImagePreview("");
      setIconPickerOpen(false);
      setClosingAddServiceModal(true);
      setTimeout(() => {
        setShowAddServiceModal(false);
        setClosingAddServiceModal(false);
      }, 180);
      setServices((prev) => sortPinnedServices([data.data, ...prev]));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAdding(false);
    }
  };

  // ─────────── Handlers (config business)
  const saveBusinessConfig = async () => {
    if (!canManageConfig) {
      return toast.error(
        "Vous n’avez pas les droits pour modifier les paramètres business."
      );
    }

    const pct = Number(commission);
    const priceKm = Number(towingPricePerKm);
    const basePrice = Number(towingBasePrice);
    const missionRadius = Number(operatorMissionRadius);
    const towingRadius = Number(operatorTowingRadius);

    if (isNaN(pct) || pct < 0 || pct > 100) {
      return toast.error("Pourcentage invalide (0–100)");
    }
    if (isNaN(priceKm) || priceKm < 0) {
      return toast.error("Prix par km invalide");
    }
    if (isNaN(basePrice) || basePrice < 0) {
      return toast.error("Prix de base invalide");
    }
    if (isNaN(missionRadius) || missionRadius <= 0 || missionRadius > 200) {
      return toast.error("Rayon missions standard invalide (1–200 km)");
    }
    if (isNaN(towingRadius) || towingRadius <= 0 || towingRadius > 200) {
      return toast.error("Rayon remorquage invalide (1–200 km)");
    }

    const curr =
      typeof currency === "string" && currency.trim()
        ? currency.trim()
        : "FCFA";

    try {
      setSavingBusinessConfig(true);
      const res = await fetch(`${API_BASE}/api/admin/config`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(buildConfigPayload(curr)),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Erreur mise à jour configuration");
      toast.success("Paramètres business mis à jour ");
      setCurrency(curr);
      setSupportPhone(data.support_phone || "");
      setSupportWhatsApp(data.support_whatsapp || "");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingBusinessConfig(false);
    }
  };

  const saveSupportContacts = async () => {
    if (!canManageConfig) {
      return toast.error(
        "Vous n’avez pas les droits pour modifier les coordonnées."
      );
    }

    const curr =
      typeof currency === "string" && currency.trim()
        ? currency.trim()
        : "FCFA";

    try {
      setSavingSupportContacts(true);
      const res = await fetch(`${API_BASE}/api/admin/config`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(buildConfigPayload(curr)),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Erreur mise à jour coordonneés");
      toast.success("Coordonnées service client mises à jour ");
      setSupportPhone(data.support_phone || "");
      setSupportWhatsApp(data.support_whatsapp || "");
      setSupportEmail(data.support_email || "");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingSupportContacts(false);
    }
  };

  const sendTestSms = async () => {
    if (!canManageConfig) {
      return toast.error("Vous n’avez pas les droits pour tester un SMS.");
    }
    const phone = testSmsPhone.trim();
    if (!phone) return toast.error("Numero requis");
    try {
      setSendingTestSms(true);
      const res = await fetch(`${API_BASE}/api/admin/config/test-sms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.code === 21612) {
          throw new Error(
            "Numero non compatible avec ce numero Twilio. Verifie un numero autorise ou les permissions SMS."
          );
        }
        throw new Error(data.error || "Erreur envoi SMS");
      }
      toast.success(`SMS de test envoye a ${data.to || phone}`);
      setTestSmsPhone("");
      setClosingTestSmsModal(true);
      setTimeout(() => {
        setShowTestSmsModal(false);
        setClosingTestSmsModal(false);
      }, 180);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSendingTestSms(false);
    }
  };

  // ─────────── Render
  if (!canAccessPage) {
    return (
      <div className="p-6 rounded shadow" style={{ background: "var(--bg-card)" }}>
        <h2 className="text-xl font-bold mb-2">Accès refusé</h2>
        <p className="opacity-80">
          Cette section est réservée aux rôles avec la permission{" "}
          <b>site_view</b> ou <b>site_manage</b>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section
        className="p-6 rounded shadow"
        style={{ background: "var(--bg-card)", color: "var(--text-color)" }}
      >
        <h2 className="text-xl font-bold mb-2">Site vitrine</h2>
        <p className="opacity-70 text-sm">
          Gérez uniquement les cartes services du site vitrine .
        </p>
      </section>

      <section
        className="p-6 rounded shadow"
        style={{ background: "var(--bg-card)", color: "var(--text-color)" }}
      >
        <button
          onClick={() => setHistoireOpen((s) => !s)}
          className="w-full flex items-center justify-between mb-4"
        >
          <h3 className="text-lg font-bold">Contenu Histoire</h3>
          <span
            style={{
              transition: "transform 0.25s ease",
              transform: histoireOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            ⌄
          </span>
        </button>
        <div
          className="transition-all duration-300"
          style={{
            maxHeight: histoireOpen ? "800px" : "0",
            overflow: "hidden",
            opacity: histoireOpen ? 1 : 0,
          }}
        >
          {siteContentLoading ? (
            <p className="opacity-70">Chargement contenu…</p>
          ) : (
            <div className="space-y-3">
              <div className="rounded border p-3" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                <div className="text-sm font-semibold mb-1">
                  {siteContent.histoire.modalSubtitle || "Sous-titre non défini"}
                </div>
                <div
                  className="text-sm overflow-hidden"
                  style={{ maxHeight: "150px" }}
                  dangerouslySetInnerHTML={{
                    __html: formatDescriptionPreview(siteContent.histoire.modalBody || "Aucun contenu"),
                  }}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setHistoireDraft({
                      modalSubtitle: siteContent.histoire.modalSubtitle || "",
                      modalBody: siteContent.histoire.modalBody || "",
                    });
                    setHistoireEditorOpen(true);
                  }}
                  className="px-3 py-2 rounded border text-sm inline-flex items-center gap-2"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <FaEdit />
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={() => setHistoirePreviewOpen(true)}
                  className="px-3 py-2 rounded border text-sm inline-flex items-center gap-2"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <FaEye />
                  Visualiser
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {histoireEditorOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center modal-backdrop"
          style={{ background: "rgba(0,0,0,0.6)", zIndex: 10040, padding: "20px" }}
          onClick={() => setHistoireEditorOpen(false)}
        >
          <div
            className="p-6 rounded shadow w-full max-w-3xl modal-panel"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              border: "1px solid var(--border-color)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-base font-semibold mb-2">Modifier Histoire</h4>
            <p className="mb-2 text-[11px] opacity-70">
              Astuce: utilisez **mot** pour gras et *mot* pour italique.
            </p>
            <label className="block text-sm opacity-70 mb-1">Sous-titre</label>
            <input
              className="w-full p-2 rounded border mb-3"
              style={{ borderColor: "var(--border-color)", background: "var(--bg-main)", color: "var(--text-color)" }}
              placeholder="Sous-titre histoire"
              value={histoireDraft.modalSubtitle}
              onChange={(e) => setHistoireDraft((prev) => ({ ...prev, modalSubtitle: e.target.value }))}
            />
            <label className="block text-sm opacity-70 mb-1">Contenu</label>
            <textarea
              className="w-full p-2 rounded border"
              style={{ borderColor: "var(--border-color)", background: "var(--bg-main)", color: "var(--text-color)" }}
              rows={10}
              placeholder="Contenu histoire (texte long)"
              value={histoireDraft.modalBody}
              onChange={(e) => setHistoireDraft((prev) => ({ ...prev, modalBody: e.target.value }))}
            />
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setHistoireEditorOpen(false)}
                className="px-4 py-2 rounded border"
                style={{ borderColor: "var(--border-color)" }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  updateSiteSection("histoire", "modalSubtitle", histoireDraft.modalSubtitle);
                  updateSiteSection("histoire", "modalBody", histoireDraft.modalBody);
                  setHistoireEditorOpen(false);
                }}
                className="px-4 py-2 rounded text-white"
                style={{ background: "var(--accent)" }}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {histoirePreviewOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center modal-backdrop"
          style={{ background: "rgba(0,0,0,0.6)", zIndex: 10040, padding: "20px" }}
          onClick={() => setHistoirePreviewOpen(false)}
        >
          <div
            className="p-6 rounded shadow w-full max-w-3xl modal-panel"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              border: "1px solid var(--border-color)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-base font-semibold mb-2">Aperçu Histoire</h4>
            <div className="text-sm font-semibold mb-2">{siteContent.histoire.modalSubtitle || "Sous-titre non défini"}</div>
            <div
              className="text-sm"
              dangerouslySetInnerHTML={{
                __html: formatDescriptionPreview(siteContent.histoire.modalBody || "Aucun contenu"),
              }}
            />
            <button
              onClick={() => setHistoirePreviewOpen(false)}
              className="mt-4 px-4 py-2 rounded border"
              style={{ borderColor: "var(--border-color)" }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div
          className={`fixed inset-0 flex justify-center items-center modal-backdrop ${closingPasswordModal ? "closing" : ""}`}
          style={{ background: "rgba(0,0,0,0.6)", zIndex: 60 }}
          onClick={() => {
            setClosingPasswordModal(true);
            setTimeout(() => {
              setShowPasswordModal(false);
              setClosingPasswordModal(false);
            }, 180);
          }}
        >
          <div
            ref={passwordModalRef}
            className={`p-6 rounded shadow w-full max-w-md modal-panel ${closingPasswordModal ? "closing" : ""}`}
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              border: "1px solid var(--border-color)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4">Changer le mot de passe</h3>
            {['current', 'next', 'confirm'].map((key, i) => (
              <div key={i} className="mb-3">
                <label className="block text-sm opacity-70 mb-1">
                  {key === 'current'
                    ? 'Mot de passe actuel'
                    : key === 'next'
                    ? 'Nouveau mot de passe'
                    : 'Confirmer'}
                </label>
                <input
                  type="password"
                  value={pwd[key]}
                  onChange={(e) => setPwd({ ...pwd, [key]: e.target.value })}
                  className="w-full p-2 rounded border"
                  style={{
                    background: "var(--bg-card)",
                    color: "var(--text-color)",
                    borderColor: "var(--border-color)",
                  }}
                />
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setClosingPasswordModal(true);
                  setTimeout(() => {
                    setShowPasswordModal(false);
                    setClosingPasswordModal(false);
                  }, 180);
                }}
                className="px-4 py-2 rounded border"
                style={{ borderColor: "var(--border-color)" }}
              >
                Annuler
              </button>
              <button
                onClick={savePassword}
                disabled={savingPassword}
                className="px-4 py-2 rounded flex items-center gap-2 disabled:opacity-70"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                {savingPassword ? (
                  <AiOutlineLoading3Quarters className="animate-spin" />
                ) : (
                  <FaSave />
                )}
                Mettre ? jour
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ──────────────── Section Services (RBAC) */}
      {canViewServices && (
        <section
          className="p-6 rounded shadow theme-fade"
          style={{ background: "var(--bg-card)", color: "var(--text-color)" }}
        >
          <button
            onClick={() => setServicesOpen((s) => !s)}
            className="w-full flex items-center justify-between mb-4"
          >
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FaWrench />
              Gestion des services
            </h2>
            <span
              style={{
                transition: "transform 0.25s ease",
                transform: servicesOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              ⌄
            </span>
          </button>
          <div
            className="transition-all duration-300"
            style={{
              maxHeight: servicesOpen ? "2000px" : "0",
              overflow: "hidden",
              opacity: servicesOpen ? 1 : 0,
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
              <thead
                style={{ color: "var(--muted)", borderColor: "var(--border-color)" }}
              >
                <tr>
                  <th className="px-3 py-2 text-left">Icône</th>
                  <th className="px-3 py-2 text-left">Nom</th>
                  <th className="px-3 py-2 text-left">Prix (FCFA)</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingServices ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center opacity-70">
                      <AiOutlineLoading3Quarters className="inline animate-spin mr-2" />
                      Chargement...
                    </td>
                  </tr>
                ) : services.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center opacity-70">
                      Aucun service.
                    </td>
                  </tr>
                ) : (
                  services.map((s) => (
                    <tr key={s.id} style={{ borderColor: "var(--border-color)" }}>
                      <td className="px-3 py-2">
                        {(() => {
                          const iconValue = s.icon || s.icon_url || "";
                          const isVirtual =
                            typeof iconValue === "string" &&
                            /^[a-z0-9]+:/i.test(iconValue);

                          if (iconValue && isVirtual) {
                            return renderIcon(iconValue, 22);
                          }
                          if (s.icon_url && !isVirtual) {
                            return (
                              <img
                                src={s.icon_url && s.icon_url.startsWith('http') ? s.icon_url : `${API_BASE.replace(/\/api$/, '')}/${s.icon_url || ''}`}
                                alt=""
                                className="w-7 h-7 object-contain"
                              />
                            );
                          }
                          return (
                            <div
                              className="w-7 h-7 rounded flex items-center justify-center opacity-50"
                              style={{ background: "var(--bg-card)" }}
                            >
                              <FaPlus />
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2 font-medium">{s.name}</td>
                      <td className="px-3 py-2">{Number(s.price).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right space-x-2">
                        <button
                          onClick={() => openServiceEditor(s)}
                          disabled={!canManageServices}
                          className="px-3 py-1 rounded border inline-flex items-center justify-center disabled:opacity-60"
                          style={{ borderColor: "var(--border-color)" }}
                          title={
                            canManageServices ? "Modifier" : "Droit requis: services_manage"
                          }
                        >
                          <FaEdit />
                        </button>
                        {!isPinnedProtectedService(s.name) && (
                          <button
                            onClick={() => deleteService(s)}
                            disabled={!canManageServices}
                            className="px-3 py-1 rounded"
                            style={{ background: "#e5372e", color: "#fff" }}
                            title={
                              canManageServices ? "" : "Droit requis: services_manage"
                            }
                          >
                            <FaTrash />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              </table>
            </div>

            {canManageServices && (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setClosingAddServiceModal(false);
                    setShowAddServiceModal(true);
                  }}
                  className="px-4 py-2 rounded flex items-center gap-2"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  <FaPlus />
                  Ajouter un service
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {confirmService && (
        <div
          className={`fixed inset-0 flex justify-center items-center modal-backdrop ${closingConfirmService ? "closing" : ""}`}
          style={{ background: "rgba(0,0,0,0.6)", zIndex: 60 }}
          onClick={() => {
            if (confirmServiceLoading) return;
            setClosingConfirmService(true);
            setTimeout(() => {
              setConfirmService(null);
              setClosingConfirmService(false);
            }, 180);
          }}
        >
          <div
            ref={confirmServiceModalRef}
            className={`p-6 rounded shadow w-full max-w-md modal-panel ${closingConfirmService ? "closing" : ""}`}
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              border: "1px solid var(--border-color)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-2">Supprimer le service</h3>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Supprimer définitivement{" "}
              <span className="font-semibold" style={{ color: "var(--text-color)" }}>
                {confirmService?.name || "ce service"}
              </span>
              ?
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  if (confirmServiceLoading) return;
                  setClosingConfirmService(true);
                  setTimeout(() => {
                    setConfirmService(null);
                    setClosingConfirmService(false);
                  }, 180);
                }}
                className="px-4 py-2 rounded"
                style={{
                  background: "transparent",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-color)",
                }}
                disabled={confirmServiceLoading}
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  const ok = await performDeleteService(confirmService);
                  if (ok) {
                    setClosingConfirmService(true);
                    setTimeout(() => {
                      setConfirmService(null);
                      setClosingConfirmService(false);
                    }, 180);
                  }
                }}
                className="px-4 py-2 rounded text-white disabled:opacity-60 flex items-center gap-2"
                style={{ background: "#e5372e" }}
                disabled={confirmServiceLoading}
              >
                {confirmServiceLoading ? "..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showAddServiceModal && (
        <div
          className={`fixed inset-0 flex items-center justify-center modal-backdrop ${closingAddServiceModal ? "closing" : ""}`}
          style={{ background: "rgba(0,0,0,0.6)", zIndex: 9999, padding: "20px" }}
          onClick={() => {
            if (adding) return;
            setClosingAddServiceModal(true);
            setTimeout(() => {
              setShowAddServiceModal(false);
              setClosingAddServiceModal(false);
            }, 180);
          }}
        >
          <div
            ref={addServiceModalRef}
            className={`p-6 rounded shadow w-full max-w-2xl modal-panel ${closingAddServiceModal ? "closing" : ""}`}
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              border: "1px solid var(--border-color)",
              position: "relative",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-1 flex items-center gap-2 text-lg">
              <FaPlus />
              Ajouter un service
            </h3>
            <p className="text-sm opacity-70 mb-4">
              Renseigne les infos principales puis vérifie les aperçus avant d’ajouter.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm opacity-70 mb-1">Nom</label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full p-2 rounded border"
                  style={{
                    background: "var(--bg-main)",
                    color: "var(--text-color)",
                    borderColor: "var(--border-color)",
                  }}
                  placeholder="Ex: Remorquage"
                />
              </div>
              <div>
                <label className="block text-sm opacity-70 mb-1">Prix (FCFA)</label>
                <input
                  type="number"
                  step="0.1"
                  value={addForm.price}
                  onChange={(e) => setAddForm({ ...addForm, price: e.target.value })}
                  className="w-full p-2 rounded border"
                  style={{
                    background: "var(--bg-main)",
                    color: "var(--text-color)",
                    borderColor: "var(--border-color)",
                  }}
                  placeholder="Ex: 150"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm opacity-70 mb-1">Sous-titre (aperçu)</label>
                <input
                  type="text"
                  value={addForm.subtitle}
                  onChange={(e) =>
                    setAddForm({ ...addForm, subtitle: e.target.value })
                  }
                  className="w-full p-2 rounded border"
                  style={{
                    background: "var(--bg-main)",
                    color: "var(--text-color)",
                    borderColor: "var(--border-color)",
                  }}
                  placeholder="Texte court affiché sur la carte"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm opacity-70 mb-1">Description</label>
                <p className="mb-1 text-[11px] opacity-60">
                  Astuce: utilisez **mot** pour gras et *mot* pour italique.
                </p>
                <textarea
                  value={addForm.description}
                  onChange={(e) =>
                    setAddForm({ ...addForm, description: e.target.value })
                  }
                  className="w-full p-2 rounded border min-h-[90px]"
                  style={{
                    background: "var(--bg-main)",
                    color: "var(--text-color)",
                    borderColor: "var(--border-color)",
                  }}
                  placeholder="Texte affiché dans la carte service (**gras** / *italique*)"
                />
                <div className="mt-2 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setDescriptionViewerContent(
                        formatDescriptionPreview(addForm.description || "Aucun texte pour l’instant.")
                      );
                      setDescriptionViewerOpen(true);
                    }}
                    className="px-3 py-2 rounded border text-sm inline-flex items-center gap-2"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <FaEye />
                    Visualiser
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setAddForm((prev) => ({
                        ...prev,
                        description: String(prev.description || "").trim(),
                      }))
                    }
                    className="px-3 py-2 rounded text-white text-sm inline-flex items-center gap-2"
                    style={{ background: "var(--accent)" }}
                  >
                    <FaSave />
                    Enregistrer
                  </button>
                </div>
              </div>
              <div className="md:col-span-2 flex items-center justify-between rounded border px-3 py-3" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                <div>
                  <div className="text-sm font-semibold">Service interne</div>
                  <p className="text-xs opacity-70">Si activé, ce service ne sort pas dans les listes publiques.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddForm((prev) => ({ ...prev, is_internal: !prev.is_internal }))}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${addForm.is_internal ? "bg-blue-500" : "bg-zinc-600"}`}
                  aria-pressed={addForm.is_internal}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${addForm.is_internal ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm opacity-70 mb-2">Photo de la carte</label>
                <div className="flex gap-4 items-end">
                  <div className="flex flex-col">
                    <span className="text-xs opacity-70 mb-1">Aperçu</span>
                    <div
                      className="w-32 h-20 rounded border flex items-center justify-center overflow-hidden"
                      style={{
                        background: "var(--bg-main)",
                        borderColor: "var(--border-color)",
                      }}
                    >
                      {addImagePreview ? (
                        <img
                          src={addImagePreview}
                          alt="Aperçu"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs opacity-60 px-2 text-center">Aucune image</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => document.getElementById("add-service-image-input")?.click()}
                      className="p-2 rounded border inline-flex items-center justify-center"
                      style={{ borderColor: "var(--border-color)" }}
                      title="Modifier l'image"
                    >
                      <FaEdit />
                    </button>
                    {addImagePreview && (
                      <button
                        type="button"
                        onClick={() => {
                          setImageViewerUrl(addImagePreview);
                          setImageViewerOpen(true);
                        }}
                        className="p-2 rounded border inline-flex items-center justify-center"
                        style={{ borderColor: "var(--border-color)" }}
                        title="Visualiser"
                      >
                        <FaEye />
                      </button>
                    )}
                  </div>
                </div>
                <input
                  id="add-service-image-input"
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setAddImageFile(file);
                    setAddImagePreview(URL.createObjectURL(file));
                  }}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm opacity-70 mb-2">Icône</label>
                <div className="flex gap-4 items-end">
                  <div className="flex flex-col">
                    <span className="text-xs opacity-70 mb-1">Aperçu</span>
                    <div
                      className="w-16 h-16 rounded border flex items-center justify-center"
                      style={{
                        background: "var(--bg-main)",
                        borderColor: "var(--border-color)",
                      }}
                    >
                      {addForm.icon ? renderIcon(addForm.icon, 30) : <FaPlus className="opacity-50" />}
                    </div>
                  </div>

                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      value={addForm.icon}
                      onChange={(e) => {
                        setAddForm({ ...addForm, icon: e.target.value });
                        setIconSearch(e.target.value);
                      }}
                      onFocus={() => setIconPickerOpen(true)}
                      className="flex-1 p-2 rounded border"
                      style={{
                        background: "var(--bg-main)",
                        color: "var(--text-color)",
                        borderColor: "var(--border-color)",
                      }}
                      placeholder="Tape le nom de l’icône ici…"
                    />
                    <button
                      type="button"
                      onClick={() => setIconPickerOpen((s) => !s)}
                      className="px-3 py-2 rounded border text-sm"
                      style={{ borderColor: "var(--border-color)" }}
                    >
                      Suggestions
                    </button>
                  </div>
                </div>

                {iconPickerOpen && (
                    <div
                      className="mt-2 p-3 rounded border shadow-sm grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-auto"
                      style={{
                        background: "var(--bg-main)",
                        borderColor: "var(--border-color)",
                      }}
                    >
                      {iconsLoading && (
                        <div className="col-span-2 md:col-span-3 text-sm opacity-70">
                          Chargement des icônes…
                        </div>
                      )}
                      {!iconsLoading && filteredIcons.length === 0 && (
                        <div className="col-span-2 md:col-span-3 text-sm opacity-70">
                          Aucune correspondance. Essaie un autre mot-clé.
                        </div>
                      )}
                      {!iconsLoading &&
                        filteredIcons.map((ico) => (
                          <button
                            key={ico.key}
                            type="button"
                            onClick={() => {
                              const value = `${ico.pack}:${ico.name}`;
                              setAddForm((f) => ({ ...f, icon: value }));
                              setIconSearch(value);
                              setIconPickerOpen(false);
                            }}
                            className="flex items-center gap-2 p-2 rounded border text-left hover:border-[var(--accent)]"
                            style={{
                              background: "var(--bg-card)",
                              color: "var(--text-color)",
                              borderColor: "var(--border-color)",
                            }}
                          >
                            <ico.Comp style={{ fontSize: 18 }} />
                            <div>
                              <div className="text-sm font-medium capitalize">{ico.label}</div>
                              <div className="text-xs opacity-70">{ico.pack}:{ico.name}</div>
                            </div>
                          </button>
                        ))}
                      {!iconsLoading && filteredIcons.length === 200 && (
                        <div className="col-span-2 md:col-span-3 text-xs opacity-60">
                          Résultats limités à 200 pour éviter les lags. Raffine la recherche.
                        </div>
                      )}
                    </div>
                  )}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setClosingAddServiceModal(true);
                  setTimeout(() => {
                    setShowAddServiceModal(false);
                    setClosingAddServiceModal(false);
                    setAddImageFile(null);
                    setAddImagePreview("");
                  }, 180);
                }}
                className="px-4 py-2 rounded border"
                style={{ borderColor: "var(--border-color)" }}
              >
                Annuler
              </button>
              <button
                onClick={addService}
                disabled={adding}
                style={{ background: "var(--accent)", color: "#fff" }}
                className="px-4 py-2 rounded flex items-center gap-2 disabled:opacity-70"
              >
                {adding ? (
                  <AiOutlineLoading3Quarters className="animate-spin" />
                ) : (
                  <FaPlus />
                )}
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {editingService && (
        <div
          className={`fixed inset-0 flex items-center justify-center modal-backdrop ${closingEditServiceModal ? "closing" : ""}`}
          style={{ background: "rgba(0,0,0,0.6)", zIndex: 10000, padding: "20px" }}
          onClick={closeServiceEditor}
        >
          <div
            className={`p-6 rounded shadow w-full max-w-2xl modal-panel ${closingEditServiceModal ? "closing" : ""}`}
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              border: "1px solid var(--border-color)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4">{editServiceOriginal?.name}</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Nom du service</label>
                <input
                  type="text"
                  value={editServiceDraft.name || ""}
                  onChange={(e) =>
                    setEditServiceDraft((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full p-2 rounded border"
                  style={{
                    background: "var(--bg-main)",
                    color: "var(--text-color)",
                    borderColor: "var(--border-color)",
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Sous-titre (carte)</label>
                <input
                  type="text"
                  value={editServiceDraft.subtitle || ""}
                  onChange={(e) =>
                    setEditServiceDraft((prev) => ({ ...prev, subtitle: e.target.value }))
                  }
                  className="w-full p-2 rounded border"
                  style={{
                    background: "var(--bg-main)",
                    color: "var(--text-color)",
                    borderColor: "var(--border-color)",
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Description</label>
                <div
                  className="p-3 rounded border text-sm overflow-hidden"
                  style={{
                    background: "var(--bg-main)",
                    borderColor: "var(--border-color)",
                    maxHeight: "110px",
                  }}
                  dangerouslySetInnerHTML={{
                    __html: formatDescriptionPreview(editServiceDraft.description || "Aucun texte"),
                  }}
                />
                <div className="mt-2 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setDescriptionEditorDraft(editServiceDraft.description || "");
                      setDescriptionEditorOpen(true);
                    }}
                    className="px-3 py-2 rounded border text-sm inline-flex items-center gap-2"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <FaEdit />
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDescriptionViewerContent(
                        formatDescriptionPreview(editServiceDraft.description || "Aucun texte")
                      );
                      setDescriptionViewerOpen(true);
                    }}
                    className="px-3 py-2 rounded border text-sm inline-flex items-center gap-2"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <FaEye />
                    Visualiser
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Prix (FCFA)</label>
                <input
                  type="number"
                  step="0.1"
                  value={editServiceDraft.price || ""}
                  onChange={(e) =>
                    setEditServiceDraft((prev) => ({ ...prev, price: e.target.value }))
                  }
                  className="w-full p-2 rounded border"
                  style={{
                    background: "var(--bg-main)",
                    color: "var(--text-color)",
                    borderColor: "var(--border-color)",
                  }}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm opacity-70 mb-2">Photo de la carte</label>
                <div className="flex gap-4 items-end">
                  <div className="flex flex-col">
                    <span className="text-xs opacity-70 mb-1">Aperçu</span>
                    <div
                      className="w-32 h-20 rounded border flex items-center justify-center overflow-hidden"
                      style={{
                        background: "var(--bg-main)",
                        borderColor: "var(--border-color)",
                      }}
                    >
                      {editServiceDraft.image_file || normalizeOptionalValue(editServiceOriginal?.image_url) ? (
                        <img
                          src={
                            editServiceDraft.image_file
                              ? URL.createObjectURL(editServiceDraft.image_file)
                              : toAssetUrl(normalizeOptionalValue(editServiceOriginal?.image_url))
                          }
                          alt="Aperçu"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs opacity-60 px-2 text-center">Aucune image</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => document.getElementById(`edit-service-image-input-${editingService.id}`)?.click()}
                      className="p-2 rounded border inline-flex items-center justify-center"
                      style={{ borderColor: "var(--border-color)" }}
                      title="Modifier l'image"
                    >
                      <FaEdit />
                    </button>
                    {(editServiceDraft.image_file || normalizeOptionalValue(editServiceOriginal?.image_url)) && (
                      <button
                        type="button"
                        onClick={() => {
                          const src = editServiceDraft.image_file
                            ? URL.createObjectURL(editServiceDraft.image_file)
                            : toAssetUrl(normalizeOptionalValue(editServiceOriginal?.image_url));
                          setImageViewerUrl(src);
                          setImageViewerOpen(true);
                        }}
                        className="p-2 rounded border inline-flex items-center justify-center"
                        style={{ borderColor: "var(--border-color)" }}
                        title="Visualiser"
                      >
                        <FaEye />
                      </button>
                    )}
                  </div>
                </div>
                <input
                  id={`edit-service-image-input-${editingService.id}`}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setEditServiceDraft((prev) => ({ ...prev, image_file: file }));
                    }
                  }}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm opacity-70 mb-2">Icône</label>
                <div className="flex gap-4 items-end">
                  <div className="flex flex-col">
                    <span className="text-xs opacity-70 mb-1">Aperçu</span>
                    <div
                      className="w-16 h-16 rounded border flex items-center justify-center overflow-hidden"
                      style={{
                        background: "var(--bg-main)",
                        borderColor: "var(--border-color)",
                      }}
                    >
                      {editServiceDraft.icon ? (
                        renderIcon(editServiceDraft.icon, 30)
                      ) : normalizeOptionalValue(editServiceOriginal?.icon_url) ? (
                        <img
                          src={toAssetUrl(normalizeOptionalValue(editServiceOriginal?.icon_url))}
                          alt="Icône service"
                          className="w-9 h-9 object-contain"
                        />
                      ) : (
                        <FaPlus className="opacity-50" />
                      )}
                    </div>
                  </div>

                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      value={editServiceDraft.icon || ""}
                      onChange={(e) => {
                        setEditServiceDraft((prev) => ({ ...prev, icon: e.target.value }));
                        setIconSearch(e.target.value);
                      }}
                      onFocus={() => setEditServiceIconPickerOpen(true)}
                      className="flex-1 p-2 rounded border"
                      style={{
                        background: "var(--bg-main)",
                        color: "var(--text-color)",
                        borderColor: "var(--border-color)",
                      }}
                      placeholder="Tape le nom de l’icône ici…"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIconSearch(editServiceDraft.icon || "");
                        setEditServiceIconPickerOpen((s) => !s);
                      }}
                      className="px-3 py-2 rounded border text-sm"
                      style={{ borderColor: "var(--border-color)" }}
                    >
                      Suggestions
                    </button>
                  </div>
                </div>

                {editServiceIconPickerOpen && (
                  <div
                    className="mt-2 p-3 rounded border shadow-sm grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-auto"
                    style={{
                      background: "var(--bg-main)",
                      borderColor: "var(--border-color)",
                    }}
                  >
                    {iconsLoading && (
                      <div className="col-span-2 md:col-span-3 text-sm opacity-70">
                        Chargement des icônes…
                      </div>
                    )}
                    {!iconsLoading && filteredIcons.length === 0 && (
                      <div className="col-span-2 md:col-span-3 text-sm opacity-70">
                        Aucune correspondance. Essaie un autre mot-clé.
                      </div>
                    )}
                    {!iconsLoading &&
                      filteredIcons.map((ico) => (
                        <button
                          key={`edit-${ico.key}`}
                          type="button"
                          onClick={() => {
                            const value = `${ico.pack}:${ico.name}`;
                            setEditServiceDraft((prev) => ({ ...prev, icon: value }));
                            setIconSearch(value);
                            setEditServiceIconPickerOpen(false);
                          }}
                          className="flex items-center gap-2 p-2 rounded border text-left hover:border-[var(--accent)]"
                          style={{
                            background: "var(--bg-card)",
                            color: "var(--text-color)",
                            borderColor: "var(--border-color)",
                          }}
                        >
                          <ico.Comp style={{ fontSize: 18 }} />
                          <div>
                            <div className="text-sm font-medium capitalize">{ico.label}</div>
                            <div className="text-xs opacity-70">{ico.pack}:{ico.name}</div>
                          </div>
                        </button>
                      ))}
                    {!iconsLoading && filteredIcons.length === 200 && (
                      <div className="col-span-2 md:col-span-3 text-xs opacity-60">
                        Résultats limités à 200 pour éviter les lags. Raffine la recherche.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex gap-2 justify-end">
              <button
                onClick={closeServiceEditor}
                disabled={closingEditServiceModal}
                className="px-4 py-2 rounded border disabled:opacity-60"
                style={{ borderColor: "var(--border-color)" }}
              >
                Annuler
              </button>
              <button
                onClick={saveServiceFromModal}
                disabled={closingEditServiceModal || inlineSaving === editingService.id}
                className="px-4 py-2 rounded text-white disabled:opacity-60"
                style={{ background: "var(--accent)" }}
              >
                {inlineSaving === editingService.id ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {descriptionEditorOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center modal-backdrop"
          style={{ background: "rgba(0,0,0,0.6)", zIndex: 10050, padding: "20px" }}
          onClick={() => setDescriptionEditorOpen(false)}
        >
          <div
            className="p-6 rounded shadow w-full max-w-2xl modal-panel"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              border: "1px solid var(--border-color)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-base font-semibold mb-2">Modifier la description</h4>
            <p className="mb-2 text-[11px] opacity-70">
              Astuce: utilisez **mot** pour gras et *mot* pour italique.
            </p>
            <textarea
              value={descriptionEditorDraft}
              onChange={(e) => setDescriptionEditorDraft(e.target.value)}
              rows={8}
              className="w-full p-2 rounded border"
              style={{
                background: "var(--bg-main)",
                color: "var(--text-color)",
                borderColor: "var(--border-color)",
              }}
              placeholder="Vous pouvez utiliser **gras** et *italique*"
            />
            <div className="mt-3 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDescriptionEditorOpen(false)}
                className="px-3 py-2 rounded border text-sm"
                style={{ borderColor: "var(--border-color)" }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditServiceDraft((prev) => ({ ...prev, description: descriptionEditorDraft }));
                  setDescriptionEditorOpen(false);
                }}
                className="px-3 py-2 rounded text-white text-sm"
                style={{ background: "var(--accent)" }}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {descriptionViewerOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center modal-backdrop"
          style={{ background: "rgba(0,0,0,0.6)", zIndex: 10050, padding: "20px" }}
          onClick={() => setDescriptionViewerOpen(false)}
        >
          <div
            className="p-6 rounded shadow w-full max-w-2xl modal-panel"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              border: "1px solid var(--border-color)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="text-sm"
              dangerouslySetInnerHTML={{ __html: descriptionViewerContent }}
            />
            <button
              onClick={() => setDescriptionViewerOpen(false)}
              className="mt-4 px-4 py-2 rounded border"
              style={{ borderColor: "var(--border-color)" }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {imageViewerOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center modal-backdrop"
          style={{ background: "rgba(0,0,0,0.9)", zIndex: 10050, padding: "20px" }}
          onClick={() => setImageViewerOpen(false)}
        >
          <div className="relative max-w-4xl max-h-full">
            <img src={imageViewerUrl} alt="Aperçu" className="w-full h-auto rounded" />
            <button
              onClick={() => setImageViewerOpen(false)}
              className="absolute top-2 right-2 p-2 rounded"
              style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}
              title="Fermer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

