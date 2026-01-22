// src/pages/admin/AdminUsers.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { API_BASE } from "../../config/urls";
import { toast } from "react-toastify";
import { can, isSuper } from "../../utils/rbac";
import {
  FaPlus, FaTrash, FaUserShield, FaUserPlus, FaSave,
  FaSearch, FaCrown, FaEnvelope, FaPhone, FaIdBadge, FaCheckSquare, FaSquare, FaEye, FaPrint, FaPen, FaEllipsisH, FaKey, FaBan
} from "react-icons/fa";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { useModalOrigin } from "../../hooks/useModalOrigin";
import { getSocketInstance } from "../../utils/socket";

const ENDPOINTS = {
  admins:        () => `/api/admin/rbac/users`,
  adminCreate:   () => `/api/admin/rbac/users`,
  adminDelete:   (id) => `/api/admin/rbac/users/${id}`,
  roles:         () => `/api/admin/rbac/roles`,
};

const PERM_LABELS = {
  // 👤 Gestion des admins et rôles
  rbac_users_view: "Voir les administrateurs",
  rbac_users_manage: "Gérer les administrateurs",
  rbac_roles_view: "Voir les rôles",
  rbac_roles_manage: "Gérer les rôles",

  // 👷 Gestion des opérateurs
  operators_view: "Voir les opérateurs",
  operators_manage: "Gérer les opérateurs",

  // 🙋 Gestion des clients
  clients_view: "Voir les clients",
  clients_manage: "Gérer les clients",

  // 🧰 Services
  services_view: "Voir les services",
  services_manage: "Gérer les services",

  // ⚙️ Configuration
  config_view: "Voir la configuration",
  config_manage: "Gérer la configuration",

  // 💰 Transactions & retraits
  transactions_view: "Voir les transactions",
  transactions_manage: "Gérer les transactions",
  withdrawals_view: "Voir les retraits",
  withdrawals_manage: "Gérer les retraits",

  // 🚗 Missions (requests)
  requests_view: "Voir les missions",
  requests_manage: "Gérer les missions",

  // 📊 Tableau de bord
  dashboard_view: "Voir le tableau de bord",

  // 📈 Statistiques
  chart_view: "Voir les statistiques",

  // 🗺️ Carte
  map_view: "Voir la carte des missions",
  map_fullscreen: "Carte plein ecran",
  requests_refresh: "Actualiser les missions",

  // 💵 Calcul du prix (optionnel)
  pricing_calculate: "Calculer les prix estimés"
};


function safeJson(x, fallback = []) {
  if (Array.isArray(x)) return x;
  try { return JSON.parse(x); } catch { return fallback; }
}

