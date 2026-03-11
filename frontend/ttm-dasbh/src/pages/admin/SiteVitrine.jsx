// src/pages/admin/SiteVitrine.jsx
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
import { FaEdit, FaSave, FaTrash, FaPlus, FaPercent, FaWrench, FaKey, FaBriefcase, FaHeadset, FaPaperPlane } from "react-icons/fa";
import { FaRegCircleUser } from "react-icons/fa6";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { API_BASE } from "../../config/urls";
import { useAuth } from "../../context/AuthContext";
import { can, isSuper } from "../../utils/rbac"; // ✅ RBAC (même pattern)
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
    const [packPrefix, rawName] =
      raw.includes(":") ? raw.split(":") : [null, raw];
    const key = (packPrefix ? rawName : raw).toLowerCase();
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
    if (iconList.length > 0) {
      const found = iconList.find((i) => i.name === iconName);
      Comp = found?.Comp || FaWrench;
    } else {
      const resolved = resolveIcon(iconName);
      if (resolved) Comp = resolved;
    }
    return <Comp style={{ fontSize: size }} />;
  };

  const toAssetUrl = (value) => {
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    const base = API_BASE.replace(/\/api$/, "");
    const path = String(value).startsWith("/") ? value : `/${value}`;
    return `${base}${path}`;
  };

  // Chargement paresseux de la grosse liste d'icônes (évite de bloquer au montage)
  useEffect(() => {
    if (!iconPickerOpen || iconList.length > 0 || iconsLoading) return;
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
  }, [iconPickerOpen, iconList.length, iconsLoading]);

  const filteredIcons = useMemo(() => {
    if (!iconList.length) return [];
    const q = (iconSearch || addForm.icon || "").toLowerCase().trim();
    const matches = iconList.filter((ico) => {
      if (!q) return true;
      return (
        ico.name.includes(q) ||
        ico.label.toLowerCase().includes(q)
      );
    });
    // limiter l'affichage pour ne pas lagger l'UI
    return matches.slice(0, 200);
  }, [iconList, iconSearch, addForm.icon]);

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
      setServices(data.data || []);
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

      // ✅ map sur la réponse du backend
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
    loadSiteContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLogged, canViewServices, canViewConfig]);

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
      toast.success("Contenu vitrine mis à jour ✅");
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
        <h2 className="text-xl font-bold text-red-500">⛔ Accès refusé</h2>
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
      toast.success("Profil mis à jour ✅");
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
      toast.success("Mot de passe mis à jour ✅");
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
      toast.success(`Service "${srv.name}" mis à jour ✅`);
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

  const performDeleteService = async (srv) => {
    if (!canManageServices) {
      return toast.error(
        "Vous n’avez pas les droits pour supprimer un service."
      );
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
      toast.success(`Service "${srv.name}" supprimé ✅`);
      setServices((prev) => prev.filter((s) => s.id !== srv.id));
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    } finally {
      setConfirmServiceLoading(false);
    }
  };

  const deleteService = (srv) => {
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
      toast.success("Service ajouté ✅");
      setAddForm({ name: "", subtitle: "", description: "", price: "", icon: "" });
      setAddImageFile(null);
      setAddImagePreview("");
      setIconPickerOpen(false);
      setClosingAddServiceModal(true);
      setTimeout(() => {
        setShowAddServiceModal(false);
        setClosingAddServiceModal(false);
      }, 180);
      setServices((prev) => [data.data, ...prev]);
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
      toast.success("Paramètres business mis à jour ✅");
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
      toast.success("Coordonnées service client mises à jour ✅");
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
              <input
                className="w-full p-2 rounded border"
                style={{ borderColor: "var(--border-color)", background: "var(--bg-card)", color: "var(--text-color)" }}
                placeholder="Sous-titre histoire"
                value={siteContent.histoire.modalSubtitle || ""}
                onChange={(e) => updateSiteSection("histoire", "modalSubtitle", e.target.value)}
              />
              <textarea
                className="w-full p-2 rounded border"
                style={{ borderColor: "var(--border-color)", background: "var(--bg-card)", color: "var(--text-color)" }}
                rows={10}
                placeholder="Contenu histoire (texte long)"
                value={siteContent.histoire.modalBody || ""}
                onChange={(e) => updateSiteSection("histoire", "modalBody", e.target.value)}
              />
              <button
                onClick={saveSiteContent}
                disabled={siteContentSaving || !canManageSiteContent}
                className="px-4 py-2 rounded text-white disabled:opacity-60"
                style={{ background: "var(--accent)" }}
              >
                {siteContentSaving ? "Sauvegarde..." : "Sauvegarder Histoire"}
              </button>
            </div>
          )}
        </div>
      </section>

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
                  <th className="px-3 py-2 text-left">Sous-titre</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-left">Image carte</th>
                  <th className="px-3 py-2 text-left">Prix (FCFA)</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingServices ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center opacity-70">
                      <AiOutlineLoading3Quarters className="inline animate-spin mr-2" />
                      Chargement...
                    </td>
                  </tr>
                ) : services.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center opacity-70">
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
                                src={`${API_BASE.replace(/\/api$/, "")}${s.icon_url}`}
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
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={s.name || ""}
                          onChange={(e) =>
                            setServices((prev) =>
                              prev.map((x) =>
                                x.id === s.id
                                  ? { ...x, name: e.target.value }
                                  : x
                              )
                            )
                          }
                          disabled={!canManageServices}
                          className="w-44 p-2 rounded border"
                          style={{
                            background: "var(--bg-card)",
                            color: "var(--text-color)",
                            borderColor: "var(--border-color)",
                          }}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={s.subtitle || ""}
                          onChange={(e) =>
                            setServices((prev) =>
                              prev.map((x) =>
                                x.id === s.id
                                  ? { ...x, subtitle: e.target.value }
                                  : x
                              )
                            )
                          }
                          disabled={!canManageServices}
                          className="w-56 p-2 rounded border"
                          style={{
                            background: "var(--bg-card)",
                            color: "var(--text-color)",
                            borderColor: "var(--border-color)",
                          }}
                          placeholder="Aperçu court (carte)"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <textarea
                          value={s.description || ""}
                          onChange={(e) =>
                            setServices((prev) =>
                              prev.map((x) =>
                                x.id === s.id
                                  ? { ...x, description: e.target.value }
                                  : x
                              )
                            )
                          }
                          disabled={!canManageServices}
                          className="w-64 p-2 rounded border min-h-[72px]"
                          style={{
                            background: "var(--bg-card)",
                            color: "var(--text-color)",
                            borderColor: "var(--border-color)",
                          }}
                          placeholder="Texte de la carte service"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-2">
                          {(rowImagePreviews[s.id] || s.image_url) && (
                            <img
                              src={rowImagePreviews[s.id] || toAssetUrl(s.image_url)}
                              alt={s.name}
                              className="w-28 h-16 rounded object-cover border"
                              style={{ borderColor: "var(--border-color)" }}
                            />
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            disabled={!canManageServices}
                            className="w-56 p-2 rounded border text-sm"
                            style={{
                              background: "var(--bg-card)",
                              color: "var(--text-color)",
                              borderColor: "var(--border-color)",
                            }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const preview = URL.createObjectURL(file);
                              setRowImageFiles((prev) => ({ ...prev, [s.id]: file }));
                              setRowImagePreviews((prev) => ({ ...prev, [s.id]: preview }));
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.1"
                          value={s.price}
                          onChange={(e) =>
                            setServices((prev) =>
                              prev.map((x) =>
                                x.id === s.id
                                  ? { ...x, price: e.target.value }
                                  : x
                              )
                            )
                          }
                          disabled={!canManageServices}
                          className="w-32 p-2 rounded border"
                          style={{
                            background: "var(--bg-card)",
                            color: "var(--text-color)",
                            borderColor: "var(--border-color)",
                          }}
                        />
                      </td>
                      <td className="px-3 py-2 text-right space-x-2">
                        <button
                          onClick={() => saveInlinePrice(s)}
                          disabled={inlineSaving === s.id || !canManageServices}
                          style={{ background: "var(--accent)", color: "#fff" }}
                          className="px-3 py-1 rounded disabled:opacity-70"
                          title={
                            canManageServices ? "" : "Droit requis: services_manage"
                          }
                        >
                          {inlineSaving === s.id ? (
                            <AiOutlineLoading3Quarters className="inline animate-spin" />
                          ) : (
                            <FaSave className="inline" />
                          )}
                        </button>
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
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <FaPlus />
              Ajouter un service
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm opacity-70 mb-1">Nom</label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full p-2 rounded border"
                  style={{
                    background: "var(--bg-card)",
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
                    background: "var(--bg-card)",
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
                    background: "var(--bg-card)",
                    color: "var(--text-color)",
                    borderColor: "var(--border-color)",
                  }}
                  placeholder="Texte court affiché sur la carte"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm opacity-70 mb-1">Description</label>
                <textarea
                  value={addForm.description}
                  onChange={(e) =>
                    setAddForm({ ...addForm, description: e.target.value })
                  }
                  className="w-full p-2 rounded border min-h-[90px]"
                  style={{
                    background: "var(--bg-card)",
                    color: "var(--text-color)",
                    borderColor: "var(--border-color)",
                  }}
                  placeholder="Texte affiché dans la carte service"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm opacity-70 mb-1">Photo de la carte</label>
                <input
                  type="file"
                  accept="image/*"
                  className="w-full p-2 rounded border"
                  style={{
                    background: "var(--bg-card)",
                    color: "var(--text-color)",
                    borderColor: "var(--border-color)",
                  }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setAddImageFile(file);
                    setAddImagePreview(URL.createObjectURL(file));
                  }}
                />
                {addImagePreview && (
                  <img
                    src={addImagePreview}
                    alt="Aperçu"
                    className="mt-2 h-24 rounded object-cover border"
                    style={{ borderColor: "var(--border-color)" }}
                  />
                )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm opacity-70 mb-1">Icône</label>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
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
                        background: "var(--bg-card)",
                        color: "var(--text-color)",
                        borderColor: "var(--border-color)",
                      }}
                      placeholder="Tape le nom de l´icône ici …"
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
                  {iconPickerOpen && (
                    <div
                      className="p-3 rounded border shadow-sm grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-auto"
                      style={{
                        background: "var(--bg-card)",
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
    </div>
  )
}

