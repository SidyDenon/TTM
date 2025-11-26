import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import { API_BASE } from "../../config/urls";
import { ClipboardIcon } from "@heroicons/react/24/outline";
import "react-toastify/dist/ReactToastify.css";
import { PencilSquareIcon, TrashIcon, KeyIcon } from "@heroicons/react/24/solid";
import { can, isSuper } from "../../utils/rbac"; // ✅ RBAC

export default function Clients() {
  const { token, user } = useAuth(); // ✅ on récupère user
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ✅ Permissions
  const canView   = isSuper(user) || can(user, "clients_view");
  const canCreate = isSuper(user) || can(user, "clients_create");
  const canUpdate = isSuper(user) || can(user, "clients_update");
  const canDelete = isSuper(user) || can(user, "clients_delete");
  const canReset  = isSuper(user) || can(user, "clients_reset_password");

  // Charger les clients
  const loadClients = async () => {
    if (!canView) return; // ✅ pas d’appel si pas le droit
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/clients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      if (!res.ok) {
        const msg = result?.error || `Erreur (${res.status})`;
        throw new Error(msg);
      }
      setClients(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      console.error("❌ Erreur chargement clients:", err);
      setError(err.message || "Erreur chargement clients");
      toast.error(err.message || "Erreur chargement clients");
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadClients();
  }, [token]);

  const filtered = clients.filter((c) =>
    (c?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  // Ajouter ou modifier client
  const saveClient = async () => {
    try {
      if (editing) {
        if (!canUpdate) {
          toast.error("Permission refusée : modification client");
          return;
        }
        const res = await fetch(`${API_BASE}/api/admin/clients/${editing.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur modification");
        toast.success("Client modifié ✅");
      } else {
        if (!canCreate) {
          toast.error("Permission refusée : création de client");
          return;
        }
        const res = await fetch(`${API_BASE}/api/admin/clients`, {
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
        if (!res.ok) throw new Error(data.error || "Erreur ajout client");

        const password = data.motDePasse || data.data?.motDePasse;

        toast.success(
          <div>
            <p>Client ajouté ✅</p>
            {password && (
              <p>
                🔑 Mot de passe : <b>{password}</b>
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

      await loadClients();
      setForm({ name: "", phone: "", email: "" });
      setEditing(null);
      setShowForm(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Supprimer client
  const deleteClient = async (id) => {
    if (!canDelete) {
      toast.error("Permission refusée : suppression client");
      return;
    }
    if (!confirm("Voulez-vous vraiment supprimer ce client ?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/clients/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur suppression");
      toast.success("Client supprimé ✅");
      await loadClients();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Réinitialiser mot de passe client
  const resetPassword = async (id) => {
    if (!canReset) {
      toast.error("Permission refusée : réinitialisation du mot de passe");
      return;
    }
    if (!confirm("Réinitialiser le mot de passe de ce client ?")) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/clients/${id}/reinitialiser-mdp`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur reset mot de passe");

      const password = data.password || data.data?.password;

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
          Vous n’avez pas l’autorisation d’afficher les clients (permission <code>clients_view</code>).
        </p>
      </div>
    );
  }

  return (
    <div
      className="p-4 rounded"
      style={{ background: "var(--bg-card)", color: "var(--text-color)" }}
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
            onClick={loadClients}
            className="ml-3 px-2 py-1 text-sm rounded"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Réessayer
          </button>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">👥 Clients</h2>

        {/* ✅ bouton visible seulement si création autorisée */}
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
            + Ajouter un client
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

      {/* Tableau clients */}
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
          {filtered.map((c) => (
            <tr
              key={c.id}
              className="hover:opacity-80"
              style={{ borderTop: "1px solid var(--border-color)" }}
            >
              <td className="px-3 py-2">#{c.id}</td>
              <td className="px-3 py-2">{c.name}</td>
              <td
                className="px-3 py-2 font-semibold"
                style={{ color: "#f97316" }}
              >
                📞 {c.phone}
              </td>
              <td
                className="px-3 py-2"
                style={{ color: c.email ? "#60a5fa" : "var(--muted)" }}
              >
                {c.email || "—"}
              </td>
              <td className="px-3 py-2">
                {c.created_at
                  ? new Date(c.created_at).toLocaleDateString()
                  : "—"}
              </td>

              <td className="px-3 py-2">
                <div className="flex items-center gap-3 justify-center">
                  {/* Modifier */}
                  {canUpdate && (
                    <button
                      onClick={() => {
                        setEditing(c);
                        setForm({
                          name: c.name || "",
                          phone: c.phone || "",
                          email: c.email || "",
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
                      onClick={() => deleteClient(c.id)}
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
                      onClick={() => resetPassword(c.id)}
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

      {filtered.length === 0 && (
        <p style={{ color: "var(--muted)", marginTop: "1rem" }}>
          Aucun client trouvé.
        </p>
      )}

      {/* Modal ajout/modif */}
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
              {editing ? "✏ Modifier client" : "➕ Nouveau client"}
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
              {/* ✅ bouton submit désactivé si pas la permission */}
              <button
                onClick={saveClient}
                disabled={(editing && !canUpdate) || (!editing && !canCreate)}
                className="px-4 py-2 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: editing ? "#facc15" : "var(--accent)",
                  color: "#fff",
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
