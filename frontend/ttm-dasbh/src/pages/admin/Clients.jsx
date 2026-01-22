import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import { API_BASE } from "../../config/urls";
import { ClipboardIcon, EllipsisHorizontalIcon } from "@heroicons/react/24/outline";
import "react-toastify/dist/ReactToastify.css";
import { PencilSquareIcon, TrashIcon, KeyIcon } from "@heroicons/react/24/solid";
import { can, isSuper } from "../../utils/rbac"; // ✅ RBAC
import { useModalOrigin } from "../../hooks/useModalOrigin";

export default function Clients() {
  const { token, user } = useAuth(); // ✅ on récupère user
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [closingConfirm, setClosingConfirm] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const clientModalRef = useModalOrigin(showForm);
  const confirmModalRef = useModalOrigin(!!confirmAction);

  useEffect(() => {
    const closeMenus = (e) => {
      if (!e.target.closest(".client-actions-menu")) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", closeMenus);
    return () => document.removeEventListener("mousedown", closeMenus);
  }, []);

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
      return false;
    }
    try {
      setConfirmLoading(true);
      const res = await fetch(`${API_BASE}/api/admin/clients/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur suppression");
      toast.success("Client supprimé ✅");
      await loadClients();
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    } finally {
      setConfirmLoading(false);
    }
  };

  // Réinitialiser mot de passe client
  const resetPassword = async (id) => {
    if (!canReset) {
      toast.error("Permission refusée : réinitialisation du mot de passe");
      return false;
    }
    try {
      setConfirmLoading(true);
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
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    } finally {
      setConfirmLoading(false);
    }
  };

  const openConfirm = (action, client) => {
    setClosingConfirm(false);
    setConfirmAction({ action, client });
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
              className="hover:opacity-90"
              style={{ borderTop: "1px solid var(--border-color)" }}
            >
              <td className="px-3 py-2">#{c.id}</td>
              <td className="px-3 py-2">{c.name}</td>
              <td
                className="px-3 py-2 font-semibold"
                style={{ color: "var(--text-color)" }}
              >
                 {c.phone}
              </td>
              <td
                className="px-3 py-2"
                style={{ color: c.email ? "var(--text-color)" : "var(--muted)" }}
              >
                {c.email || "—"}
              </td>
              <td className="px-3 py-2">
                {c.created_at
                  ? new Date(c.created_at).toLocaleDateString()
                  : "—"}
              </td>

              <td className="px-3 py-2 text-center">
                {(canUpdate || canDelete || canReset) && (
                  <div className="relative client-actions-menu inline-block">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                      className="p-2 rounded-full text-white shadow-md transition"
                      style={{ background: "var(--accent)" }}
                      title="Actions"
                    >
                      <EllipsisHorizontalIcon className="w-5 h-5" />
                    </button>
                    {openMenuId === c.id && (
                      <div
                        className="absolute right-0 mt-2 w-44 rounded shadow-lg border client-actions-menu"
                        style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", zIndex: 10 }}
                      >
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
                              setOpenMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 hover:bg-[var(--bg-main)]"
                            style={{ color: "var(--text-color)" }}
                          >
                            <PencilSquareIcon className="w-4 h-4 text-amber-500" />
                            Modifier
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => {
                              openConfirm("delete", c);
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
                              openConfirm("reset", c);
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
          className="fixed inset-0 flex justify-center items-center modal-backdrop"
          style={{
            background: "rgba(0,0,0,0.6)",
            zIndex: 50,
          }}
          onClick={() => setShowForm(false)}
        >
          <div
            ref={clientModalRef}
            className="p-6 rounded shadow w-96 modal-panel"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              border: "1px solid var(--border-color)",
            }}
            onClick={(e) => e.stopPropagation()}
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
      {confirmAction && (
        <div
          className={`fixed inset-0 flex justify-center items-center modal-backdrop ${closingConfirm ? "closing" : ""}`}
          style={{ background: "rgba(0,0,0,0.6)", zIndex: 60 }}
          onClick={() => {
            if (confirmLoading) return;
            setClosingConfirm(true);
            setTimeout(() => {
              setConfirmAction(null);
              setClosingConfirm(false);
            }, 180);
          }}
        >
          <div
            ref={confirmModalRef}
            className={`p-6 rounded shadow w-full max-w-md modal-panel ${closingConfirm ? "closing" : ""}`}
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              border: "1px solid var(--border-color)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-2">
              {confirmAction.action === "delete"
                ? "Supprimer le client"
                : "Réinitialiser le mot de passe"}
            </h3>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {confirmAction.action === "delete"
                ? "Supprimer définitivement"
                : "Réinitialiser le mot de passe de"}{" "}
              <span className="font-semibold" style={{ color: "var(--text-color)" }}>
                {confirmAction.client?.name || "ce client"}
              </span>
              ?
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  if (confirmLoading) return;
                  setClosingConfirm(true);
                  setTimeout(() => {
                    setConfirmAction(null);
                    setClosingConfirm(false);
                  }, 180);
                }}
                className="px-4 py-2 rounded"
                style={{
                  background: "transparent",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-color)",
                }}
                disabled={confirmLoading}
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  if (!confirmAction?.client) return;
                  const ok = confirmAction.action === "delete"
                    ? await deleteClient(confirmAction.client.id)
                    : await resetPassword(confirmAction.client.id);
                  if (ok) {
                    setClosingConfirm(true);
                    setTimeout(() => {
                      setConfirmAction(null);
                      setClosingConfirm(false);
                    }, 180);
                  }
                }}
                className="px-4 py-2 rounded text-white disabled:opacity-60 flex items-center gap-2"
                style={{
                  background: confirmAction.action === "delete" ? "#e5372e" : "var(--accent)",
                }}
                disabled={confirmLoading}
              >
                {confirmLoading ? "..." : confirmAction.action === "delete" ? "Supprimer" : "Réinitialiser"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
