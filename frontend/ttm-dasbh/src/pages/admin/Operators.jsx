import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import { API_BASE } from "../../config/urls";
import { ClipboardIcon } from "@heroicons/react/24/outline";
import "react-toastify/dist/ReactToastify.css";
import { PencilSquareIcon, TrashIcon, KeyIcon } from "@heroicons/react/24/solid";
import { can, isSuper } from "../../utils/rbac"; // ✅ RBAC

export default function Operators() {
  const { token, user } = useAuth(); // ✅ on récupère user
  const [operators, setOperators] = useState([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ✅ Permissions
  const canView   = isSuper(user) || can(user, "operators_view");
  const canCreate = isSuper(user) || can(user, "operators_create");
  const canUpdate = isSuper(user) || can(user, "operators_update");
  const canDelete = isSuper(user) || can(user, "operators_delete");
  const canReset  = isSuper(user) || can(user, "operators_reset_password");

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
          body: JSON.stringify(form),
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
          body: JSON.stringify({
            ...form,
            email: form.email || null,
          }),
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
      setForm({ name: "", phone: "", email: "" });
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
        <h2 className="text-xl font-bold">🚚 Opérateurs</h2>
        {/* ✅ visible seulement si création autorisée */}
        {canCreate && (
          <button
            onClick={() => {
              setEditing(null);
              setForm({ name: "", phone: "", email: "" });
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
              className="hover:opacity-80"
              style={{ borderTop: "1px solid var(--border-color)" }}
            >
              <td className="px-3 py-2">#{o.id}</td>
              <td className="px-3 py-2">{o.name}</td>
              <td className="px-3 py-2 font-semibold" style={{ color: "#f97316" }}>
                📞 {o.phone}
              </td>
              <td
                className="px-3 py-2"
                style={{ color: o.email ? "#60a5fa" : "var(--muted)" }}
              >
                {o.email || "—"}
              </td>
              <td className="px-3 py-2">
                {o.created_at ? new Date(o.created_at).toLocaleDateString() : "—"}
              </td>
              <td className="px-3 py-2 text-center">
                <div className="flex items-center gap-2 justify-center">
                  {/* Modifier */}
                  {canUpdate && (
                    <button
                      onClick={() => {
                        setEditing(o);
                        setForm({
                          name: o.name || "",
                          phone: o.phone || "",
                          email: o.email || "",
                        });
                        setShowForm(true);
                      }}
                      className="p-2 rounded-full text-white shadow-md transition"
                      style={{ background: "#facc15" }}
                      title="Modifier"
                    >
                      <PencilSquareIcon className="w-5 h-5" />
                    </button>
                  )}

                  {/* Supprimer */}
                  {canDelete && (
                    <button
                      onClick={() => deleteOperator(o.id)}
                      className="p-2 rounded-full text-white shadow-md transition"
                      style={{ background: "#e5372e" }}
                      title="Supprimer"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  )}

                  {/* Reset */}
                  {canReset && (
                    <button
                      onClick={() => resetPassword(o.id)}
                      className="p-2 rounded-full text-white shadow-md transition"
                      style={{ background: "var(--accent)" }}
                      title="Réinitialiser"
                    >
                      <KeyIcon className="w-5 h-5" />
                    </button>
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
    </div>
  );
}
