import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import { API_BASE } from "../../config/urls";
import { ClipboardIcon, EllipsisHorizontalIcon, CheckBadgeIcon, NoSymbolIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import "react-toastify/dist/ReactToastify.css";
import { PencilSquareIcon, TrashIcon, KeyIcon, StarIcon } from "@heroicons/react/24/solid";
import { can, isSuper } from "../../utils/rbac"; // ✅ RBAC

export default function Operators() {
  const { token, user } = useAuth(); // ✅ on récupère user
  const [operators, setOperators] = useState([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    ville: "",
    quartier: "",
    vehicle_type: "",
    is_available: true,
    lat: "",
    lng: "",
    is_internal: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailOp, setDetailOp] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const vehicleOptions = ["Voiture", "Moto", "Camion", "Pick-up", "Van", "Autre"];

  useEffect(() => {
    const closeMenus = (e) => {
      if (!e.target.closest(".op-actions-menu")) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", closeMenus);
    return () => document.removeEventListener("mousedown", closeMenus);
  }, []);

  // ✅ Permissions
  const canView   = isSuper(user) || can(user, "operators_view");
  const canCreate = isSuper(user) || can(user, "operators_create");
  const canUpdate = isSuper(user) || can(user, "operators_update");
  const canDelete = isSuper(user) || can(user, "operators_delete");
  const canReset  = isSuper(user) || can(user, "operators_reset_password");
  const canToggleInternal = canUpdate;

  const loadOperators = async () => {
    if (!canView) return; // ✅ pas d’appel si pas le droit
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/operators`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erreur (${res.status})`);
      setOperators(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      setError(err.message || "Erreur chargement opérateurs");
      toast.error(err.message);
      setOperators([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadOperators();
  }, [token]);

  const filtered = operators.filter((o) =>
    (o?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const saveOperator = async () => {
    const latNum = form.lat !== "" ? Number(form.lat) : null;
    const lngNum = form.lng !== "" ? Number(form.lng) : null;
    const payload = {
      name: form.name,
      phone: form.phone,
      email: form.email || null,
      ville: form.ville || null,
      quartier: form.quartier || null,
      vehicle_type: form.vehicle_type || null,
      is_available: !!form.is_available,
      is_internal: !!form.is_internal,
      balance: 0,
      pending_balance: 0,
    };
    if (Number.isFinite(latNum)) payload.lat = latNum;
    if (Number.isFinite(lngNum)) payload.lng = lngNum;

    try {
      if (editing) {
        if (!canUpdate) {
          toast.error("Permission refusée : modification opérateur");
          return;
        }
        const res = await fetch(`${API_BASE}/api/admin/operators/${editing.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur modification");
        toast.success("Opérateur modifié ✅");
      } else {
        if (!canCreate) {
          toast.error("Permission refusée : création d’opérateur");
          return;
        }
        const res = await fetch(`${API_BASE}/api/admin/operators`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur ajout opérateur");

        const password = data.motDePasse || data.data?.motDePasse;

        toast.success(
          <div>
            <p>Opérateur ajouté ✅</p>
            {password && (
              <p>
                🔑 Mot de passe provisoire : <b>{password}</b>
              </p>
            )}
            {password && (
              <button
                className="ml-2 px-2 py-1 rounded flex items-center gap-1"
                style={{ background: "var(--accent)", color: "#fff" }}
                onClick={() => {
                  navigator.clipboard.writeText(password);
                  toast.info("Mot de passe copié 📋");
                }}
              >
                <ClipboardIcon className="w-5 h-5" />
                Copier
              </button>
            )}
          </div>,
          { autoClose: false }
        );
      }

      await loadOperators();
      setForm({
        name: "",
        phone: "",
        email: "",
        ville: "",
        quartier: "",
        vehicle_type: "",
        is_available: true,
        lat: "",
        lng: "",
        is_internal: false,
      });
      setEditing(null);
      setShowForm(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const deleteOperator = async (id) => {
    if (!canDelete) {
      toast.error("Permission refusée : suppression opérateur");
      return;
    }
    if (!confirm("Voulez-vous vraiment supprimer cet opérateur ?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/operators/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur suppression");
      toast.success("Opérateur supprimé ✅");
      await loadOperators();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const resetPassword = async (id) => {
    if (!canReset) {
      toast.error("Permission refusée : réinitialisation mot de passe");
      return;
    }
    if (!confirm("Réinitialiser le mot de passe de cet opérateur ?")) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/operators/${id}/reset-password`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

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
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleInternal = async (op) => {
    if (!canToggleInternal) {
      toast.error("Permission refusée : mise à jour opérateur");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/operators/${op.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_internal: !op.is_internal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur mise à jour");
      toast.success(
        !op.is_internal
          ? "Opérateur promu interne ✅"
          : "Opérateur repassé en externe ✅"
      );
      await loadOperators();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleBlock = async (op, shouldBlock) => {
    if (!canUpdate) {
      toast.error("Permission refusée : mise à jour opérateur");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/operators/${op.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ dispo: shouldBlock ? 0 : 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur mise à jour");
      toast.success(shouldBlock ? "Opérateur bloqué ✅" : "Opérateur débloqué ✅");
      await loadOperators();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ✅ Blocage vue si pas la permission
  if (!canView) {
    return (
      <div
        className="p-6 rounded text-center"
        style={{ background: "var(--bg-card)", color: "var(--text-color)" }}
      >
        <h3 className="text-lg font-semibold text-[var(--accent)]">Accès restreint</h3>
        <p className="text-sm text-[var(--muted)] mt-1">
          Vous n’avez pas l’autorisation d’afficher les opérateurs (permission <code>operators_view</code>).
        </p>
      </div>
    );
  }

  return (
    <div
      className="p-4 rounded"
      style={{
        background: "var(--bg-card)",
        color: "var(--text-color)",
      }}
    >
      {loading && <p style={{ color: "var(--muted)" }}>⏳ Chargement...</p>}
      {!loading && error && (
        <div
          className="mb-4 p-3 rounded"
          style={{
            background: "#8b000055",
            color: "#ffaaaa",
            border: "1px solid var(--border-color)",
          }}
        >
          {error}
          <button
            onClick={loadOperators}
            className="ml-3 px-2 py-1 text-sm rounded"
            style={{
              background: "var(--accent)",
              color: "#fff",
            }}
          >
            Réessayer
          </button>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-color)" }}>
          <CheckBadgeIcon className="w-6 h-6" style={{ color: "var(--accent)" }} />
          Opérateurs
        </h2>
        {/* ✅ visible seulement si création autorisée */}
        {canCreate && (
          <button
            onClick={() => {
              setEditing(null);
              setForm({
                name: "",
                phone: "",
                email: "",
                ville: "",
                quartier: "",
                vehicle_type: "",
                is_available: true,
                lat: "",
                lng: "",
                is_internal: false,
              });
              setShowForm(true);
            }}
            className="px-4 py-2 rounded transition-all"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            + Ajouter un opérateur
          </button>
        )}
      </div>

      {/* Recherche */}
      <input
        type="text"
        placeholder="🔍 Rechercher..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full mb-4 p-2 rounded border"
        style={{
          background: "var(--bg-card)",
          color: "var(--text-color)",
          borderColor: "var(--border-color)",
        }}
      />

      {/* Tableau */}
      <table className="w-full text-sm text-left border-collapse">
        <thead
          style={{
            color: "var(--muted)",
            borderBottom: "1px solid var(--border-color)",
          }}
        >
          <tr>
            <th className="px-3 py-2">ID</th>
            <th className="px-3 py-2">Nom</th>
            <th className="px-3 py-2">Téléphone</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2 text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((o) => (
            <tr
              key={o.id}
              className="hover:opacity-95 cursor-pointer"
              style={{ borderTop: "1px solid var(--border-color)" }}
              onClick={() => setDetailOp(o)}
            >
              <td className="px-3 py-2">#{o.id}</td>
              <td className="px-3 py-2 flex items-center gap-2">
                {o.name}
                {Number(o.dispo) === 0 ? (
                  <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 border border-red-200">
                    <LockClosedIcon className="w-4 h-4" />
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2 font-semibold" style={{ color: "var(--text-color)" }}>
                 {o.phone}
              </td>
              <td
                className="px-3 py-2"
                style={{ color: o.email ? "var(--text-color)" : "var(--muted)" }}
              >
                {o.email || "—"}
              </td>
              <td className="px-3 py-2">
                {o.created_at ? new Date(o.created_at).toLocaleDateString() : "—"}
              </td>
              <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2 justify-center">
                  {/* Interne toggle */}
                  {canToggleInternal && (
                    <button
                      onClick={() => toggleInternal(o)}
                      className="p-2 rounded-full text-white shadow-md transition"
                      style={{ background: o.is_internal ? "#10b981" : "#9ca3af" }}
                      title={o.is_internal ? "Retirer interne" : "Promouvoir interne"}
                    >
                      <StarIcon className="w-5 h-5" />
                    </button>
                  )}
                  {(canUpdate || canDelete || canReset) && (
                    <div className="relative op-actions-menu">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === o.id ? null : o.id)}
                        className="p-2 rounded-full text-white shadow-md transition"
                        style={{ background: "var(--accent)" }}
                        title="Plus d'actions"
                      >
                        <EllipsisHorizontalIcon className="w-5 h-5" />
                      </button>
                      {openMenuId === o.id && (
                        <div
                          className="absolute right-0 mt-2 w-44 rounded shadow-lg border op-actions-menu"
                          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", zIndex: 10 }}
                        >
                          {canUpdate && (
                            <button
                              onClick={() => {
                                setEditing(o);
                                setForm({
                                  name: o.name || "",
                                  phone: o.phone || "",
                                  email: o.email || "",
                                  ville: o.ville || "",
                                  quartier: o.quartier || "",
                                  vehicle_type: o.vehicle_type || "",
                                  is_available:
                                    o.is_available !== undefined ? !!o.is_available : true,
                                  lat: o.lat ?? "",
                                  lng: o.lng ?? "",
                                  is_internal: !!o.is_internal,
                                });
                                setShowForm(true);
                                setOpenMenuId(null);
                              }}
                          className="flex w-full items-center gap-2 px-3 py-2 hover:bg-[var(--bg-main)]"
                          style={{ color: "var(--text-color)" }}
                        >
                          <PencilSquareIcon className="w-4 h-4 text-amber-500" />
                          Modifier
                        </button>
                      )}
                          {canUpdate && (
                            <button
                              onClick={() => {
                                toggleBlock(o, (o.dispo ?? 1) ? true : false);
                                setOpenMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 hover:bg-[var(--bg-main)]"
                              style={{ color: "var(--text-color)" }}
                            >
                              <NoSymbolIcon className="w-4 h-4 text-red-500" />
                              {o.dispo ? "Bloquer" : "Débloquer"}
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => {
                                deleteOperator(o.id);
                                setOpenMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 hover:bg-[var(--bg-main)]"
                              style={{ color: "var(--text-color)" }}
                            >
                              <TrashIcon className="w-4 h-4 text-red-500" />
                              Supprimer
                            </button>
                          )}
                          {canReset && (
                            <button
                              onClick={() => {
                                resetPassword(o.id);
                                setOpenMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 hover:bg-[var(--bg-main)]"
                              style={{ color: "var(--text-color)" }}
                            >
                              <KeyIcon className="w-4 h-4 text-blue-500" />
                              Réinitialiser
                            </button>
                          )}
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

      {filtered.length === 0 && !loading && (
        <p style={{ color: "var(--muted)", marginTop: "1rem" }}>
          Aucun opérateur trouvé.
        </p>
      )}

      {/* Modal */}
      {showForm && (
        <div
          className="fixed inset-0 flex justify-center items-center"
          style={{
            background: "rgba(0,0,0,0.6)",
            zIndex: 50,
          }}
        >
          <div
            className="p-6 rounded shadow w-96"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              border: "1px solid var(--border-color)",
            }}
          >
            <h3 className="text-lg font-bold mb-4">
              {editing ? "✏ Modifier opérateur" : "➕ Nouvel opérateur"}
            </h3>

            <input
              type="text"
              placeholder="Nom"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full mb-2 p-2 rounded border"
              style={{
                background: "var(--bg-card)",
                color: "var(--text-color)",
                borderColor: "var(--border-color)",
              }}
            />
            <input
              type="text"
              placeholder="Téléphone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full mb-2 p-2 rounded border"
              style={{
                background: "var(--bg-card)",
                color: "var(--text-color)",
                borderColor: "var(--border-color)",
              }}
            />
            <input
              type="email"
              placeholder="Email (optionnel)"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full mb-4 p-2 rounded border"
              style={{
                background: "var(--bg-card)",
                color: "var(--text-color)",
                borderColor: "var(--border-color)",
              }}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <input
            type="text"
            placeholder="Ville (optionnel)"
            value={form.ville}
            onChange={(e) => setForm({ ...form, ville: e.target.value })}
            className="w-full p-2 rounded border"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              borderColor: "var(--border-color)",
            }}
          />
          <input
            type="text"
            placeholder="Quartier (optionnel)"
            value={form.quartier}
            onChange={(e) => setForm({ ...form, quartier: e.target.value })}
            className="w-full p-2 rounded border"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              borderColor: "var(--border-color)",
            }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-[var(--muted)]">Type de véhicule</label>
            <select
              className="w-full p-2 rounded border"
              value={form.vehicle_type}
              onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
              style={{
                background: "var(--bg-card)",
                color: "var(--text-color)",
                borderColor: "var(--border-color)",
              }}
            >
              <option value="">— Optionnel —</option>
              {vehicleOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm mt-5 sm:mt-auto">
            <input
              type="checkbox"
              checked={form.is_available}
              onChange={(e) => setForm({ ...form, is_available: e.target.checked })}
            />
            <span>Disponible</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <input
            type="number"
            step="0.000001"
            placeholder="Latitude (optionnel)"
            value={form.lat}
            onChange={(e) => setForm({ ...form, lat: e.target.value })}
            className="w-full p-2 rounded border"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              borderColor: "var(--border-color)",
            }}
          />
          <input
            type="number"
            step="0.000001"
            placeholder="Longitude (optionnel)"
            value={form.lng}
            onChange={(e) => setForm({ ...form, lng: e.target.value })}
            className="w-full p-2 rounded border"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              borderColor: "var(--border-color)",
            }}
          />
        </div>

        <label className="flex items-center gap-2 text-sm mb-4">
          <input
            type="checkbox"
            checked={form.is_internal}
            onChange={(e) => setForm({ ...form, is_internal: e.target.checked })}
          />
          <span>
            Opérateur interne TTM
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <button
            onClick={() => setShowForm(false)}
            className="px-4 py-2 rounded"
            style={{
                  background: "transparent",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-color)",
                }}
              >
                Annuler
              </button>
              {/* ✅ bouton désactivé si pas la permission */}
              <button
                onClick={saveOperator}
                disabled={(editing && !canUpdate) || (!editing && !canCreate)}
                className="px-4 py-2 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: editing ? "#facc15" : "var(--accent)",
                }}
              >
                {editing ? "Mettre à jour" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailOp && (
        <div
          className="fixed inset-0 flex justify-center items-center"
          style={{ background: "rgba(0,0,0,0.55)", zIndex: 50 }}
          onClick={() => setDetailOp(null)}
        >
          <div
            className="rounded-xl shadow-xl w-full max-w-lg p-6 relative"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              border: "1px solid var(--border-color)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <CheckBadgeIcon className="w-6 h-6" style={{ color: "var(--accent)" }} />
              Profil opérateur
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <InfoCard label="Nom" value={detailOp.name} />
              <InfoCard label="Téléphone" value={detailOp.phone || "—"} accent />
              <InfoCard label="Email" value={detailOp.email || "—"} />
              <InfoCard label="Disponibilité" value={detailOp.dispo ? "Disponible" : "Indisponible"} badgeColor={detailOp.dispo ? "#10b981" : "#9ca3af"} />
              <InfoCard
                label="Créé le"
                value={
                  detailOp.created_at
                    ? new Date(detailOp.created_at).toLocaleDateString()
                    : "—"
                }
              />
              <InfoCard label="ID" value={`#${detailOp.id}`} />
              <InfoCard
                label="Type"
                value={detailOp.is_internal ? "TTM interne" : "Externe"}
                badgeColor={detailOp.is_internal ? "#0ea5e9" : "#9ca3af"}
              />
              <InfoCard label="Ville" value={detailOp.ville || "—"} />
              <InfoCard label="Quartier" value={detailOp.quartier || "—"} />
              <InfoCard label="Type de véhicule" value={detailOp.vehicle_type || "—"} />
              <InfoCard
                label="Coordonnées"
                value={
                  detailOp.lat != null && detailOp.lng != null
                    ? `${detailOp.lat}, ${detailOp.lng}`
                    : "—"
                }
              />
              <InfoCard
                label="Missions effectuées"
                value={
                  Number(detailOp.dispo) === 0
                    ? "Bloqué"
                    : (detailOp.missions_terminees ??
                      detailOp.completed_count ??
                      detailOp.total_done ??
                      detailOp.total_missions ??
                      "—")
                }
                accent
              />
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setDetailOp(null)}
                className="px-4 py-2 rounded"
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                }}
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

function InfoCard({ label, value, accent = false, badgeColor }) {
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