export default function AdminUsers() {
  const { token, user } = useAuth();

  const canUsersView   = isSuper(user) || can(user, "rbac_users_view");
  const canUsersManage = isSuper(user) || can(user, "rbac_users_manage");
  const canRolesView   = isSuper(user) || can(user, "rbac_roles_view");

  const [admins, setAdmins] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [onlineAdminIds, setOnlineAdminIds] = useState([]);
  const [showOnlineModal, setShowOnlineModal] = useState(false);
  const [closingOnlineModal, setClosingOnlineModal] = useState(false);
  const [detailAdmin, setDetailAdmin] = useState(null);
  const [closingDetail, setClosingDetail] = useState(false);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState("");
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [closingHistory, setClosingHistory] = useState(false);
  const [historyFilterType, setHistoryFilterType] = useState("all");
  const [historyFilterValue, setHistoryFilterValue] = useState("");
  const [deleteAdminTarget, setDeleteAdminTarget] = useState(null);
  const [closingDeleteAdmin, setClosingDeleteAdmin] = useState(false);
  const [deletingAdmin, setDeletingAdmin] = useState(false);
  const [showEditAdmin, setShowEditAdmin] = useState(false);
  const [closingEditAdmin, setClosingEditAdmin] = useState(false);
  const [savingEditAdmin, setSavingEditAdmin] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [editAdminForm, setEditAdminForm] = useState({ name: "", email: "", phone: "" });
  const [adminActionConfirm, setAdminActionConfirm] = useState(null);
  const [closingAdminAction, setClosingAdminAction] = useState(false);
  const [confirmAdminActionLoading, setConfirmAdminActionLoading] = useState(false);
  const [showEditPerms, setShowEditPerms] = useState(false);
  const [closingEditPerms, setClosingEditPerms] = useState(false);
  const [savingEditPerms, setSavingEditPerms] = useState(false);
  const [editRoleId, setEditRoleId] = useState(null);
  const [editPermFilter, setEditPermFilter] = useState("");
  const [editCheckedPerms, setEditCheckedPerms] = useState([]);
  const [editCheckAll, setEditCheckAll] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const visibleEvents = useMemo(
    () => (events || []).filter((ev) => ev?.action !== "admin_request"),
    [events]
  );
  const filteredEvents = useMemo(() => {
    if (historyFilterType === "day" && historyFilterValue) {
      const [year, month, day] = historyFilterValue.split("-").map(Number);
      return visibleEvents.filter((ev) => {
        const dt = new Date(ev?.created_at);
        if (Number.isNaN(dt.getTime())) return false;
        return dt.getFullYear() === year && dt.getMonth() + 1 === month && dt.getDate() === day;
      });
    }
    if (historyFilterType === "month" && historyFilterValue) {
      const [year, month] = historyFilterValue.split("-").map(Number);
      return visibleEvents.filter((ev) => {
        const dt = new Date(ev?.created_at);
        if (Number.isNaN(dt.getTime())) return false;
        return dt.getFullYear() === year && dt.getMonth() + 1 === month;
      });
    }
    return visibleEvents;
  }, [visibleEvents, historyFilterType, historyFilterValue]);

  // Modal create
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [roleId, setRoleId] = useState(null);
  const [permFilter, setPermFilter] = useState("");
  const [allPerms, setAllPerms] = useState([]);         // master catalogue
  const [checkedPerms, setCheckedPerms] = useState([]); // sélection courante
  const [checkAll, setCheckAll] = useState(false);
  const onlineModalRef = useModalOrigin(showOnlineModal);
  const detailModalRef = useModalOrigin(!!detailAdmin);
  const historyModalRef = useModalOrigin(showHistoryModal);
  const editPermsModalRef = useModalOrigin(showEditPerms);
  const editAdminModalRef = useModalOrigin(showEditAdmin);
  const deleteAdminModalRef = useModalOrigin(!!deleteAdminTarget);
  const adminActionModalRef = useModalOrigin(!!adminActionConfirm);

  const loadAll = async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Rôles (pour catalogue de permissions)
      if (canRolesView) {
        const r = await fetch(`${API_BASE}${ENDPOINTS.roles()}`, { headers: { Authorization: `Bearer ${token}` }});
        const rolesJson = await r.json();
        if (!r.ok) throw new Error(rolesJson.error || "Erreur chargement rôles");
        const rs = (rolesJson.data || rolesJson).map(x => ({
          ...x,
          permissions: safeJson(x.permissions, []),
        }));
        setRoles(rs);

        const union = Array.from(new Set(rs.flatMap(r => Array.isArray(r.permissions) ? r.permissions : []))).sort();
        const catalog = Array.isArray(rolesJson.catalog) && rolesJson.catalog.length ? rolesJson.catalog : union;
        setAllPerms(catalog);
      } else {
        setRoles([]);
        setAllPerms([]);
      }

      // Admins
      if (canUsersView) {
        const a = await fetch(`${API_BASE}${ENDPOINTS.admins()}`, { headers: { Authorization: `Bearer ${token}` }});
        const aJson = await a.json();
        if (!a.ok) throw new Error(aJson.error || "Erreur chargement admins");
        setAdmins(Array.isArray(aJson.data) ? aJson.data : []);
      } else {
        setAdmins([]);
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [token, canUsersView, canRolesView]);

  useEffect(() => {
    const s = getSocketInstance();
    if (!s) return;
    const handleOnline = (payload) => {
      setOnlineAdminIds(Array.isArray(payload?.ids) ? payload.ids : []);
    };
    const requestOnline = () => s.emit("admins_online_request");
    s.on("admins_online", handleOnline);
    s.on("connect", requestOnline);
    if (s.connected) requestOnline();
    return () => {
      s.off("admins_online", handleOnline);
      s.off("connect", requestOnline);
    };
  }, []);

  const onlineSet = useMemo(
    () => new Set(onlineAdminIds.map((id) => Number(id))),
    [onlineAdminIds]
  );
  const connectedAdmins = useMemo(
    () => admins.filter((a) => onlineSet.has(Number(a.id))),
    [admins, onlineSet]
  );

  const canViewHistory = !!user?.is_super;
  const canEditAdminPerms = !!user?.is_super;

  const loadAdminEvents = async (adminId) => {
    if (!canViewHistory || !token || !adminId) return;
    setEventsLoading(true);
    setEventsError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/rbac/users/${adminId}/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur chargement historique");
      setEvents(Array.isArray(data.data) ? data.data : []);
    } catch (e) {
      setEventsError(e.message || "Erreur chargement historique");
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  const printAdminHistory = () => {
    if (!detailAdmin) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const rows = filteredEvents
      .map((ev) => {
        const title = formatAdminAction(ev.action);
        const date = ev.created_at ? new Date(ev.created_at).toLocaleString() : "—";
        const metaLines = formatAdminEventMetaLines(ev.meta);
        const meta = metaLines.length ? metaLines.join(" • ") : "";
        return `
          <div class="row">
            <div class="title">${title}</div>
            <div class="date">${date}</div>
            ${meta ? `<div class="meta">${meta}</div>` : ""}
          </div>
        `;
      })
      .join("");
    win.document.write(`
      <html>
        <head>
          <title>Historique admin</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; color: #111; }
            h2 { margin: 0 0 12px; }
            .row { border: 1px solid #e5e5e5; border-radius: 10px; padding: 12px; margin-bottom: 10px; }
            .title { font-weight: 700; }
            .date { color: #666; font-size: 12px; margin-top: 4px; }
            .meta { color: #444; font-size: 12px; margin-top: 6px; }
          </style>
        </head>
        <body>
          <h2>Historique d’activité — ${detailAdmin.name || "Admin"}</h2>
          ${rows || "<p>Aucune activité enregistrée.</p>"}
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  // Filtre admins
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return admins;
    return admins.filter(a =>
      String(a.id || "").includes(s) ||
      (a.name||"").toLowerCase().includes(s) ||
      (a.email||"").toLowerCase().includes(s) ||
      (a.phone||"").toLowerCase().includes(s) ||
      (
        Array.isArray(a.roles)
          ? a.roles.map(r => r.name || r.slug).join(" ").toLowerCase()
          : (a.role?.name || a.role?.slug || "")
      ).includes(s)
    );
  }, [admins, q]);

  // Quand on choisit un rôle → préremplir la sélection de permissions
  useEffect(() => {
    if (!roleId) { setCheckedPerms([]); setCheckAll(false); return; }
    const r = roles.find(x => String(x.id) === String(roleId));
    const perms = r?.permissions || [];
    setCheckedPerms(perms);
    setCheckAll(perms.length > 0 && perms.length === allPerms.length);
  }, [roleId, roles, allPerms.length]);

  // Recalcule checkAll quand la sélection ou le catalogue change
  useEffect(() => {
    setCheckAll(
      checkedPerms.length > 0 &&
      allPerms.length > 0 &&
      checkedPerms.length === allPerms.length
    );
  }, [checkedPerms, allPerms]);

  useEffect(() => {
    const closeMenus = (e) => {
      if (!e.target.closest(".admin-actions-menu")) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", closeMenus);
    return () => document.removeEventListener("mousedown", closeMenus);
  }, []);

  // Quand on change le rôle en édition → préremplir permissions
  useEffect(() => {
    if (!editRoleId) { setEditCheckedPerms([]); setEditCheckAll(false); return; }
    const r = roles.find(x => String(x.id) === String(editRoleId));
    const perms = r?.permissions || [];
    setEditCheckedPerms(perms);
    setEditCheckAll(perms.length > 0 && perms.length === allPerms.length);
  }, [editRoleId, roles, allPerms.length]);

  useEffect(() => {
    setEditCheckAll(
      editCheckedPerms.length > 0 &&
      allPerms.length > 0 &&
      editCheckedPerms.length === allPerms.length
    );
  }, [editCheckedPerms, allPerms]);

  // Tout cocher / décocher
  const toggleAll = () => {
    if (!allPerms.length) return;
    if (checkAll) {
      setCheckedPerms([]);
    } else {
      setCheckedPerms(allPerms);
    }
  };

  const toggleOne = (perm) => {
    setCheckedPerms(prev => {
      const exists = prev.includes(perm);
      const next = exists ? prev.filter(p => p !== perm) : [...prev, perm];
      return next;
    });
  };

  const toggleAllEdit = () => {
    if (!allPerms.length) return;
    if (editCheckAll) {
      setEditCheckedPerms([]);
    } else {
      setEditCheckedPerms(allPerms);
    }
  };

  const toggleOneEdit = (perm) => {
    setEditCheckedPerms(prev => {
      const exists = prev.includes(perm);
      const next = exists ? prev.filter(p => p !== perm) : [...prev, perm];
      return next;
    });
  };

  const filteredPerms = useMemo(() => {
    const s = permFilter.trim().toLowerCase();
    if (!s) return allPerms;
    return allPerms.filter(p => p.toLowerCase().includes(s));
  }, [allPerms, permFilter]);

  const filteredEditPerms = useMemo(() => {
    const s = editPermFilter.trim().toLowerCase();
    if (!s) return allPerms;
    return allPerms.filter(p => p.toLowerCase().includes(s));
  }, [allPerms, editPermFilter]);

  const open = () => {
    setForm({ name: "", email: "", phone: "" });
    const first = roles[0];
    setRoleId(first?.id ?? null);
    setCheckedPerms(first?.permissions ?? []);
    setPermFilter("");
    setShow(true);
  };

  const removeAdmin = async (id) => {
    if (!canUsersManage) {
      toast.error("Permission refusée");
      return false;
    }
    try {
      setDeletingAdmin(true);
      const r = await fetch(`${API_BASE}${ENDPOINTS.adminDelete(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Erreur suppression");
      toast.success("Administrateur supprimé ✅");
      await loadAll();
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    } finally {
      setDeletingAdmin(false);
    }
  };

  const createAdmin = async () => {
    if (!canUsersManage) return toast.error("Permission refusée");
    if (!form.name || !form.email) return toast.error("Nom et email requis");
    try {
      setSaving(true);
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        role_id: roleId || null,
        permissions: checkedPerms || [],
      };
      const r = await fetch(`${API_BASE}${ENDPOINTS.adminCreate()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Erreur création admin");

      toast.success(
        j?.temp_password
          ? `Admin créé ✅ — Email envoyé. 🔑 MDP provisoire: ${j.temp_password}`
          : "Admin créé ✅ — Un email de bienvenue a été envoyé."
      );
      setShow(false);
      await loadAll();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const disabledCreate = saving || !canUsersManage || (!roleId && checkedPerms.length === 0);
  const disabledEdit = savingEditPerms || !canEditAdminPerms || (!editRoleId && editCheckedPerms.length === 0);

  const openEditAdminModal = (admin) => {
    setEditingAdmin(admin);
    setEditAdminForm({
      name: admin?.name || "",
      email: admin?.email || "",
      phone: admin?.phone || "",
    });
    setClosingEditAdmin(false);
    setShowEditAdmin(true);
  };

  const openEditPermissions = () => {
    if (!detailAdmin) return;
    const roleFromAdmin = Array.isArray(detailAdmin.roles) && detailAdmin.roles.length ? detailAdmin.roles[0] : null;
    const initialRoleId = detailAdmin.role_id || roleFromAdmin?.id || (roles[0]?.id ?? null);
    const initialPerms = roleFromAdmin?.permissions?.length
      ? roleFromAdmin.permissions
      : (roles.find(x => String(x.id) === String(initialRoleId))?.permissions || []);
    setEditRoleId(initialRoleId);
    setEditCheckedPerms(initialPerms);
    setEditPermFilter("");
    setEditCheckAll(initialPerms.length > 0 && initialPerms.length === allPerms.length);
    setClosingEditPerms(false);
    setShowEditPerms(true);
  };

  const openDeleteAdmin = (admin) => {
    setClosingDeleteAdmin(false);
    setDeleteAdminTarget(admin);
  };

  const saveAdminPermissions = async () => {
    if (!detailAdmin) return;
    if (!canEditAdminPerms) return toast.error("Permission refusée");
    try {
      setSavingEditPerms(true);
      const payload = {
        role_id: editRoleId || null,
        permissions: editCheckedPerms || [],
      };
      const res = await fetch(`${API_BASE}/api/admin/rbac/users/${detailAdmin.id}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur mise à jour permissions");
      toast.success("Permissions mises à jour ✅");
      const updated = data?.data;
      if (updated?.id) {
        setDetailAdmin((prev) => prev ? ({ ...prev, ...updated }) : prev);
      }
      await loadAll();
      setClosingEditPerms(true);
      setTimeout(() => {
        setShowEditPerms(false);
        setClosingEditPerms(false);
      }, 180);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingEditPerms(false);
    }
  };

  const updateAdminProfile = async () => {
    if (!editingAdmin) return;
    if (!canUsersManage) return toast.error("Permission refusée");
    if (!editAdminForm.name || !editAdminForm.email) {
      return toast.error("Nom et email requis");
    }
    try {
      setSavingEditAdmin(true);
      const payload = {
        name: editAdminForm.name,
        email: editAdminForm.email,
        phone: editAdminForm.phone || null,
      };
      const res = await fetch(`${API_BASE}/api/admin/rbac/users/${editingAdmin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur mise à jour admin");
      toast.success("Admin mis à jour ✅");
      const updated = data?.data || {};
      setDetailAdmin((prev) => (prev && prev.id === editingAdmin.id ? { ...prev, ...updated } : prev));
      await loadAll();
      setClosingEditAdmin(true);
      setTimeout(() => {
        setShowEditAdmin(false);
        setClosingEditAdmin(false);
        setEditingAdmin(null);
      }, 180);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingEditAdmin(false);
    }
  };

  const forceSuperAdmin = async (admin) => {
    if (!canUsersManage) return toast.error("Permission refusée");
    if (!admin) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/rbac/users/${admin.id}/force-super`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur force superadmin");
      toast.success("Superadmin activé ✅");
      await loadAll();
      setDetailAdmin((prev) => (prev && prev.id === admin.id ? { ...prev, ...data.data } : prev));
    } catch (e) {
      toast.error(e.message);
    }
  };

  const resetAdminPassword = async (id) => {
    if (!canUsersManage) return toast.error("Permission refusée");
    try {
      setConfirmAdminActionLoading(true);
      const res = await fetch(`${API_BASE}/api/admin/rbac/users/${id}/reset-password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur reset mot de passe");
      const password = data.motDePasse || data.data?.motDePasse;
      toast.success(
        <div>
          <p>{data.message}</p>
          {password && (
            <p>
              🔑 Nouveau mot de passe : <b>{password}</b>
            </p>
          )}
          {password && (
            <button
              className="ml-2 px-2 py-1 rounded"
              style={{ background: "var(--accent)", color: "#fff" }}
              onClick={() => {
                navigator.clipboard.writeText(password);
                toast.info("Mot de passe copié 📋");
              }}
            >
              Copier
            </button>
          )}
        </div>,
        { autoClose: false }
      );
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    } finally {
      setConfirmAdminActionLoading(false);
    }
  };

  const toggleAdminBlock = async (admin) => {
    if (!canUsersManage) return toast.error("Permission refusée");
    if (!admin) return;
    try {
      setConfirmAdminActionLoading(true);
      const res = await fetch(`${API_BASE}/api/admin/rbac/users/${admin.id}/block`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ blocked: !admin.is_blocked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur mise à jour statut");
      toast.success(admin.is_blocked ? "Admin débloqué ✅" : "Admin bloqué ✅");
      await loadAll();
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    } finally {
      setConfirmAdminActionLoading(false);
    }
  };

  const openAdminActionConfirm = (action, admin) => {
    setClosingAdminAction(false);
    setAdminActionConfirm({ action, admin });
  };

  return (
    <div className="p-6 rounded space-y-6" style={{ background: "var(--bg-card)", color: "var(--text-color)" }}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <FaUserShield /> Administrateurs
          <button
            type="button"
            onClick={() => {
              setClosingOnlineModal(false);
              setShowOnlineModal(true);
            }}
            className="text-xs px-2 py-1 rounded-full border transition"
            style={{
              background: "rgba(16,185,129,0.15)",
              color: "#34d399",
              borderColor: "rgba(16,185,129,0.35)",
            }}
          >
            En ligne {onlineAdminIds.length}
          </button>
        </h2>
        {canUsersManage && (
          <button onClick={open} className="px-4 py-2 rounded flex items-center gap-2"
            style={{ background: "var(--accent)", color: "#fff" }}>
            <FaUserPlus /> Ajouter un admin
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative w-full">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Rechercher (nom, email, téléphone, rôle)…"
            className="pl-9 w-full p-2 rounded border"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              borderColor: "var(--border-color)",
            }}
          />
        </div>
        <button onClick={loadAll} className="px-4 py-2 rounded" style={{ background: "var(--accent)", color: "#fff" }}>
          Actualiser
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--muted)" }}>
          <AiOutlineLoading3Quarters className="inline animate-spin mr-2" />
          Chargement…
        </p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>Aucun administrateur.</p>
      ) : (
        <div
          className="overflow-x-auto overflow-y-auto"
          style={{ maxHeight: "70vh", minHeight: "50vh" }}
        >
          <table className="w-full text-sm border-collapse">
            <thead style={{ color: "var(--muted)", borderBottom: "1px solid var(--border-color)" }}>
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Nom</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Téléphone</th>
                <th className="px-3 py-2 text-left">Rôle</th>
                <th className="px-3 py-2 text-center">Statut</th>
                <th className="px-3 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr
                  key={a.id}
                  className="hover:opacity-90 cursor-pointer"
                  style={{ borderTop: "1px solid var(--border-color)" }}
                  onClick={() => {
                    setClosingDetail(false);
                    setDetailAdmin(a);
                    setEvents([]);
                    setEventsError("");
                    setEventsLoading(false);
                  }}
                >
                  <td className="px-3 py-2">#{a.id}</td>
                  <td className="px-3 py-2">{a.name || "—"}</td>
                  <td className="px-3 py-2" style={{ color: "#60a5fa" }}>{a.email || "—"}</td>
                  <td className="px-3 py-2">{a.phone || "—"}</td>
                  <td className="px-3 py-2">
                    {Array.isArray(a.roles) && a.roles.length ? (a.roles[0].name || a.roles[0].slug) :
                      a.role ? (a.role.name || a.role.slug) :
                        (a.is_super ? "Super admin" : <span style={{ color: "var(--muted)" }}>—</span>)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {a.is_super ? (
                      <span className="px-2 py-1 rounded text-xs" style={{ background: "#1f2937", color: "#facc15" }}>
                        <FaCrown className="inline mr-1" /> super
                      </span>
                    ) : <span style={{ color: "var(--muted)" }}>admin</span>}
                  </td>
                  <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2 justify-center">
                      {canUsersManage && (
                        <div className="relative admin-actions-menu">
                          <button
                            onClick={() => setOpenMenuId(openMenuId === a.id ? null : a.id)}
                            className="p-2 rounded-full text-white shadow-md transition"
                            style={{ background: "var(--accent)" }}
                            title="Plus d'actions"
                          >
                            <FaEllipsisH />
                          </button>
                          {openMenuId === a.id && (
                            <div
                              className="absolute right-0 mt-2 w-56 rounded shadow-lg border admin-actions-menu"
                              style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", zIndex: 10 }}
                            >
                              <button
                                onClick={() => {
                                  openEditAdminModal(a);
                                  setOpenMenuId(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 hover:bg-[var(--bg-main)]"
                                style={{ color: "var(--text-color)" }}
                              >
                                <FaPen className="text-amber-500" />
                                Modifier
                              </button>
                            <button
                                onClick={() => {
                                  openAdminActionConfirm("reset", a);
                                  setOpenMenuId(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 hover:bg-[var(--bg-main)]"
                                style={{ color: "var(--text-color)" }}
                              >
                                <FaKey className="text-blue-500" />
                                Réinitialiser
                              </button>
                              {!a.is_super && (
                                <button
                                  onClick={() => {
                                    forceSuperAdmin(a);
                                    setOpenMenuId(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 hover:bg-[var(--bg-main)]"
                                  style={{ color: "var(--text-color)" }}
                                >
                                  <FaCrown className="text-yellow-500" />
                                  Forcer superadmin
                                </button>
                              )}
                              {a.is_blocked !== null && !a.is_super && (
                                <button
                                  onClick={() => {
                                    openAdminActionConfirm("block", a);
                                    setOpenMenuId(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 hover:bg-[var(--bg-main)]"
                                  style={{ color: "var(--text-color)" }}
                                >
                                  <FaBan className="text-red-500" />
                                  {a.is_blocked ? "Débloquer" : "Bloquer"}
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  openDeleteAdmin(a);
                                  setOpenMenuId(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 hover:bg-[var(--bg-main)]"
                                style={{ color: "var(--text-color)" }}
                                disabled={Number(a.id) === Number(user?.id)}
                                title={Number(a.id) === Number(user?.id) ? "Impossible de supprimer votre compte" : ""}
                              >
                                <FaTrash className="text-red-500" />
                                Supprimer
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL CREATE */}
      {show && (
        <Modal onClose={() => setShow(false)}>
          <h3 className="text-lg font-bold mb-4">➕ Nouvel administrateur</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LabeledInput icon={<FaIdBadge />} label="Nom" value={form.name}
              onChange={(v) => setForm({ ...form, name: v })} />

            <LabeledInput icon={<FaEnvelope />} type="email" label="Email"
              value={form.email} onChange={(v) => setForm({ ...form, email: v })} />

            <LabeledInput icon={<FaPhone />} label="Téléphone"
              value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />

            <div>
              <label className="block text-sm opacity-70 mb-1">Rôle</label>
              <select
                value={roleId || ""}
                onChange={(e) => setRoleId(e.target.value ? Number(e.target.value) : null)}
                className="w-full p-2 rounded border"
                style={{ background: "var(--bg-card)", color: "var(--text-color)", borderColor: "var(--border-color)" }}
                disabled={!canUsersManage || roles.length === 0}
              >
                {roles.length === 0 ? <option>Aucun rôle</option> :
                  roles.map(r => <option key={r.id} value={r.id}>{r.name || r.slug}</option>)
                }
              </select>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Permissions à accorder</label>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <FaSearch className="absolute left-2 top-1/2 -translate-y-1/2 opacity-50" />
                  <input
                    placeholder="Filtrer…"
                    value={permFilter}
                    onChange={(e) => setPermFilter(e.target.value)}
                    className="pl-8 p-2 rounded border"
                    style={{ background: "var(--bg-card)", color: "var(--text-color)", borderColor: "var(--border-color)" }}
                  />
                </div>
                <button onClick={toggleAll} className="px-3 py-2 rounded border"
                  style={{ borderColor: "var(--border-color)" }}>
                  {checkAll ? <><FaSquare className="inline mr-2" />Tout retirer</> : <><FaCheckSquare className="inline mr-2" />Tout accorder</>}
                </button>
              </div>
            </div>

            <div className="p-2 rounded border max-h-64 overflow-auto"
              style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
              {filteredPerms.length === 0 ? (
                <p style={{ color: "var(--muted)" }}>Aucune permission.</p>
              ) : filteredPerms.map((perm) => {
                const checked = checkedPerms.includes(perm);
                return (
                  <label key={perm} className="flex items-center gap-2 mb-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(perm)}
                    />
                    <span>{PERM_LABELS[perm] ?? perm}</span>
                  </label>
                );
              })}
            </div>

            <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
              À la création : un email sera envoyé à l’admin avec un mot de passe provisoire.
              À la première connexion, il devra le changer.
            </p>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button onClick={() => setShow(false)} className="px-4 py-2 rounded border"
              style={{ borderColor: "var(--border-color)" }}>
              Annuler
            </button>
            <button
              onClick={createAdmin}
              disabled={disabledCreate}
              className="px-4 py-2 rounded flex items-center gap-2 disabled:opacity-60"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {saving ? <AiOutlineLoading3Quarters className="animate-spin" /> : <FaSave />}
              Créer l’admin
            </button>
          </div>
        </Modal>
      )}
      {detailAdmin && (
        <div
          className={`fixed inset-0 flex justify-center items-center modal-backdrop ${closingDetail ? "closing" : ""}`}
          style={{ background: "rgba(0,0,0,0.55)", zIndex: 60 }}
          onClick={() => {
            setClosingDetail(true);
            setTimeout(() => {
              setDetailAdmin(null);
              setClosingDetail(false);
            }, 180);
          }}
        >
          <div
            ref={detailModalRef}
            className={`w-full max-w-2xl p-6 rounded-xl shadow-xl modal-panel ${closingDetail ? "closing" : ""}`}
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              border: "1px solid var(--border-color)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <FaUserShield /> Profil administrateur
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <Info label="Nom" value={detailAdmin.name} />
              <Info label="Email" value={detailAdmin.email || "—"} accent />
              <Info label="Téléphone" value={detailAdmin.phone || detailAdmin.phone_number || detailAdmin.telephone || "—"} />
              <div className="relative">
                <Info label="Rôle" value={detailAdmin.role_name || (detailAdmin.is_super ? "Super admin" : "—")} />
                {canEditAdminPerms && !detailAdmin.is_super && (
                  <button
                    type="button"
                    className="absolute top-2 right-2 p-2 rounded border text-xs"
                    style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}
                    onClick={openEditPermissions}
                    title="Modifier les permissions"
                  >
                    <FaPen />
                  </button>
                )}
              </div>
              <Info
                label="Statut"
                value={detailAdmin.is_super ? "super" : "admin"}
                badgeColor={detailAdmin.is_super ? "#facc15" : "#9ca3af"}
              />
              <Info label="ID" value={`#${detailAdmin.id}`} />
            </div>

            {canViewHistory && (
              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <button
                    className="px-3 py-1 rounded border text-sm"
                    style={{ borderColor: "var(--border-color)" }}
                    onClick={() => {
                      setClosingHistory(false);
                      setShowHistoryModal(true);
                      setHistoryFilterType("all");
                      setHistoryFilterValue("");
                      loadAdminEvents(detailAdmin.id);
                    }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <FaEye />
                      Voir historique
                    </span>
                  </button>
                </div>
              </div>
            )}

            {!canViewHistory && (
              <p className="mt-5 text-sm" style={{ color: "var(--muted)" }}>
                Historique réservé au manager ou superadmin.
              </p>
            )}

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setClosingDetail(true);
                  setTimeout(() => {
                    setDetailAdmin(null);
                    setClosingDetail(false);
                  }, 180);
                }}
                className="px-4 py-2 rounded"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
      {showEditAdmin && (
        <div
          className={`fixed inset-0 flex justify-center items-center modal-backdrop ${closingEditAdmin ? "closing" : ""}`}
          style={{ background: "rgba(0,0,0,0.55)", zIndex: 65 }}
          onClick={() => {
            setClosingEditAdmin(true);
            setTimeout(() => {
              setShowEditAdmin(false);
              setClosingEditAdmin(false);
              setEditingAdmin(null);
            }, 180);
          }}
        >
          <div
            ref={editAdminModalRef}
            className={`w-full max-w-xl p-6 rounded-xl shadow-xl modal-panel ${closingEditAdmin ? "closing" : ""}`}
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              border: "1px solid var(--border-color)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4">Modifier l’administrateur</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <LabeledInput
                icon={<FaIdBadge />}
                label="Nom"
                value={editAdminForm.name}
                onChange={(v) => setEditAdminForm({ ...editAdminForm, name: v })}
              />
              <LabeledInput
                icon={<FaEnvelope />}
                type="email"
                label="Email"
                value={editAdminForm.email}
                onChange={(v) => setEditAdminForm({ ...editAdminForm, email: v })}
              />
              <LabeledInput
                icon={<FaPhone />}
                label="Téléphone"
                value={editAdminForm.phone}
                onChange={(v) => setEditAdminForm({ ...editAdminForm, phone: v })}
              />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setClosingEditAdmin(true);
                  setTimeout(() => {
                    setShowEditAdmin(false);
                    setClosingEditAdmin(false);
                    setEditingAdmin(null);
                  }, 180);
                }}
                className="px-4 py-2 rounded border"
                style={{ borderColor: "var(--border-color)" }}
              >
                Annuler
              </button>
              <button
                onClick={updateAdminProfile}
                disabled={savingEditAdmin}
                className="px-4 py-2 rounded flex items-center gap-2 disabled:opacity-60"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                {savingEditAdmin ? <AiOutlineLoading3Quarters className="animate-spin" /> : <FaSave />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteAdminTarget && (
        <div
          className={`fixed inset-0 flex justify-center items-center modal-backdrop ${closingDeleteAdmin ? "closing" : ""}`}
          style={{ background: "rgba(0,0,0,0.55)", zIndex: 65 }}
          onClick={() => {
            if (deletingAdmin) return;
            setClosingDeleteAdmin(true);
            setTimeout(() => {
              setDeleteAdminTarget(null);
              setClosingDeleteAdmin(false);
            }, 180);
          }}
        >
          <div
            ref={deleteAdminModalRef}
            className={`w-full max-w-md p-6 rounded-xl shadow-xl modal-panel ${closingDeleteAdmin ? "closing" : ""}`}
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              border: "1px solid var(--border-color)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-2">Supprimer l’administrateur</h3>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Supprimer définitivement{" "}
              <span className="font-semibold" style={{ color: "var(--text-color)" }}>
                {deleteAdminTarget?.name || "cet administrateur"}
              </span>{" "}
              ?
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  if (deletingAdmin) return;
                  setClosingDeleteAdmin(true);
                  setTimeout(() => {
                    setDeleteAdminTarget(null);
                    setClosingDeleteAdmin(false);
                  }, 180);
                }}
                className="px-4 py-2 rounded border"
                style={{ borderColor: "var(--border-color)" }}
                disabled={deletingAdmin}
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  if (!deleteAdminTarget) return;
                  const ok = await removeAdmin(deleteAdminTarget.id);
                  if (ok) {
                    setClosingDeleteAdmin(true);
                    setTimeout(() => {
                      setDeleteAdminTarget(null);
                      setClosingDeleteAdmin(false);
                    }, 180);
                  }
                }}
                className="px-4 py-2 rounded flex items-center gap-2 disabled:opacity-60"
                style={{ background: "#e5372e", color: "#fff" }}
                disabled={deletingAdmin}
              >
                {deletingAdmin ? <AiOutlineLoading3Quarters className="animate-spin" /> : <FaTrash />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
      {adminActionConfirm && (
        <div
          className={`fixed inset-0 flex justify-center items-center modal-backdrop ${closingAdminAction ? "closing" : ""}`}
          style={{ background: "rgba(0,0,0,0.55)", zIndex: 65 }}
          onClick={() => {
            if (confirmAdminActionLoading) return;
            setClosingAdminAction(true);
            setTimeout(() => {
              setAdminActionConfirm(null);
              setClosingAdminAction(false);
            }, 180);
          }}
        >
          <div
            ref={adminActionModalRef}
            className={`w-full max-w-md p-6 rounded-xl shadow-xl modal-panel ${closingAdminAction ? "closing" : ""}`}
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              border: "1px solid var(--border-color)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-2">
              {adminActionConfirm.action === "reset"
                ? "Réinitialiser le mot de passe"
                : adminActionConfirm.admin?.is_blocked
                  ? "Débloquer l’administrateur"
                  : "Bloquer l’administrateur"}
            </h3>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {adminActionConfirm.action === "reset"
                ? "Réinitialiser le mot de passe de"
                : adminActionConfirm.admin?.is_blocked
                  ? "Débloquer"
                  : "Bloquer"}{" "}
              <span className="font-semibold" style={{ color: "var(--text-color)" }}>
                {adminActionConfirm.admin?.name || "cet admin"}
              </span>
              ?
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  if (confirmAdminActionLoading) return;
                  setClosingAdminAction(true);
                  setTimeout(() => {
                    setAdminActionConfirm(null);
                    setClosingAdminAction(false);
                  }, 180);
                }}
                className="px-4 py-2 rounded border"
                style={{ borderColor: "var(--border-color)" }}
                disabled={confirmAdminActionLoading}
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  if (!adminActionConfirm?.admin) return;
                  const ok = adminActionConfirm.action === "reset"
                    ? await resetAdminPassword(adminActionConfirm.admin.id)
                    : await toggleAdminBlock(adminActionConfirm.admin);
                  if (ok) {
                    setClosingAdminAction(true);
                    setTimeout(() => {
                      setAdminActionConfirm(null);
                      setClosingAdminAction(false);
                    }, 180);
                  }
                }}
                className="px-4 py-2 rounded text-white disabled:opacity-60 flex items-center gap-2"
                style={{
                  background: adminActionConfirm.action === "reset"
                    ? "var(--accent)"
                    : adminActionConfirm.admin?.is_blocked ? "#22c55e" : "#e5372e",
                }}
                disabled={confirmAdminActionLoading}
              >
                {confirmAdminActionLoading
                  ? "..."
                  : adminActionConfirm.action === "reset"
                    ? "Réinitialiser"
                    : adminActionConfirm.admin?.is_blocked
                      ? "Débloquer"
                      : "Bloquer"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showEditPerms && (
        <div
          className={`fixed inset-0 flex justify-center items-center modal-backdrop ${closingEditPerms ? "closing" : ""}`}
          style={{ background: "rgba(0,0,0,0.55)", zIndex: 70 }}
          onClick={() => {
            setClosingEditPerms(true);
            setTimeout(() => {
              setShowEditPerms(false);
              setClosingEditPerms(false);
            }, 180);
          }}
        >
          <div
            ref={editPermsModalRef}
            className={`w-full max-w-3xl p-6 rounded-xl shadow-xl modal-panel ${closingEditPerms ? "closing" : ""}`}
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              border: "1px solid var(--border-color)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4">Modifier les permissions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm opacity-70 mb-1">Rôle</label>
                <select
                  value={editRoleId || ""}
                  onChange={(e) => setEditRoleId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full p-2 rounded border"
                  style={{ background: "var(--bg-card)", color: "var(--text-color)", borderColor: "var(--border-color)" }}
                  disabled={!canEditAdminPerms || roles.length === 0}
                >
                  {roles.length === 0 ? <option>Aucun rôle</option> :
                    roles.map(r => <option key={r.id} value={r.id}>{r.name || r.slug}</option>)
                  }
                </select>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">Permissions à accorder</label>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <FaSearch className="absolute left-2 top-1/2 -translate-y-1/2 opacity-50" />
                    <input
                      placeholder="Filtrer…"
                      value={editPermFilter}
                      onChange={(e) => setEditPermFilter(e.target.value)}
                      className="pl-8 p-2 rounded border"
                      style={{ background: "var(--bg-card)", color: "var(--text-color)", borderColor: "var(--border-color)" }}
                    />
                  </div>
                  <button onClick={toggleAllEdit} className="px-3 py-2 rounded border"
                    style={{ borderColor: "var(--border-color)" }}>
                    {editCheckAll ? <><FaSquare className="inline mr-2" />Tout retirer</> : <><FaCheckSquare className="inline mr-2" />Tout accorder</>}
                  </button>
                </div>
              </div>

              <div className="p-2 rounded border max-h-64 overflow-auto"
                style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                {filteredEditPerms.length === 0 ? (
                  <p style={{ color: "var(--muted)" }}>Aucune permission.</p>
                ) : filteredEditPerms.map((perm) => {
                  const checked = editCheckedPerms.includes(perm);
                  return (
                    <label key={perm} className="flex items-center gap-2 mb-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOneEdit(perm)}
                      />
                      <span>{PERM_LABELS[perm] ?? perm}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setClosingEditPerms(true);
                  setTimeout(() => {
                    setShowEditPerms(false);
                    setClosingEditPerms(false);
                  }, 180);
                }}
                className="px-4 py-2 rounded border"
                style={{ borderColor: "var(--border-color)" }}
              >
                Annuler
              </button>
              <button
                onClick={saveAdminPermissions}
                disabled={disabledEdit}
                className="px-4 py-2 rounded flex items-center gap-2 disabled:opacity-60"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                {savingEditPerms ? <AiOutlineLoading3Quarters className="animate-spin" /> : <FaSave />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
      {canViewHistory && showHistoryModal && (
        <div
          className={`fixed inset-0 flex justify-center items-center modal-backdrop ${closingHistory ? "closing" : ""}`}
          style={{ background: "rgba(0,0,0,0.55)", zIndex: 70 }}
          onClick={() => {
            setClosingHistory(true);
            setTimeout(() => {
              setShowHistoryModal(false);
              setClosingHistory(false);
            }, 180);
          }}
        >
          <div
            ref={historyModalRef}
            className={`w-full max-w-2xl p-6 rounded-xl shadow-xl modal-panel ${closingHistory ? "closing" : ""}`}
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              border: "1px solid var(--border-color)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold">Historique d’activité</h3>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={historyFilterType}
                  onChange={(e) => {
                    const next = e.target.value;
                    setHistoryFilterType(next);
                    setHistoryFilterValue("");
                  }}
                  className="px-2 py-1 rounded border text-sm"
                  style={{
                    borderColor: "var(--border-color)",
                    background: "var(--bg-card)",
                    color: "var(--text-color)",
                  }}
                >
                  <option value="all">Tous</option>
                  <option value="day">Jour</option>
                  <option value="month">Mois</option>
                </select>
                {historyFilterType !== "all" && (
                  <input
                    type={historyFilterType === "day" ? "date" : "month"}
                    value={historyFilterValue}
                    onChange={(e) => setHistoryFilterValue(e.target.value)}
                    className="px-2 py-1 rounded border text-sm"
                    style={{
                      borderColor: "var(--border-color)",
                      background: "var(--bg-card)",
                      color: "var(--text-color)",
                    }}
                  />
                )}
                {historyFilterType !== "all" && historyFilterValue && (
                  <button
                    className="px-3 py-1 rounded border text-sm"
                    style={{ borderColor: "var(--border-color)" }}
                    onClick={() => {
                      setHistoryFilterType("all");
                      setHistoryFilterValue("");
                    }}
                  >
                    Effacer
                  </button>
                )}
                <button
                  className="px-3 py-1 rounded border text-sm"
                  style={{ borderColor: "var(--border-color)" }}
                  onClick={() => detailAdmin && loadAdminEvents(detailAdmin.id)}
                >
                  Actualiser
                </button>
                <button
                  className="px-3 py-1 rounded border text-sm"
                  style={{ borderColor: "var(--border-color)" }}
                  onClick={printAdminHistory}
                  title="Imprimer l’historique"
                >
                  <span className="inline-flex items-center gap-2">
                    <FaPrint />
                    Imprimer
                  </span>
                </button>
              </div>
            </div>
            {eventsLoading ? (
              <p style={{ color: "var(--muted)" }}>Chargement...</p>
            ) : eventsError ? (
              <p style={{ color: "#e5372e" }}>{eventsError}</p>
            ) : visibleEvents.length === 0 ? (
              <p style={{ color: "var(--muted)" }}>Aucune activité enregistrée.</p>
            ) : filteredEvents.length === 0 ? (
              <p style={{ color: "var(--muted)" }}>Aucune activité pour ce filtre.</p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
                {filteredEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 rounded border text-sm"
                    style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}
                  >
                    <div className="flex justify-between gap-3">
                      <span className="font-semibold">{formatAdminAction(ev.action)}</span>
                      <span style={{ color: "var(--muted)" }}>
                        {new Date(ev.created_at).toLocaleString()}
                      </span>
                    </div>
                    {renderAdminEventMeta(ev)}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setClosingHistory(true);
                  setTimeout(() => {
                    setShowHistoryModal(false);
                    setClosingHistory(false);
                  }, 180);
                }}
                className="px-4 py-2 rounded"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
      {showOnlineModal && (
        <div
          className={`fixed inset-0 flex justify-center items-center modal-backdrop ${closingOnlineModal ? "closing" : ""}`}
          style={{ background: "rgba(0,0,0,0.55)", zIndex: 60 }}
          onClick={() => {
            setClosingOnlineModal(true);
            setTimeout(() => {
              setShowOnlineModal(false);
              setClosingOnlineModal(false);
            }, 180);
          }}
        >
          <div
            ref={onlineModalRef}
            className={`w-full max-w-md p-5 rounded-xl shadow-xl modal-panel ${closingOnlineModal ? "closing" : ""}`}
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              border: "1px solid var(--border-color)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold">Admins connectés</h3>
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                {connectedAdmins.length} en ligne
              </span>
            </div>
            {connectedAdmins.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Aucun admin connecté.
              </p>
            ) : (
              <div className="space-y-2">
                {connectedAdmins.map((a) => (
                  <button
                    key={`online-admin-${a.id}`}
                    type="button"
                    onClick={() => {
                      setClosingOnlineModal(true);
                      setTimeout(() => {
                        setShowOnlineModal(false);
                        setClosingOnlineModal(false);
                        setClosingDetail(false);
                        setDetailAdmin(a);
                        setEvents([]);
                        setEventsError("");
                        setEventsLoading(false);
                      }, 180);
                    }}
                    className="w-full text-left flex items-center gap-3 px-3 py-2 rounded border transition hover:brightness-105"
                    style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}
                  >
                    <span className="online-dot" aria-hidden="true" />
                    <span>{a.name || "Admin"}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setClosingOnlineModal(true);
                  setTimeout(() => {
                    setShowOnlineModal(false);
                    setClosingOnlineModal(false);
                  }, 180);
                }}
                className="px-4 py-2 rounded"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LabeledInput({ label, value, onChange, type = "text", icon }) {
  return (
    <div>
      <label className="block text-sm opacity-70 mb-1">{label}</label>
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 opacity-70">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-8 w-full p-2 rounded border"
          style={{ background: "var(--bg-card)", color: "var(--text-color)", borderColor: "var(--border-color)" }}
        />
      </div>
    </div>
  );
}

function Modal({ onClose, children }) {
  const modalRef = useModalOrigin(true);
  return (
    <div
      className="fixed inset-0 flex justify-center items-center modal-backdrop"
      style={{ background: "rgba(0,0,0,0.6)", zIndex: 50 }}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="p-6 rounded shadow w-full max-w-2xl modal-panel"
        style={{ background: "var(--bg-card)", color: "var(--text-color)", border: "1px solid var(--border-color)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end mb-2">
          <button onClick={onClose} className="px-2 py-1 rounded border" style={{ borderColor: "var(--border-color)" }}>
            Fermer
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const ADMIN_ACTION_LABELS = {
  operateur_cree: "Création d’un opérateur",
  operateur_modifie: "Modification d’un opérateur",
  operateur_supprime: "Suppression d’un opérateur",
  operateur_reset_mdp: "Réinitialisation MDP opérateur",
  client_cree: "Création d’un client",
  client_modifie: "Modification d’un client",
  client_supprime: "Suppression d’un client",
  client_reset_mdp: "Réinitialisation MDP client",
  transaction_confirmee: "Transaction confirmée",
  retrait_approuve: "Retrait approuvé",
  retrait_rejete: "Retrait rejeté",
  admin_connexion: "Connexion admin",
};

function formatAdminAction(action) {
  if (!action) return "Action admin";
  return ADMIN_ACTION_LABELS[action] || action.replace(/_/g, " ");
}

function renderAdminEventMeta(ev) {
  const lines = formatAdminEventMetaLines(ev?.meta);
  if (!lines.length) return null;
  return (
    <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
      {lines.join(" • ")}
    </p>
  );
}

function formatAdminEventMetaLines(meta) {
  if (!meta) return [];
  const lines = [];
  if (meta.operator_id != null) lines.push(`Opérateur #${meta.operator_id}`);
  if (meta.client_id != null) lines.push(`Client #${meta.client_id}`);
  if (meta.admin_id != null) lines.push(`Admin #${meta.admin_id}`);
  if (meta.request_id != null) lines.push(`Mission #${meta.request_id}`);
  if (meta.transaction_id != null) lines.push(`Transaction #${meta.transaction_id}`);
  if (meta.withdrawal_id != null) lines.push(`Retrait #${meta.withdrawal_id}`);
  if (meta.amount != null) {
    const currency = meta.currency ? ` ${meta.currency}` : "";
    lines.push(`Montant ${meta.amount}${currency}`);
  }
  if (meta.net_amount != null) lines.push(`Net ${meta.net_amount}`);
  if (meta.commission != null) lines.push(`Commission ${meta.commission}`);
  if (meta.status != null) lines.push(`Statut ${meta.status}`);
  if (meta.ip) lines.push(`IP ${meta.ip}`);
  if (meta.user_agent) lines.push(`Appareil ${meta.user_agent}`);
  return lines;
}

function Info({ label, value, accent = false, badgeColor }) {
  const badge =
    badgeColor != null ? (
      <span
        className="px-2 py-1 rounded text-xs text-white"
        style={{ background: badgeColor }}
      >
        {value}
      </span>
    ) : null;
  return (
    <div
      className="p-3 rounded-lg border"
      style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}
    >
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      {badge || (
        <p
          className="mt-1 font-semibold"
          style={{ color: accent ? "var(--accent)" : "var(--text-color)" }}
        >
          {value}
        </p>
      )}
    </div>
  );
}
