// src/pages/admin/AdminUsers.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { API_BASE } from "../../config/urls";
import { toast } from "react-toastify";
import { can, isSuper } from "../../utils/rbac";
import {
  FaPlus, FaTrash, FaUserShield, FaUserPlus, FaSave,
  FaSearch, FaCrown, FaEnvelope, FaPhone, FaIdBadge, FaCheckSquare, FaSquare
} from "react-icons/fa";
import { AiOutlineLoading3Quarters } from "react-icons/ai";

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

  // Modal create
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [roleId, setRoleId] = useState(null);
  const [permFilter, setPermFilter] = useState("");
  const [allPerms, setAllPerms] = useState([]);         // master catalogue
  const [checkedPerms, setCheckedPerms] = useState([]); // sélection courante
  const [checkAll, setCheckAll] = useState(false);

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

  const filteredPerms = useMemo(() => {
    const s = permFilter.trim().toLowerCase();
    if (!s) return allPerms;
    return allPerms.filter(p => p.toLowerCase().includes(s));
  }, [allPerms, permFilter]);

  const open = () => {
    setForm({ name: "", email: "", phone: "" });
    const first = roles[0];
    setRoleId(first?.id ?? null);
    setCheckedPerms(first?.permissions ?? []);
    setPermFilter("");
    setShow(true);
  };

  const removeAdmin = async (id) => {
    if (!canUsersManage) return toast.error("Permission refusée");
    if (!confirm("Supprimer définitivement cet administrateur ?")) return;
    try {
      const r = await fetch(`${API_BASE}${ENDPOINTS.adminDelete(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Erreur suppression");
      toast.success("Administrateur supprimé ✅");
      await loadAll();
    } catch (e) {
      toast.error(e.message);
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

  return (
    <div className="p-6 rounded space-y-6" style={{ background: "var(--bg-card)", color: "var(--text-color)" }}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <FaUserShield /> Administrateurs
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
        <div className="overflow-x-auto">
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
                <tr key={a.id} style={{ borderTop: "1px solid var(--border-color)" }}>
                  <td className="px-3 py-2">#{a.id}</td>
                  <td className="px-3 py-2">{a.name || "—"}</td>
                  <td className="px-3 py-2" style={{ color: "#60a5fa" }}>{a.email || "—"}</td>
                  <td className="px-3 py-2">{a.phone || "—"}</td>
                  <td className="px-3 py-2">
                    {Array.isArray(a.roles) && a.roles.length ? (a.roles[0].name || a.roles[0].slug) :
                      a.role ? (a.role.name || a.role.slug) : <span style={{ color: "var(--muted)" }}>—</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {a.is_super ? (
                      <span className="px-2 py-1 rounded text-xs" style={{ background: "#1f2937", color: "#facc15" }}>
                        <FaCrown className="inline mr-1" /> super
                      </span>
                    ) : <span style={{ color: "var(--muted)" }}>admin</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center gap-2 justify-center">
                      {canUsersManage && (
                        <button
                          onClick={() => removeAdmin(a.id)}
                          className="px-3 py-1 rounded text-sm"
                          style={{ background: "#e5372e", color: "#fff" }}
                          title="Supprimer"
                        >
                          <FaTrash />
                        </button>
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
  return (
    <div className="fixed inset-0 flex justify-center items-center"
      style={{ background: "rgba(0,0,0,0.6)", zIndex: 50 }}>
      <div className="p-6 rounded shadow w-full max-w-2xl"
        style={{ background: "var(--bg-card)", color: "var(--text-color)", border: "1px solid var(--border-color)" }}>
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
