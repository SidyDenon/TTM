import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { ADMIN_API } from "../../config/urls";
import { toast } from "react-toastify";
import { socket } from "../../utils/socket";
import { can, isSuper } from "../../utils/rbac"; // ✅ RBAC

export default function Transactions() {
  const { token, user } = useAuth();

  const [transactions, setTransactions] = useState([]);
  const [statusFilter, setStatusFilter] = useState("toutes");
  const [stats, setStats] = useState({
    total: 0,
    commission: 0,
    afterCommission: 0,
    total_confirme: 0,
    total_attente: 0,
    commissionPercent: 10,
  });

  const [loading, setLoading] = useState(true);

  // ✅ Permissions pour transactions uniquement
  const canTxView = isSuper(user) || can(user, "transactions_view");
  const canTxConfirm = isSuper(user) || can(user, "transactions_confirm");

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

  // --- CHARGEMENT TRANSACTIONS ---
  const loadTransactions = async () => {
    if (!canTxView) {
      setTransactions([]);
      setStats({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(ADMIN_API.transactions(statusFilter), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de chargement");

      setTransactions(data.data || []);
      setStats(
        (data.stats && Object.keys(data.stats).length
          ? data.stats
          : { commissionPercent: 10 }) || {}
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- CONFIRMER TRANSACTION ---
  const confirmTransaction = async (id) => {
    if (!canTxConfirm) {
      toast.error("Permission refusée : confirmation de transaction");
      return;
    }
    if (!confirm("Confirmer cette transaction ?")) return;

    try {
      const res = await fetch(ADMIN_API.transactionConfirm(id), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur confirmation");

      toast.success(`✅ Transaction #${id} validée et créditée avec succès`);
      await loadTransactions();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Demande permission notifications
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  // ✅ SOCKET TEMPS RÉEL (transactions seulement)
  useEffect(() => {
    if (!token) return;

    const handleNewTransaction = (data) => {
      console.log("🆕 Nouvelle transaction :", data);
      showSystemNotification(
        "🧾 Nouvelle transaction",
        `Mission #${data.request_id} terminée`
      );
      toast.info(`Nouvelle mission terminée (#${data.request_id})`);
      if (canTxView) loadTransactions();
    };

    const handleTransactionConfirmed = (data) => {
      console.log("💰 Transaction confirmée :", data);
      showSystemNotification("💰 Transaction confirmée", `Transaction #${data.id} validée`);
      toast.success(`✅ Transaction #${data.id} validée et créditée`);
      if (canTxView) loadTransactions();
    };

    const handleTransactionUpdated = (data) => {
      console.log("♻️ Transaction mise à jour:", data);
      if (canTxView) loadTransactions();
    };

    socket.on("transaction_created", handleNewTransaction);
    socket.on("transaction_confirmed", handleTransactionConfirmed);
    socket.on("transaction_updated", handleTransactionUpdated);

    return () => {
      socket.off("transaction_created", handleNewTransaction);
      socket.off("transaction_confirmed", handleTransactionConfirmed);
      socket.off("transaction_updated", handleTransactionUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, canTxView]);

  // Chargement initial + filtres
  useEffect(() => {
    if (!token) return;
    loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, statusFilter, canTxView]);

  // 🔒 Blocage d’accès si pas la permission
  if (!canTxView) {
    return <Unauthorized permKey="transactions_view" />;
  }

  return (
    <div
      className="p-4 rounded"
      style={{ background: "var(--bg-card)", color: "var(--text-color)" }}
    >
      {/* En-tête */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">💰 Transactions (missions)</h2>
        <div className="flex gap-3 items-center">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded border"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              borderColor: "var(--border-color)",
            }}
          >
            <option value="toutes">Toutes</option>
            <option value="en_attente">En attente</option>
            <option value="confirmée">Confirmées</option>
          </select>
          <button
            onClick={loadTransactions}
            className="px-4 py-2 rounded transition-all"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            🔄 Actualiser
          </button>
        </div>
      </div>

      {/* Totaux */}
      <div className="grid grid-cols-5 gap-4 mb-6 text-center">
        <Card title="Montant total" value={stats.total} color="var(--accent)" />
        <Card
          title={`Commission (${stats.commissionPercent ?? 10}%)`}
          value={stats.commission}
          color="#e5372e"
        />
        <Card
          title="Après commission"
          value={stats.afterCommission}
          color="green"
        />
        <Card
          title="Confirmées"
          value={stats.total_confirme}
          color="#facc15"
        />
        <Card
          title="En attente"
          value={stats.total_attente}
          color="orange"
        />
      </div>

      {/* Tableau transactions */}
      {loading ? (
        <p style={{ color: "var(--muted)" }}>⏳ Chargement...</p>
      ) : transactions.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>Aucune transaction trouvée.</p>
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
                <th className="px-3 py-2 text-left">Mission</th>
                <th className="px-3 py-2 text-left">Montant</th>
                <th className="px-3 py-2 text-left">Statut</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr
                  key={t.id}
                  className="hover:opacity-80"
                  style={{ borderTop: "1px solid var(--border-color)" }}
                >
                  <td className="px-3 py-2" style={{ opacity: 0.9 }}>
                    #{t.id}
                  </td>
                  <td className="px-3 py-2" style={{ color: "#60a5fa" }}>
                    {t.operator_name || "—"}
                  </td>
                  <td className="px-3 py-2" style={{ color: "#facc15" }}>
                    {t.request_id ? `#${t.request_id}` : "—"}
                  </td>
                  <td
                    className="px-3 py-2"
                    style={{ color: "#34d399", fontWeight: 600 }}
                  >
                    {Number(t.amount).toFixed(2)} {t.currency}
                  </td>
                  <td
                    className="px-3 py-2"
                    style={{
                      color:
                        t.status === "confirmée" ? "#34d399" : "#facc15",
                    }}
                  >
                    {t.status}
                  </td>
                  <td className="px-3 py-2">
                    {new Date(t.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {t.status === "en_attente" ? (
                      canTxConfirm ? (
                        <button
                          onClick={() => confirmTransaction(t.id)}
                          className="px-3 py-1 rounded text-sm transition-all"
                          style={{ background: "var(--accent)", color: "#fff" }}
                          title="Confirmer la transaction"
                        >
                          ✅ Confirmer
                        </button>
                      ) : (
                        <span
                          className="text-xs"
                          style={{ color: "var(--muted)" }}
                          title="Permission requise : transactions_confirm"
                        >
                          (aucune action)
                        </span>
                      )
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
        {Number(value || 0).toFixed(2)} FCFA
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

