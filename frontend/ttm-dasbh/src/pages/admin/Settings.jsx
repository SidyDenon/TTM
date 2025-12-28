// src/pages/admin/Settings.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import { toast } from "react-toastify";
import * as FaIcons from "react-icons/fa";      // UI buttons (edit/save/…)
import * as Fa6Icons from "react-icons/fa6";    // FontAwesome 6 Free (compat Expo)
import * as IoIcons from "react-icons/io5";     // Ionicons 5
import * as FiIcons from "react-icons/fi";      // Feather
import * as AiIcons from "react-icons/ai";      // AntDesign
import * as MdIcons from "react-icons/md";      // Material Icons
import * as GoIcons from "react-icons/go";      // Octicons
import * as SlIcons from "react-icons/sl";      // SimpleLineIcons
import { FaEdit, FaSave, FaTrash, FaPlus, FaPercent, FaWrench } from "react-icons/fa";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { API_BASE } from "../../config/urls";
import { useAuth } from "../../context/AuthContext";
import { can, isSuper } from "../../utils/rbac"; // ✅ RBAC (même pattern)

export default function Settings() {
  const { user, token } = useAuth();

  // ─────────── Permissions (RBAC)
  const canViewServices =
    isSuper(user) || can(user, "services_view") || can(user, "services_manage");
  const canManageServices = isSuper(user) || can(user, "services_manage");

  const canViewConfig =
    isSuper(user) || can(user, "config_view") || can(user, "config_manage");
  const canManageConfig = isSuper(user) || can(user, "config_manage");

  // La page reste accessible (profil) ; sections Services/Business sont RBACées
  const canAccessPage = true;

  // ─────────── Profile
  const [profileOpen, setProfileOpen] = useState(false);
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
  const [addForm, setAddForm] = useState({ name: "", price: "", icon: "" });
  const [servicesOpen, setServicesOpen] = useState(true);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
  const [iconList, setIconList] = useState([]);
  const [iconsLoading, setIconsLoading] = useState(false);
  const iconCache = useRef({});

  // ─────────── Business config
  const [commission, setCommission] = useState("");              // %
  const [towingPricePerKm, setTowingPricePerKm] = useState("");  // prix / km
  const [towingBasePrice, setTowingBasePrice] = useState("");    // prix de base
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setProfileOpen(false);
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

  const deleteService = async (srv) => {
    if (!canManageServices) {
      return toast.error(
        "Vous n’avez pas les droits pour supprimer un service."
      );
    }
    if (!confirm(`Supprimer le service "${srv.name}" ?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/services/${srv.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Erreur suppression service");
      toast.success(`Service "${srv.name}" supprimé ✅`);
      setServices((prev) => prev.filter((s) => s.id !== srv.id));
    } catch (e) {
      toast.error(e.message);
    }
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

    if (isNaN(pct) || pct < 0 || pct > 100) {
      return toast.error("Pourcentage invalide (0–100)");
    }
    if (isNaN(priceKm) || priceKm < 0) {
      return toast.error("Prix par km invalide");
    }
    if (isNaN(basePrice) || basePrice < 0) {
      return toast.error("Prix de base invalide");
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

  // ─────────── Render
  return (
    <div className="space-y-8 theme-fade">
      {/* ──────────────── Section Profil (toujours visible) */}
      <section
        className="p-6 rounded shadow"
        style={{ background: "var(--bg-card)", color: "var(--text-color)" }}
      >
        <button
          onClick={() => setProfileOpen((s) => !s)}
          className="w-full flex items-center justify-between mb-6 px-2 py-1"
        >
          <h2 className="text-xl font-bold">👤 Profil</h2>
          <span
            style={{
              transition: "transform 0.25s ease",
              transform: profileOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            ⌄
          </span>
        </button>

        <div
          className="transition-all duration-300"
          style={{
            maxHeight: profileOpen ? "800px" : "0",
            overflow: "hidden",
            opacity: profileOpen ? 1 : 0,
          }}
        >
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
                  src={user.avatar_url}
                  alt="avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center opacity-60">
                  A
                </div>
              )}
            </div>

            <div className="flex-1">
              <p className="text-lg font-semibold">{user?.name || "—"}</p>
              <p className="opacity-70">{user?.email || "—"}</p>
              <p className="opacity-70">{user?.phone || "—"}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            {/* Infos */}
            <div
              className="p-4 rounded"
              style={{ background: "var(--bg-card)", color: "var(--text-color)" }}
            >
              <h3 className="font-semibold mb-3">✏️ Modifier mes infos</h3>
              <label className="block text-sm opacity-70 mb-1">
                Photo de profil
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={onPickAvatar}
                className="w-full mb-3"
              />

              <label className="block text-sm opacity-70 mb-1">Nom</label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
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
                onChange={(e) =>
                  setProfile({ ...profile, email: e.target.value })
                }
                className="w-full mb-3 p-2 rounded border"
                style={{
                  background: "var(--bg-card)",
                  color: "var(--text-color)",
                  borderColor: "var(--border-color)",
                }}
              />
              <label className="block text-sm opacity-70 mb-1">
                Téléphone
              </label>
              <input
                type="text"
                value={profile.phone}
                onChange={(e) =>
                  setProfile({ ...profile, phone: e.target.value })
                }
                className="w-full mb-4 p-2 rounded border"
                style={{
                  background: "var(--bg-card)",
                  color: "var(--text-color)",
                  borderColor: "var(--border-color)",
                }}
              />

              <div className="flex gap-3">
                <button
                  onClick={saveProfile}
                  disabled={savingProfile}
                  style={{ background: "var(--accent)", color: "#fff" }}
                  className="px-4 py-2 rounded flex items-center gap-2 disabled:opacity-70"
                >
                  {savingProfile ? (
                    <AiOutlineLoading3Quarters className="animate-spin" />
                  ) : (
                    <FaSave />
                  )}
                  Enregistrer
                </button>
                <button
                  onClick={() => setProfileOpen(false)}
                  className="px-4 py-2 rounded border"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  Annuler
                </button>
              </div>
            </div>

            {/* Mot de passe */}
            <div
              className="p-4 rounded"
              style={{ background: "var(--bg-card)", color: "var(--text-color)" }}
            >
              <h3 className="font-semibold mb-3">🔑 Changer le mot de passe</h3>
              {["current", "next", "confirm"].map((key, i) => (
                <div key={i} className="mb-3">
                  <label className="block text-sm opacity-70 mb-1">
                    {key === "current"
                      ? "Mot de passe actuel"
                      : key === "next"
                      ? "Nouveau mot de passe"
                      : "Confirmer"}
                  </label>
                  <input
                    type="password"
                    value={pwd[key]}
                    onChange={(e) =>
                      setPwd({ ...pwd, [key]: e.target.value })
                    }
                    className="w-full p-2 rounded border"
                    style={{
                      background: "var(--bg-card)",
                      color: "var(--text-color)",
                      borderColor: "var(--border-color)",
                    }}
                  />
                </div>
              ))}
              <button
                onClick={savePassword}
                disabled={savingPassword}
                style={{ background: "var(--accent)", color: "#fff" }}
                className="px-4 py-2 rounded flex items-center gap-2 disabled:opacity-70"
              >
                {savingPassword ? (
                  <AiOutlineLoading3Quarters className="animate-spin" />
                ) : (
                  <FaSave />
                )}
                Mettre à jour
              </button>
            </div>
          </div>
          </div>

        
      </section>

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
            <h2 className="text-xl font-bold">🧰 Gestion des services</h2>
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
                      <td className="px-3 py-2">{s.name}</td>
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

            {/* Ajout service (seulement si canManageServices) */}
            {canManageServices && (
              <div className="mt-6 p-4 rounded" style={{ background: "var(--bg-card)" }}>
                <h3 className="font-semibold mb-3">➕ Ajouter un service</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                  <div>
                    <label className="block text-sm opacity-70 mb-1">Nom</label>
                    <input
                      type="text"
                      value={addForm.name}
                      onChange={(e) =>
                        setAddForm({ ...addForm, name: e.target.value })
                      }
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
                      onChange={(e) =>
                        setAddForm({ ...addForm, price: e.target.value })
                      }
                      className="w-full p-2 rounded border"
                      style={{
                        background: "var(--bg-card)",
                        color: "var(--text-color)",
                        borderColor: "var(--border-color)",
                      }}
                      placeholder="Ex: 150"
                    />
                  </div>
                  <div className="col-span-2">
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
                                  <div className="text-sm font-medium capitalize">
                                    {ico.label}
                                  </div>
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
                  <div className="flex gap-2">
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
                    <button
                      onClick={() => {
                        setAddForm({ name: "", price: "", icon: "" });
                      }}
                      className="px-4 py-2 rounded border"
                      style={{ borderColor: "var(--border-color)" }}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ──────────────── Section Business (RBAC) */}
      {canViewConfig && (
        <section
          className="p-6 rounded shadow theme-fade"
          style={{ background: "var(--bg-card)", color: "var(--text-color)" }}
        >
          <button
            onClick={() => setBusinessOpen((s) => !s)}
            className="w-full flex items-center justify-between mb-4"
          >
            <h2 className="text-xl font-bold">💼 Paramètres Business</h2>
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

                {/* Prix remorquage / km */}
                <div>
                  <label className="block text-sm opacity-70 mb-1">
                    Prix remorquage par km
                  </label>
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

                {/* Prix de base remorquage */}
                <div>
                  <label className="block text-sm opacity-70 mb-1">
                    Prix de base remorquage
                  </label>
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

      {canViewConfig && (
        <section
          className="p-6 rounded shadow theme-fade"
          style={{ background: "var(--bg-card)", color: "var(--text-color)" }}
        >
          <button
            onClick={() => setSupportOpen((s) => !s)}
            className="w-full flex items-center justify-between mb-4"
          >
            <h2 className="text-xl font-bold">📞 Coordonnées service client</h2>
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

              <div className="mt-4 text-sm opacity-70">
                Seuls les utilisateurs disposant du droit <code>config_manage</code> peuvent modifier
                ces coordonnées.
              </div>

              <div className="mt-4">
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
              </div>
            </>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
