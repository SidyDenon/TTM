import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { ADMIN_API } from "../../config/urls";
import { toast } from "react-toastify";
import { socket } from "../../utils/socket";
import { can, isSuper } from "../../utils/rbac"; // ✅ RBAC

export default function Withdrawals() {
  const { token, user } = useAuth();

  // ✅ Permissions
  const canView = isSuper(user) || can(user, "withdrawals_view");
  const canApprove = isSuper(user) || can(user, "withdrawals_approve");
  const canReject = isSuper(user) || can(user, "withdrawals_reject");

  const [withdrawals, setWithdrawals] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("tous");

  const showSystemNotification = (title, body) => {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted" &&
      document.visibilityState === "hidden"
    ) {
      new Notification(title, {
        body,
        icon: "/icon.png",
      });
    }
  };

  const loadWithdrawals = async () => {
    if (!canView) {
      setWithdrawals([]);
      setStats({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(ADMIN_API.withdrawals(filter), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de chargement");

      setWithdrawals(data.data || []);
      setStats(data.stats || {});
    } catch (err) {
      toast.error(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const approve = async (id) => {
    if (!canApprove) {
      toast.error("Permission refusée : approbation de retrait");
      return;
    }
    if (!confirm("Confirmer l’approbation de ce retrait ?")) return;

    try {
      const res = await fetch(ADMIN_API.withdrawalStatus(id), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "approuvée" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l’approbation");

      toast.success(`✅ Retrait #${id} approuvé`);
      // 🔄 recharge la liste locale
      loadWithdrawals();
      // 👉 le sidebar mettra à jour son badge grâce au socket "withdrawal_updated_admin"
    } catch (err) {
      toast.error(`❌ ${err.message}`);
    }
  };

  const reject = async (id) => {
    if (!canReject) {
      toast.error("Permission refusée : rejet de retrait");
      return;
    }
    if (!confirm("Rejeter cette demande de retrait ?")) return;

    try {
      const res = await fetch(ADMIN_API.withdrawalStatus(id), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "rejetée" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors du rejet");

      toast.info(`⚠️ Retrait #${id} rejeté`);
      loadWithdrawals();
    } catch (err) {
      toast.error(`❌ ${err.message}`);
    }
  };

  // Autorisation notifications navigateur
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  // Chargement initial + sockets
  useEffect(() => {
    if (!token) return;
    loadWithdrawals();

    const onCreated = (data) => {
      toast.info(`🆕 Nouvelle demande de retrait (#${data.id})`);
      showSystemNotification(
        "💸 Nouveau retrait",
        `Montant : ${data.amount} ${data.currency || "FCFA"}`
      );

      setWithdrawals((prev) => {
        const exists = prev.some((w) => w.id === data.id);
        if (exists) return prev;
        return [
          {
            id: data.id,
            operator_name: data.operator_name || "—",
            amount: data.amount,
            currency: data.currency || "FCFA",
            method: data.method,
            phone: data.phone,
            status: data.status,
            created_at: data.created_at,
            updated_at: data.created_at,
          },
          ...prev,
        ];
      });

      if (canView) loadWithdrawals();
    };

    const onUpdated = (data) => {
      toast.info(`🔁 Retrait #${data.id} → ${data.status.toUpperCase()}`);
      showSystemNotification(
        "💸 Retrait mis à jour",
        `#${data.id} : ${data.status.toUpperCase()}`
      );

      setWithdrawals((prev) =>
        prev.map((w) =>
          w.id === data.id
            ? { ...w, status: data.status, updated_at: data.updated_at }
            : w
        )
      );

      if (canView) loadWithdrawals();
      // 👉 ici aussi, le sidebar reçoit l’event et met à jour le badge
    };

    socket.on("withdrawal_created", onCreated);
    socket.on("withdrawal_updated_admin", onUpdated);

    return () => {
      socket.off("withdrawal_created", onCreated);
      socket.off("withdrawal_updated_admin", onUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, canView]);

  // Reload quand le filtre change
  useEffect(() => {
    if (!token) return;
    loadWithdrawals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, token, canView]);

  // 🔒 Blocage si pas la permission
  if (!canView) {
    return <Unauthorized permKey="withdrawals_view" />;
  }

  // Nombre de retraits en attente dans cette liste (juste pour info UI)
  const pendingCount = withdrawals.filter((w) => w.status === "en_attente").length;

  return (
    <div
      className="p-6 rounded transition-all"
      style={{
        background: "var(--bg-card)",
        color: "var(--text-color)",
      }}
    >
      {/* En-tête */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold">💸 Demandes de retrait</h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {pendingCount > 0
              ? `${pendingCount} retrait(s) en attente`
              : "Aucun retrait en attente"}
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 rounded border"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              borderColor: "var(--border-color)",
            }}
          >
            <option value="tous">Tous</option>
            <option value="en_attente">En attente</option>
            <option value="approuvée">Approuvés</option>
            <option value="rejetée">Rejetés</option>
          </select>
          <button
            onClick={loadWithdrawals}
            className="px-4 py-2 rounded transition-all"
            style={{
              background: "var(--accent)",
              color: "#fff",
            }}
          >
            🔄 Actualiser
          </button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-3 gap-4 mb-6 text-center">
        <Card title="En attente" value={stats.total_attente} color="#facc15" />
        <Card title="Approuvés" value={stats.total_approuve} color="#22c55e" />
        <Card title="Rejetés" value={stats.total_rejete} color="#e5372e" />
      </div>

      {/* Tableau */}
      {loading ? (
        <p style={{ color: "var(--muted)" }}>⏳ Chargement...</p>
      ) : withdrawals.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>Aucune demande trouvée.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead
              style={{
                color: "var(--muted)",
                borderBottom: "1px solid var(--border-color)",
              }}
            >
              <tr>
                <th className="px-3 py-2 text-left">#ID</th>
                <th className="px-3 py-2 text-left">Opérateur</th>
                <th className="px-3 py-2 text-left">Montant</th>
                <th className="px-3 py-2 text-left">Méthode</th>
                <th className="px-3 py-2 text-left">Statut</th>
                <th className="px-3 py-2 text-left">Dernière mise à jour</th>
                <th className="px-3 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((w) => (
                <tr
                  key={w.id}
                  className="hover:opacity-80"
                  style={{ borderTop: "1px solid var(--border-color)" }}
                >
                  <td className="px-3 py-2">#{w.id}</td>
                  <td className="px-3 py-2" style={{ color: "#60a5fa" }}>
                    {w.operator_name || "—"}
                  </td>
                  <td className="px-3 py-2 font-semibold" style={{ color: "#22c55e" }}>
                    {Number(w.amount).toLocaleString("fr-FR")} {w.currency}
                  </td>
                  <td className="px-3 py-2">{w.method}</td>
                  <td
                    className="px-3 py-2"
                    style={{
                      color:
                        w.status === "approuvée"
                          ? "#22c55e"
                          : w.status === "rejetée"
                          ? "#ef4444"
                          : "#facc15",
                    }}
                  >
                    {w.status}
                  </td>
                  <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                    {new Date(w.updated_at || w.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {w.status === "en_attente" ? (
                      <div className="flex justify-center gap-2">
                        {canApprove && (
                          <button
                            onClick={() => approve(w.id)}
                            className="px-3 py-1 rounded text-sm transition-all"
                            style={{ background: "#22c55e", color: "#fff" }}
                            title="Approuver le retrait"
                          >
                            ✅ Approuver
                          </button>
                        )}
                        {canReject && (
                          <button
                            onClick={() => reject(w.id)}
                            className="px-3 py-1 rounded text-sm transition-all"
                            style={{ background: "#e5372e", color: "#fff" }}
                            title="Rejeter le retrait"
                          >
                            ❌ Rejeter
                          </button>
                        )}
                        {!canApprove && !canReject && (
                          <span className="text-xs" style={{ color: "var(--muted)" }}>
                            (aucune action)
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--muted)" }}>
                        —
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Card({ title, value, color }) {
  return (
    <div
      className="p-4 rounded"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        color: "var(--text-color)",
      }}
    >
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        {title}
      </p>
      <h2 className="text-2xl font-bold" style={{ color }}>
        {Number(value || 0).toLocaleString("fr-FR")} FCFA
      </h2>
    </div>
  );
}

function Unauthorized({ permKey }) {
  return (
    <div
      className="p-6 rounded text-center"
      style={{ background: "var(--bg-card)", color: "var(--text-color)" }}
    >
      <h3 className="text-lg font-semibold text-[var(--accent)]">Accès restreint</h3>
      <p className="text-sm text-[var(--muted)] mt-1">
        Vous n’avez pas l’autorisation d’afficher cette section (permission{" "}
        <code>{permKey}</code>).
      </p>
    </div>
  );
}

