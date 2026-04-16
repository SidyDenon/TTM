// src/pages/admin/Settings.jsx
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
import { FaEdit, FaSave, FaTrash, FaPlus, FaPercent, FaWrench, FaKey, FaBriefcase, FaHeadset, FaPaperPlane, FaEye, FaEyeSlash } from "react-icons/fa";
import { FaRegCircleUser } from "react-icons/fa6";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { API_BASE, buildAssetUrl } from "../../config/urls";
import { useAuth } from "../../context/AuthContext";
import { can, isSuper } from "../../utils/rbac"; // ✅ RBAC (même pattern)
import { useModalOrigin } from "../../hooks/useModalOrigin";

export default function Settings() {
  const { user, token, updateUser } = useAuth();

  // ─────────── Permissions (RBAC)
  const canViewServices =
    isSuper(user) || can(user, "services_view") || can(user, "services_manage");
  const canManageServices = isSuper(user) || can(user, "services_manage");

  const canViewConfig =
    isSuper(user) || can(user, "config_view") || can(user, "config_manage");
  const canManageConfig = isSuper(user) || can(user, "config_manage");

  // La page reste accessible (profil) ; sections Services/Business sont déplacées
  const canAccessPage = true;
  const showVitrineSections = true;

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
  const [togglingVisibilityServiceId, setTogglingVisibilityServiceId] = useState(null);
  const [openServiceActionMenuId, setOpenServiceActionMenuId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", price: "", icon: "" });
  const [servicesOpen, setServicesOpen] = useState(true);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [closingAddServiceModal, setClosingAddServiceModal] = useState(false);
  const [showOilManagerModal, setShowOilManagerModal] = useState(false);
  const [closingOilManagerModal, setClosingOilManagerModal] = useState(false);
  const [oilManagerService, setOilManagerService] = useState(null);
  const [showTowingManagerModal, setShowTowingManagerModal] = useState(false);
  const [closingTowingManagerModal, setClosingTowingManagerModal] = useState(false);
  const [towingManagerService, setTowingManagerService] = useState(null);
  const [oilModels, setOilModels] = useState([]);
  const [loadingOilModels, setLoadingOilModels] = useState(false);
  const [inlineOilSaving, setInlineOilSaving] = useState(null);
  const [deletingOilModel, setDeletingOilModel] = useState(null);
  const [openOilActionMenuId, setOpenOilActionMenuId] = useState(null);
  const [addingOilModel, setAddingOilModel] = useState(false);
  const [newOilModel, setNewOilModel] = useState({
    name: "",
    price_1l: "",
    price_4l: "",
    price_5l: "",
    price_20l: "",
    is_active: true,
  });
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
  const oilManagerModalRef = useModalOrigin(showOilManagerModal);
  const towingManagerModalRef = useModalOrigin(showTowingManagerModal);
  const testSmsModalRef = useModalOrigin(showTestSmsModal);

  useEffect(() => {
    if (!openServiceActionMenuId) return;
    const handler = (e) => {
      if (!e.target.closest(".service-row-actions-menu")) {
        setOpenServiceActionMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openServiceActionMenuId]);

  useEffect(() => {
    if (!openOilActionMenuId) return;
    const handler = (e) => {
      if (!e.target.closest(".oil-row-actions-menu")) {
        setOpenOilActionMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openOilActionMenuId]);

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

  const isTowingService = (name) => {
    const key = String(name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return key.includes("remorqu") || key.includes("tow");
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
    const isTowingLike = (name) =>
      String(name || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .includes("remorqu");
    const priority = (srv) => {
      if (isTowingLike(srv?.name)) return 0;
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
      const res = await fetch(`${API_BASE}/api/admin/services`, {
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

  useEffect(() => {
    if (!isLogged) return;
    loadServices();
    loadConfig();
     
  }, [isLogged, canViewServices, canViewConfig]);

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
      updateUser({
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        ...(data.user?.avatar_url !== undefined ? { avatar_url: data.user.avatar_url } : {}),
      });
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
      const res = await fetch(`${API_BASE}/api/admin/services/${srv.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ price }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur mise à jour prix");
      toast.success(`Prix de "${srv.name}" mis à jour ✅`);
      setServices((prev) =>
        prev.map((s) => (s.id === srv.id ? { ...s, price } : s))
      );
    } catch (e) {
      toast.error(e.message);
    } finally {
      setInlineSaving(null);
    }
  };

  const toggleServiceVisibility = async (srv) => {
    if (!canManageServices) {
      return toast.error(
        "Vous n’avez pas les droits pour masquer/afficher un service."
      );
    }

    const current = Number(srv?.is_active) === 1 ? 1 : 0;
    const next = current === 1 ? 0 : 1;

    try {
      setTogglingVisibilityServiceId(srv.id);
      const res = await fetch(`${API_BASE}/api/admin/services/${srv.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: next }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Erreur mise à jour visibilité service");

      toast.success(
        next === 1
          ? `Service "${srv.name}" affiché ✅`
          : `Service "${srv.name}" masqué ✅`
      );

      setServices((prev) =>
        sortPinnedServices(
          prev.map((s) =>
            s.id === srv.id ? { ...s, is_active: Number(next) } : s
          )
        )
      );
    } catch (e) {
      toast.error(e.message);
    } finally {
      setTogglingVisibilityServiceId(null);
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
      const res = await fetch(`${API_BASE}/api/admin/services/${srv.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Erreur suppression service");
      toast.success(`Service "${srv.name}" supprimé ✅`);
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
      const payload = {
        name: addForm.name,
        price: String(price),
        icon_name: addForm.icon || "",
      };

      const res = await fetch(`${API_BASE}/api/admin/services`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur ajout service");
      toast.success("Service ajouté ✅");
      setAddForm({ name: "", price: "", icon: "" });
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

  const loadOilModels = async () => {
    try {
      setLoadingOilModels(true);
      const res = await fetch(`${API_BASE}/api/admin/oil-models`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur chargement modèles d'huile");
      setOilModels(data.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoadingOilModels(false);
    }
  };

  const openOilManager = async (srv) => {
    setOilManagerService(srv);
    setClosingOilManagerModal(false);
    setShowOilManagerModal(true);
    await loadOilModels();
  };

  const openTowingManager = (srv) => {
    setTowingManagerService(srv);
    setClosingTowingManagerModal(false);
    setShowTowingManagerModal(true);
  };

  const saveOilModel = async (model) => {
    try {
      setInlineOilSaving(model.id);
      const payload = {
        name: model.name,
        price_1l:
          model.price_1l === "" || model.price_1l == null
            ? null
            : Number(model.price_1l),
        price_4l:
          model.price_4l === "" || model.price_4l == null
            ? null
            : Number(model.price_4l),
        price_5l:
          model.price_5l === "" || model.price_5l == null
            ? null
            : Number(model.price_5l),
        price_20l:
          model.price_20l === "" || model.price_20l == null
            ? null
            : Number(model.price_20l),
        is_active: model.is_active ? 1 : 0,
      };
      const res = await fetch(`${API_BASE}/api/admin/oil-models/${model.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur mise à jour modèle d'huile");
      toast.success("Modèle d'huile mis à jour ✅");
      setOilModels((prev) =>
        prev.map((m) =>
          m.id === model.id
            ? {
                ...m,
                name: data.data?.name ?? m.name,
                price_1l:
                  data.data?.price_1l ?? payload.price_1l,
                price_4l:
                  data.data?.price_4l ?? payload.price_4l,
                price_5l:
                  data.data?.price_5l ?? payload.price_5l,
                price_20l:
                  data.data?.price_20l ?? payload.price_20l,
                is_active: Number(data.data?.is_active ?? payload.is_active),
              }
            : m
        )
      );
    } catch (e) {
      toast.error(e.message);
    } finally {
      setInlineOilSaving(null);
    }
  };

  const removeOilModel = async (id) => {
    try {
      setDeletingOilModel(id);
      const res = await fetch(`${API_BASE}/api/admin/oil-models/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur suppression modèle d'huile");
      toast.success("Modèle d'huile supprimé ✅");
      setOilModels((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDeletingOilModel(null);
    }
  };

  const addOilModel = async () => {
    if (!newOilModel.name.trim()) return toast.error("Nom du modèle requis");
    const p1 =
      newOilModel.price_1l === "" || newOilModel.price_1l == null
        ? null
        : Number(newOilModel.price_1l);
    const p4 =
      newOilModel.price_4l === "" || newOilModel.price_4l == null
        ? null
        : Number(newOilModel.price_4l);
    const p5 =
      newOilModel.price_5l === "" || newOilModel.price_5l == null
        ? null
        : Number(newOilModel.price_5l);
    const p20 =
      newOilModel.price_20l === "" || newOilModel.price_20l == null
        ? null
        : Number(newOilModel.price_20l);

    if ([p1, p4, p5, p20].some((v) => v != null && (Number.isNaN(v) || v < 0))) {
      return toast.error("Prix invalide");
    }

    try {
      setAddingOilModel(true);
      const res = await fetch(`${API_BASE}/api/admin/oil-models`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newOilModel.name.trim(),
          price_1l: p1,
          price_4l: p4,
          price_5l: p5,
          price_20l: p20,
          is_active: newOilModel.is_active ? 1 : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur ajout modèle d'huile");
      toast.success("Modèle d'huile ajouté ✅");
      setNewOilModel({
        name: "",
        price_1l: "",
        price_4l: "",
        price_5l: "",
        price_20l: "",
        is_active: true,
      });
      await loadOilModels();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAddingOilModel(false);
    }
  };

  // ─────────── Handlers (config business)
  const saveBusinessConfig = async () => {
    if (!canManageConfig) {
      toast.error(
        "Vous n’avez pas les droits pour modifier les paramètres business."
      );
      return false;
    }

    const pct = Number(commission);
    const priceKm = Number(towingPricePerKm);
    const basePrice = Number(towingBasePrice);
    const missionRadius = Number(operatorMissionRadius);
    const towingRadius = Number(operatorTowingRadius);

    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast.error("Pourcentage invalide (0–100)");
      return false;
    }
    if (isNaN(priceKm) || priceKm < 0) {
      toast.error("Prix par km invalide");
      return false;
    }
    if (isNaN(basePrice) || basePrice < 0) {
      toast.error("Prix de base invalide");
      return false;
    }
    if (isNaN(missionRadius) || missionRadius <= 0 || missionRadius > 200) {
      toast.error("Rayon missions standard invalide (1–200 km)");
      return false;
    }
    if (isNaN(towingRadius) || towingRadius <= 0 || towingRadius > 200) {
      toast.error("Rayon remorquage invalide (1–200 km)");
      return false;
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
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
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
  return (
    <div className="space-y-8 theme-fade">
      {/* ──────────────── Section Profil (toujours visible) */}
      <section
        className="p-6 rounded shadow"
        style={{ background: "var(--bg-card)", color: "var(--text-color)" }}
      >
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <FaRegCircleUser />
          Profil
        </h2>

        <div className="flex items-center gap-5 mb-4">
          <div
            className="w-20 h-20 rounded-full overflow-hidden border"
            style={{
              background: "var(--bg-card)",
              borderColor: "var(--border-color)",
            }}
          >
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="preview"
                className="w-full h-full object-cover"
              />
            ) : user?.avatar_url ? (
              <img
                src={buildAssetUrl(user.avatar_url)}
                alt="avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center opacity-60 text-2xl font-bold" style={{ background: "var(--bg-main)" }}>
                {(user?.name?.[0] || "A").toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex-1">
            <p className="text-lg font-semibold">{user?.name || "?"}</p>
            <p className="opacity-70">{user?.email || "?"}</p>
            <p className="opacity-70">{user?.phone || "?"}</p>
          </div>
          <div className="flex flex-col gap-3 max-w-xs items-start">
          <button
            type="button"
            onClick={() => {
              setClosingEditProfile(false);
              setShowEditProfile(true);
            }}
            className="px-4 py-2 rounded flex items-center gap-2"
            style={{ background: "var(--bg-main)", color: "var(--text-color)", border: "1px solid var(--border-color)" }}
          >
            <FaEdit />
            Modifier mes infos
          </button>
          <button
            type="button"
            onClick={() => {
              setPwd({ current: "", next: "", confirm: "" });
              setClosingPasswordModal(false);
              setShowPasswordModal(true);
            }}
            className="px-4 py-2 rounded flex items-center gap-2"
            style={{ background: "var(--bg-main)", color: "var(--text-color)", border: "1px solid var(--border-color)" }}
          >
            <FaKey />
            Changer le mot de passe
          </button>
        </div>
        </div>


        
      </section>

      {showEditProfile && (
        <div
          className={`fixed inset-0 flex justify-center items-center modal-backdrop ${closingEditProfile ? "closing" : ""}`}
          style={{ background: "rgba(0,0,0,0.6)", zIndex: 60 }}
          onClick={() => {
            setClosingEditProfile(true);
            setTimeout(() => {
              setShowEditProfile(false);
              setClosingEditProfile(false);
            }, 180);
          }}
        >
          <div
            ref={editProfileModalRef}
            className={`p-6 rounded shadow w-full max-w-md modal-panel ${closingEditProfile ? "closing" : ""}`}
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              border: "1px solid var(--border-color)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4">Modifier mes infos</h3>

            {/* Photo de profil */}
            <div className="flex items-center gap-4 mb-5">
              <div
                className="w-16 h-16 rounded-full overflow-hidden border flex-shrink-0"
                style={{ borderColor: "var(--border-color)" }}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="preview" className="w-full h-full object-cover" />
                ) : user?.avatar_url ? (
                  <img src={buildAssetUrl(user.avatar_url)} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-xl font-bold opacity-60"
                    style={{ background: "var(--bg-main)" }}
                  >
                    {(user?.name?.[0] || "A").toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm opacity-70 mb-1">Photo de profil</p>
                <label
                  className="px-3 py-1.5 rounded cursor-pointer flex items-center gap-2 text-sm"
                  style={{ background: "var(--bg-main)", border: "1px solid var(--border-color)", color: "var(--text-color)" }}
                >
                  <FaEdit size={12} />
                  Choisir une photo
                  <input type="file" accept="image/*" onChange={onPickAvatar} className="hidden" />
                </label>
              </div>
            </div>

            <label className="block text-sm opacity-70 mb-1">Nom</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="w-full mb-3 p-2 rounded border"
              style={{
                background: "var(--bg-card)",
                color: "var(--text-color)",
                borderColor: "var(--border-color)",
              }}
            />
            <label className="block text-sm opacity-70 mb-1">Email</label>
            <input
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              className="w-full mb-3 p-2 rounded border"
              style={{
                background: "var(--bg-card)",
                color: "var(--text-color)",
                borderColor: "var(--border-color)",
              }}
            />
            <label className="block text-sm opacity-70 mb-1">T?l?phone</label>
            <input
              type="text"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              className="w-full mb-4 p-2 rounded border"
              style={{
                background: "var(--bg-card)",
                color: "var(--text-color)",
                borderColor: "var(--border-color)",
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setClosingEditProfile(true);
                  setTimeout(() => {
                    setShowEditProfile(false);
                    setClosingEditProfile(false);
                  }, 180);
                }}
                className="px-4 py-2 rounded border"
                style={{ borderColor: "var(--border-color)" }}
              >
                Annuler
              </button>
              <button
                onClick={saveProfile}
                disabled={savingProfile}
                className="px-4 py-2 rounded flex items-center gap-2 disabled:opacity-70"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                {savingProfile ? (
                  <AiOutlineLoading3Quarters className="animate-spin" />
                ) : (
                  <FaSave />
                )}
                Enregistrer
              </button>
            </div>
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
      {showVitrineSections && canViewServices && (
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
                        <div className="flex items-center gap-2">
                          <span>{s.name}</span>
                          {Number(s?.is_active) !== 1 && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{
                                background: "rgba(239,68,68,0.15)",
                                color: "#ef4444",
                              }}
                            >
                              Masqué
                            </span>
                          )}
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
                      <td className="px-3 py-2 text-right">
                        {canManageServices && (
                          <div className="relative inline-block service-row-actions-menu">
                            <button
                              onClick={() =>
                                setOpenServiceActionMenuId(
                                  openServiceActionMenuId === s.id ? null : s.id
                                )
                              }
                              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white shadow-md transition"
                              style={{ background: "var(--accent)" }}
                              title="Actions"
                            >
                              <span className="inline-flex items-center justify-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                              </span>
                            </button>

                            {openServiceActionMenuId === s.id && (
                              <div
                                className="absolute right-0 mt-2 w-48 rounded shadow-lg border service-row-actions-menu"
                                style={{
                                  background: "var(--bg-card)",
                                  borderColor: "var(--border-color)",
                                  zIndex: 30,
                                }}
                              >
                                {isHomeOilService(s.name) && (
                                  <button
                                    onClick={() => {
                                      openOilManager(s);
                                      setOpenServiceActionMenuId(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 hover:bg-[var(--bg-main)]"
                                    style={{ color: "var(--text-color)" }}
                                  >
                                    <FaWrench className="w-4 h-4 text-blue-400" />
                                    Gérer
                                  </button>
                                )}

                                {isTowingService(s.name) && (
                                  <button
                                    onClick={() => {
                                      openTowingManager(s);
                                      setOpenServiceActionMenuId(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 hover:bg-[var(--bg-main)]"
                                    style={{ color: "var(--text-color)" }}
                                  >
                                    <FaWrench className="w-4 h-4 text-blue-400" />
                                    Gérer
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    saveInlinePrice(s);
                                    setOpenServiceActionMenuId(null);
                                  }}
                                  disabled={inlineSaving === s.id}
                                  className="flex w-full items-center gap-2 px-3 py-2 hover:bg-[var(--bg-main)] disabled:opacity-50"
                                  style={{ color: "var(--text-color)" }}
                                >
                                  {inlineSaving === s.id ? (
                                    <AiOutlineLoading3Quarters className="animate-spin w-4 h-4 text-green-400" />
                                  ) : (
                                    <FaSave className="w-4 h-4 text-green-400" />
                                  )}
                                  Enregistrer
                                </button>

                                <button
                                  onClick={() => {
                                    toggleServiceVisibility(s);
                                    setOpenServiceActionMenuId(null);
                                  }}
                                  disabled={togglingVisibilityServiceId === s.id}
                                  className="flex w-full items-center gap-2 px-3 py-2 hover:bg-[var(--bg-main)] disabled:opacity-50"
                                  style={{ color: "var(--text-color)" }}
                                >
                                  {Number(s?.is_active) === 1 ? (
                                    <FaEyeSlash className="w-4 h-4 text-amber-500" />
                                  ) : (
                                    <FaEye className="w-4 h-4 text-blue-400" />
                                  )}
                                  {Number(s?.is_active) === 1 ? "Masquer" : "Afficher"}
                                </button>

                                {!isPinnedProtectedService(s.name) && (
                                  <button
                                    onClick={() => {
                                      deleteService(s);
                                      setOpenServiceActionMenuId(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 hover:bg-[var(--bg-main)]"
                                    style={{ color: "var(--text-color)" }}
                                  >
                                    <FaTrash className="w-4 h-4 text-red-500" />
                                    Supprimer
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
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

      {/* ──────────────── Section Business (RBAC) */}
      {showVitrineSections && canViewConfig && (
        <section
          className="p-6 rounded shadow theme-fade"
          style={{ background: "var(--bg-card)", color: "var(--text-color)" }}
        >
          <button
            onClick={() => setBusinessOpen((s) => !s)}
            className="w-full flex items-center justify-between mb-4"
          >
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FaBriefcase />
              Paramètres Business
            </h2>
            <span
              style={{
                transition: "transform 0.25s ease",
                transform: businessOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              ⌄
            </span>
          </button>
          <div
            className="transition-all duration-300"
            style={{
              maxHeight: businessOpen ? "2000px" : "0",
              overflow: "hidden",
              opacity: businessOpen ? 1 : 0,
            }}
          >
            {loadingConfig ? (
              <p className="opacity-70">
                <AiOutlineLoading3Quarters className="inline animate-spin mr-2" />
                Chargement config…
              </p>
            ) : (
              <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Commission */}
                <div>
                  <label className="block text-sm opacity-70 mb-1">
                    Commission admin (%)
                  </label>
                  <div className="relative">
                    <FaPercent className="absolute left-2 top-1/2 -translate-y-1/2 opacity-70" />
                    <input
                      type="number"
                      step="0.1"
                      value={commission}
                      onChange={(e) => setCommission(e.target.value)}
                      disabled={!canManageConfig}
                      className="pl-8 w-full p-2 rounded border"
                      style={{
                        background: "var(--bg-card)",
                        color: "var(--text-color)",
                        borderColor: "var(--border-color)",
                      }}
                    />
                  </div>
                </div>

                {/* Devise */}
                <div>
                  <label className="block text-sm opacity-70 mb-1">
                    Devise
                  </label>
                  <input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    disabled={!canManageConfig}
                    className="w-full p-2 rounded border uppercase"
                    style={{
                      background: "var(--bg-card)",
                      color: "var(--text-color)",
                      borderColor: "var(--border-color)",
                    }}
                    placeholder="Ex: FCFA"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm opacity-70 mb-1">
                    Rayon missions standard (km)
                  </label>
                  <input
                    type="number"
                    value={operatorMissionRadius}
                    onChange={(e) => setOperatorMissionRadius(e.target.value)}
                    disabled={!canManageConfig}
                    className="w-full p-2 rounded border"
                    style={{
                      background: "var(--bg-card)",
                      color: "var(--text-color)",
                      borderColor: "var(--border-color)",
                    }}
                    placeholder="Ex: 5"
                  />
                </div>
                <div />
              </div>

              <div className="mt-4">
                <button
                  onClick={saveBusinessConfig}
                  disabled={savingBusinessConfig || !canManageConfig}
                  style={{ background: "var(--accent)", color: "#fff" }}
                  className="px-4 py-2 rounded flex items-center gap-2 disabled:opacity-70"
                  title={canManageConfig ? "" : "Droit requis: config_manage"}
                >
                  {savingBusinessConfig ? (
                    <AiOutlineLoading3Quarters className="animate-spin" />
                  ) : (
                    <FaSave />
                  )}
                  Mettre à jour
                </button>
              </div>
            </>
          )}
          </div>
        </section>
      )}

      {showVitrineSections && canViewConfig && (
        <section
          className="p-6 rounded shadow theme-fade"
          style={{ background: "var(--bg-card)", color: "var(--text-color)" }}
        >
          <button
            onClick={() => setSupportOpen((s) => !s)}
            className="w-full flex items-center justify-between mb-4"
          >
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FaHeadset />
              Coordonnées service client
            </h2>
            <span
              style={{
                transition: "transform 0.25s ease",
                transform: supportOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              ⌄
            </span>
          </button>
          <div
            className="transition-all duration-300"
            style={{
              maxHeight: supportOpen ? "1600px" : "0",
              overflow: "hidden",
              opacity: supportOpen ? 1 : 0,
            }}
          >
            {loadingConfig ? (
              <p className="opacity-70">
                <AiOutlineLoading3Quarters className="inline animate-spin mr-2" />
                Chargement coordonnées…
              </p>
            ) : (
<>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm opacity-70 mb-1">
                      Numéro d’appel
                    </label>
                  <input
                    type="tel"
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                    disabled={!canManageConfig}
                    className="w-full p-2 rounded border"
                    style={{
                      background: "var(--bg-card)",
                      color: "var(--text-color)",
                      borderColor: "var(--border-color)",
                    }}
                    placeholder="+22300000000"
                  />
                </div>
                  <div>
                    <label className="block text-sm opacity-70 mb-1">
                      WhatsApp (international)
                    </label>
                    <input
                    type="tel"
                    value={supportWhatsApp}
                    onChange={(e) => setSupportWhatsApp(e.target.value)}
                    disabled={!canManageConfig}
                    className="w-full p-2 rounded border"
                    style={{
                      background: "var(--bg-card)",
                      color: "var(--text-color)",
                      borderColor: "var(--border-color)",
                    }}
                    placeholder="00223…"
                  />
                </div>
                <div>
                  <label className="block text-sm opacity-70 mb-1">
                    Email support
                  </label>
                  <input
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    disabled={!canManageConfig}
                    className="w-full p-2 rounded border"
                    style={{
                      background: "var(--bg-card)",
                      color: "var(--text-color)",
                      borderColor: "var(--border-color)",
                    }}
                    placeholder="support@ttm.com"
                  />
                </div>
              </div>

              
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={saveSupportContacts}
                  disabled={savingSupportContacts || !canManageConfig}
                  style={{ background: "var(--accent)", color: "#fff" }}
                  className="px-4 py-2 rounded flex items-center gap-2 disabled:opacity-70"
                  title={canManageConfig ? "" : "Droit requis: config_manage"}
                >
                  {savingSupportContacts ? (
                    <AiOutlineLoading3Quarters className="animate-spin" />
                  ) : (
                    <FaSave />
                  )}
                  Enregistrer les coordonnées
                </button>
                <button
                  onClick={() => {
                    setClosingTestSmsModal(false);
                    setShowTestSmsModal(true);
                  }}
                  disabled={!canManageConfig}
                  className="px-4 py-2 rounded flex items-center gap-2"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-color)",
                  }}
                  title={canManageConfig ? "" : "Droit requis: config_manage"}
                >
                  <FaPaperPlane />
                  Tester SMS
                </button>
              </div>
            </>
            )}
          </div>
        </section>
      )}
      {showVitrineSections && showTestSmsModal && (
        <div
          className={`fixed inset-0 flex justify-center items-center modal-backdrop ${closingTestSmsModal ? "closing" : ""}`}
          style={{ background: "rgba(0,0,0,0.6)", zIndex: 60 }}
          onClick={() => {
            if (sendingTestSms) return;
            setClosingTestSmsModal(true);
            setTimeout(() => {
              setShowTestSmsModal(false);
              setClosingTestSmsModal(false);
            }, 180);
          }}
        >
          <div
            ref={testSmsModalRef}
            className={`p-6 rounded shadow w-full max-w-md modal-panel ${closingTestSmsModal ? "closing" : ""}`}
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              border: "1px solid var(--border-color)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-2">Tester l'envoi SMS</h3>
            <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
              Entre un numéro pour recevoir un SMS de test.
            </p>
            <label className="block text-sm opacity-70 mb-1">Numéro</label>
            <input
              type="tel"
              value={testSmsPhone}
              onChange={(e) => setTestSmsPhone(e.target.value)}
              className="w-full p-2 rounded border"
              style={{
                background: "var(--bg-card)",
                color: "var(--text-color)",
                borderColor: "var(--border-color)",
              }}
              placeholder="+22300000000"
            />
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  if (sendingTestSms) return;
                  setClosingTestSmsModal(true);
                  setTimeout(() => {
                    setShowTestSmsModal(false);
                    setClosingTestSmsModal(false);
                  }, 180);
                }}
                className="px-4 py-2 rounded"
                style={{
                  background: "transparent",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-color)",
                }}
                disabled={sendingTestSms}
              >
                Annuler
              </button>
              <button
                onClick={sendTestSms}
                className="px-4 py-2 rounded text-white disabled:opacity-60 flex items-center gap-2"
                style={{ background: "var(--accent)" }}
                disabled={sendingTestSms}
              >
                {sendingTestSms ? (
                  <AiOutlineLoading3Quarters className="animate-spin" />
                ) : (
                  <FaPaperPlane />
                )}
                Envoyer
              </button>
            </div>
          </div>
        </div>
      )}

      {showVitrineSections && showOilManagerModal && (
        <div
          className={`fixed inset-0 flex justify-center items-center modal-backdrop ${closingOilManagerModal ? "closing" : ""}`}
          style={{ background: "rgba(0,0,0,0.6)", zIndex: 60 }}
          onClick={() => {
            if (addingOilModel || inlineOilSaving || deletingOilModel) return;
            setClosingOilManagerModal(true);
            setTimeout(() => {
              setShowOilManagerModal(false);
              setClosingOilManagerModal(false);
            }, 180);
          }}
        >
          <div
            ref={oilManagerModalRef}
            className={`p-6 rounded shadow w-full max-w-5xl modal-panel ${closingOilManagerModal ? "closing" : ""}`}
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              border: "1px solid var(--border-color)",
              maxHeight: "86vh",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <FaWrench />
                Gérer Service à Domicile
              </h3>
              <span className="text-sm opacity-70">{oilManagerService?.name || "Service"}</span>
            </div>

            <div className="overflow-auto max-h-[56vh] rounded border" style={{ borderColor: "var(--border-color)" }}>
              <table className="w-full text-sm border-collapse">
                <thead style={{ color: "var(--muted)", borderColor: "var(--border-color)" }}>
                  <tr>
                    <th className="px-3 py-2 text-left">Modèle d'huile</th>
                    <th className="px-3 py-2 text-left">1L</th>
                    <th className="px-3 py-2 text-left">4L</th>
                    <th className="px-3 py-2 text-left">5L</th>
                    <th className="px-3 py-2 text-left">20L</th>
                    <th className="px-3 py-2 text-center">Actif</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingOilModels ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-5 text-center opacity-70">
                        <AiOutlineLoading3Quarters className="inline animate-spin mr-2" />
                        Chargement des modèles...
                      </td>
                    </tr>
                  ) : oilModels.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-5 text-center opacity-70">
                        Aucun modèle d'huile.
                      </td>
                    </tr>
                  ) : (
                    oilModels.map((m) => (
                      <tr key={m.id} style={{ borderColor: "var(--border-color)" }}>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={m.name || ""}
                            onChange={(e) =>
                              setOilModels((prev) =>
                                prev.map((x) =>
                                  x.id === m.id ? { ...x, name: e.target.value } : x
                                )
                              )
                            }
                            className="w-full p-2 rounded border"
                            style={{
                              background: "var(--bg-card)",
                              color: "var(--text-color)",
                              borderColor: "var(--border-color)",
                            }}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={m.price_1l ?? ""}
                            onChange={(e) =>
                              setOilModels((prev) =>
                                prev.map((x) =>
                                  x.id === m.id
                                    ? { ...x, price_1l: e.target.value }
                                    : x
                                )
                              )
                            }
                            className="w-24 p-2 rounded border"
                            style={{
                              background: "var(--bg-card)",
                              color: "var(--text-color)",
                              borderColor: "var(--border-color)",
                            }}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={m.price_4l ?? ""}
                            onChange={(e) =>
                              setOilModels((prev) =>
                                prev.map((x) =>
                                  x.id === m.id
                                    ? { ...x, price_4l: e.target.value }
                                    : x
                                )
                              )
                            }
                            className="w-24 p-2 rounded border"
                            style={{
                              background: "var(--bg-card)",
                              color: "var(--text-color)",
                              borderColor: "var(--border-color)",
                            }}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={m.price_5l ?? ""}
                            onChange={(e) =>
                              setOilModels((prev) =>
                                prev.map((x) =>
                                  x.id === m.id
                                    ? { ...x, price_5l: e.target.value }
                                    : x
                                )
                              )
                            }
                            className="w-24 p-2 rounded border"
                            style={{
                              background: "var(--bg-card)",
                              color: "var(--text-color)",
                              borderColor: "var(--border-color)",
                            }}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={m.price_20l ?? ""}
                            onChange={(e) =>
                              setOilModels((prev) =>
                                prev.map((x) =>
                                  x.id === m.id
                                    ? { ...x, price_20l: e.target.value }
                                    : x
                                )
                              )
                            }
                            className="w-24 p-2 rounded border"
                            style={{
                              background: "var(--bg-card)",
                              color: "var(--text-color)",
                              borderColor: "var(--border-color)",
                            }}
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={Number(m.is_active) === 1}
                            onChange={(e) =>
                              setOilModels((prev) =>
                                prev.map((x) =>
                                  x.id === m.id
                                    ? { ...x, is_active: e.target.checked ? 1 : 0 }
                                    : x
                                )
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="relative inline-block oil-row-actions-menu">
                            <button
                              onClick={() =>
                                setOpenOilActionMenuId(
                                  openOilActionMenuId === m.id ? null : m.id
                                )
                              }
                              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white shadow-md transition"
                              style={{ background: "var(--accent)" }}
                              title="Actions"
                            >
                              <span className="inline-flex items-center justify-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                              </span>
                            </button>

                            {openOilActionMenuId === m.id && (
                              <div
                                className="absolute right-0 mt-2 w-44 rounded shadow-lg border oil-row-actions-menu"
                                style={{
                                  background: "var(--bg-card)",
                                  borderColor: "var(--border-color)",
                                  zIndex: 30,
                                }}
                              >
                                <button
                                  onClick={() => {
                                    saveOilModel(m);
                                    setOpenOilActionMenuId(null);
                                  }}
                                  disabled={inlineOilSaving === m.id}
                                  className="flex w-full items-center gap-2 px-3 py-2 hover:bg-[var(--bg-main)] disabled:opacity-50"
                                  style={{ color: "var(--text-color)" }}
                                >
                                  {inlineOilSaving === m.id ? (
                                    <AiOutlineLoading3Quarters className="animate-spin w-4 h-4 text-green-400" />
                                  ) : (
                                    <FaSave className="w-4 h-4 text-green-400" />
                                  )}
                                  Enregistrer
                                </button>

                                <button
                                  onClick={() => {
                                    removeOilModel(m.id);
                                    setOpenOilActionMenuId(null);
                                  }}
                                  disabled={deletingOilModel === m.id}
                                  className="flex w-full items-center gap-2 px-3 py-2 hover:bg-[var(--bg-main)] disabled:opacity-50"
                                  style={{ color: "var(--text-color)" }}
                                >
                                  {deletingOilModel === m.id ? (
                                    <AiOutlineLoading3Quarters className="animate-spin w-4 h-4 text-red-400" />
                                  ) : (
                                    <FaTrash className="w-4 h-4 text-red-500" />
                                  )}
                                  Supprimer
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-4 rounded border" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
              <h4 className="font-semibold mb-2">Ajouter un modèle d'huile</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={newOilModel.name}
                  onChange={(e) =>
                    setNewOilModel((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Nom du modèle"
                  className="p-2 rounded border"
                  style={{
                    background: "var(--bg-card)",
                    color: "var(--text-color)",
                    borderColor: "var(--border-color)",
                  }}
                />
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={newOilModel.price_1l}
                  onChange={(e) =>
                    setNewOilModel((prev) => ({ ...prev, price_1l: e.target.value }))
                  }
                  placeholder="Prix 1L"
                  className="p-2 rounded border"
                  style={{
                    background: "var(--bg-card)",
                    color: "var(--text-color)",
                    borderColor: "var(--border-color)",
                  }}
                />
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={newOilModel.price_4l}
                  onChange={(e) =>
                    setNewOilModel((prev) => ({ ...prev, price_4l: e.target.value }))
                  }
                  placeholder="Prix 4L"
                  className="p-2 rounded border"
                  style={{
                    background: "var(--bg-card)",
                    color: "var(--text-color)",
                    borderColor: "var(--border-color)",
                  }}
                />
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={newOilModel.price_5l}
                  onChange={(e) =>
                    setNewOilModel((prev) => ({ ...prev, price_5l: e.target.value }))
                  }
                  placeholder="Prix 5L"
                  className="p-2 rounded border"
                  style={{
                    background: "var(--bg-card)",
                    color: "var(--text-color)",
                    borderColor: "var(--border-color)",
                  }}
                />
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={newOilModel.price_20l}
                  onChange={(e) =>
                    setNewOilModel((prev) => ({ ...prev, price_20l: e.target.value }))
                  }
                  placeholder="Prix 20L"
                  className="p-2 rounded border"
                  style={{
                    background: "var(--bg-card)",
                    color: "var(--text-color)",
                    borderColor: "var(--border-color)",
                  }}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newOilModel.is_active}
                    onChange={(e) =>
                      setNewOilModel((prev) => ({ ...prev, is_active: e.target.checked }))
                    }
                  />
                  Actif
                </label>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={addOilModel}
                  disabled={addingOilModel}
                  className="px-4 py-2 rounded text-white disabled:opacity-60 flex items-center gap-2"
                  style={{ background: "var(--accent)" }}
                >
                  {addingOilModel ? <AiOutlineLoading3Quarters className="animate-spin" /> : <FaPlus />}
                  Ajouter
                </button>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setClosingOilManagerModal(true);
                  setTimeout(() => {
                    setShowOilManagerModal(false);
                    setClosingOilManagerModal(false);
                  }, 180);
                }}
                className="px-4 py-2 rounded"
                style={{
                  background: "transparent",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-color)",
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {showVitrineSections && showTowingManagerModal && (
        <div
          className={`fixed inset-0 flex justify-center items-center modal-backdrop ${closingTowingManagerModal ? "closing" : ""}`}
          style={{ background: "rgba(0,0,0,0.6)", zIndex: 60 }}
          onClick={() => {
            if (savingBusinessConfig) return;
            setClosingTowingManagerModal(true);
            setTimeout(() => {
              setShowTowingManagerModal(false);
              setClosingTowingManagerModal(false);
            }, 180);
          }}
        >
          <div
            ref={towingManagerModalRef}
            className={`p-6 rounded shadow w-full max-w-2xl modal-panel ${closingTowingManagerModal ? "closing" : ""}`}
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              border: "1px solid var(--border-color)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <FaWrench />
                Gérer Remorquage
              </h3>
              <span className="text-sm opacity-70">{towingManagerService?.name || "Service"}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm opacity-70 mb-1">Prix remorquage par km</label>
                <input
                  type="number"
                  step="0.1"
                  value={towingPricePerKm}
                  onChange={(e) => setTowingPricePerKm(e.target.value)}
                  disabled={!canManageConfig}
                  className="w-full p-2 rounded border"
                  style={{
                    background: "var(--bg-card)",
                    color: "var(--text-color)",
                    borderColor: "var(--border-color)",
                  }}
                  placeholder="Ex: 500"
                />
              </div>

              <div>
                <label className="block text-sm opacity-70 mb-1">Prix de base remorquage</label>
                <input
                  type="number"
                  step="0.1"
                  value={towingBasePrice}
                  onChange={(e) => setTowingBasePrice(e.target.value)}
                  disabled={!canManageConfig}
                  className="w-full p-2 rounded border"
                  style={{
                    background: "var(--bg-card)",
                    color: "var(--text-color)",
                    borderColor: "var(--border-color)",
                  }}
                  placeholder="Ex: 3000"
                />
              </div>

              <div>
                <label className="block text-sm opacity-70 mb-1">Rayon remorquage (km)</label>
                <input
                  type="number"
                  value={operatorTowingRadius}
                  onChange={(e) => setOperatorTowingRadius(e.target.value)}
                  disabled={!canManageConfig}
                  className="w-full p-2 rounded border"
                  style={{
                    background: "var(--bg-card)",
                    color: "var(--text-color)",
                    borderColor: "var(--border-color)",
                  }}
                  placeholder="Ex: 100"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setClosingTowingManagerModal(true);
                  setTimeout(() => {
                    setShowTowingManagerModal(false);
                    setClosingTowingManagerModal(false);
                  }, 180);
                }}
                className="px-4 py-2 rounded border"
                style={{ borderColor: "var(--border-color)" }}
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  const ok = await saveBusinessConfig();
                  if (!ok) return;
                  setClosingTowingManagerModal(true);
                  setTimeout(() => {
                    setShowTowingManagerModal(false);
                    setClosingTowingManagerModal(false);
                  }, 180);
                }}
                disabled={savingBusinessConfig || !canManageConfig}
                className="px-4 py-2 rounded flex items-center gap-2 disabled:opacity-70"
                style={{ background: "var(--accent)", color: "#fff" }}
                title={canManageConfig ? "" : "Droit requis: config_manage"}
              >
                {savingBusinessConfig ? (
                  <AiOutlineLoading3Quarters className="animate-spin" />
                ) : (
                  <FaSave />
                )}
                Mettre à jour
              </button>
            </div>
          </div>
        </div>
      )}

      {showVitrineSections && confirmService && (
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
      {showVitrineSections && showAddServiceModal && (
        <div
          className={`fixed inset-0 flex justify-center items-center modal-backdrop ${closingAddServiceModal ? "closing" : ""}`}
          style={{ background: "rgba(0,0,0,0.6)", zIndex: 60 }}
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
