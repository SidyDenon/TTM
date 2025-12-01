import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { ADMIN_API } from "../../config/urls";
import { toast } from "react-toastify";
import { socket } from "../../utils/socket";
import { can, isSuper } from "../../utils/rbac"; // ✅ RBAC
import { ArrowPathIcon, CheckCircleIcon, PrinterIcon } from "@heroicons/react/24/outline";

export default function Transactions() {
  const { token, user } = useAuth();

  const [transactions, setTransactions] = useState([]);
  const [statusFilter, setStatusFilter] = useState("toutes");
  const [monthFilter, setMonthFilter] = useState("all");
  const [stats, setStats] = useState({
    total: 0,
    commission: 0,
    afterCommission: 0,
    total_confirme: 0,
    total_attente: 0,
    commissionPercent: 10,
  });

  const [loading, setLoading] = useState(true);

  // Permissions pour transactions uniquement
  const canTxView = isSuper(user) || can(user, "transactions_view");
  const canTxConfirm = isSuper(user) || can(user, "transactions_confirm");

  const formatAmount = (v = 0) =>
    Number(v || 0).toLocaleString("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

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

  // CHARGEMENT TRANSACTIONS 
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

  // CONFIRMER TRANSACTION
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
  }, [token, canTxView]);

  useEffect(() => {
    if (!token) return;
    loadTransactions();
  }, [token, statusFilter, canTxView]);

  const filteredTransactions =
    monthFilter === "all"
      ? transactions
      : transactions.filter((t) => {
          if (!t?.created_at) return false;
          const d = new Date(t.created_at);
          if (Number.isNaN(d.getTime())) return false;
          const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          return ym === monthFilter;
        });

  const currentMonthKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  const currentMonthTotal = transactions.reduce((sum, t) => {
    if (!t?.created_at) return sum;
    const d = new Date(t.created_at);
    if (Number.isNaN(d.getTime())) return sum;
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return ym === currentMonthKey ? sum + Number(t.amount || 0) : sum;
  }, 0);

  const printTable = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const filteredSum = filteredTransactions.reduce((acc, t) => acc + Number(t.amount || 0), 0);
    const monthLabel = monthFilter === "all" ? "Tous les mois" : monthFilter;
    const rowsHtml = filteredTransactions
      .map(
        (t) => `
          <tr>
            <td>#${t.id}</td>
            <td>${t.operator_name || "—"}</td>
            <td>${t.request_id ? `#${t.request_id}` : "—"}</td>
            <td>${formatAmount(t.amount)} ${t.currency || ""}</td>
            <td>${t.status || ""}</td>
            <td>${t.created_at ? new Date(t.created_at).toLocaleString() : ""}</td>
          </tr>`
      )
      .join("");
    win.document.write(`
      <html>
        <head>
          <title>Rapport transactions ttm</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            th { background: #f5f5f5; }
          </style>
        </head>
        <body>
          <h2>Rapport transactions Tow Truck Mali</h2>
          <p><strong>Mois :</strong> ${monthLabel}</p>
          <p><strong>Total filtré :</strong> ${formatAmount(filteredSum)} FCFA</p>
          <table>
            <thead>
              <tr>
                <th>#ID</th><th>Opérateur</th><th>Mission</th><th>Montant</th><th>Statut</th><th>Date</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  //  Blocage d’accès si pas la permission
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
        <h2 className="text-xl font-bold"> Transactions </h2>
        <div className="flex gap-3 items-center">
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="px-3 py-2 rounded border"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-color)",
              borderColor: "var(--border-color)",
            }}
          >
            <option value="all">Tous les mois</option>
            {Array.from({ length: 12 }).map((_, i) => {
              const d = new Date();
              d.setMonth(d.getMonth() - i);
              const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
              return (
                <option key={`${ym}-${i}`} value={ym}>
                  {ym}
                </option>
              );
            })}
          </select>
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
            className="px-4 py-2 rounded transition-all flex items-center gap-2"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            <ArrowPathIcon className="w-5 h-5" />
            Actualiser
          </button>
          <button
            onClick={printTable}
            className="px-3 py-2 rounded transition-all flex items-center gap-2"
            style={{ background: "var(--bg-card)", color: "var(--text-color)", border: "1px solid var(--border-color)" }}
            title="Imprimer le rapport"
          >
            <PrinterIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Bloc wallet*/}
      <div className="flex flex-col gap-4 mb-6">
        <div
          className="p-6 rounded-2xl shadow-lg flex-1"
          style={{
            background: "linear-gradient(135deg, rgba(128,128,128,0.12), rgba(0,0,0,0.08))",
            border: "1px solid var(--border-color)",
            color: "var(--text-color)",
          }}
        >
          <div className="flex flex-col gap-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide tex" style={{ color: "var(--muted)", textAlign:"center" }}>
                Montant total
              </p>
              <div className="text-5xl font-bold pt-4" style={{ color: "var(--text-color)", textAlign:"center" }}>
                {formatAmount(stats.total)} FCFA
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm font-medium">
              <div>
                <p className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                  Commission
                </p>
                <p style={{ color: "var(--text-color)" }} className="text-xl">
                  {formatAmount(stats.commission)} FCFA
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                  Mois en cours
                </p>
                <p style={{ color: "var(--text-color)" }} className="text-xl">
                  {formatAmount(currentMonthTotal)} FCFA
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                  En attente
                </p>
                <p style={{ color: "#e5372e" }} className="text-xl font-bold">
                  {formatAmount(stats.total_attente)} FCFA
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                  Après commission
                </p>
                <p style={{ color: "var(--text-color)"}} className="text-xl">
                  {formatAmount(stats.afterCommission)} FCFA
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tableau transactions */}
      {loading ? (
        <p style={{ color: "var(--muted)" }}>⏳ Chargement...</p>
      ) : transactions.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>Aucune transaction trouvée.</p>
      ) : (
        <div
          className="overflow-x-auto"
          style={{
            marginTop: "24px",
            maxHeight: "calc(100vh - 420px)",
            overflowY: "auto",
          }}
        >
          <table className="w-full text-sm border-collapse">
            <thead
              style={{
                color: "var(--muted)",
                borderBottom: "1px solid var(--border-color)",
                position: "sticky",
                top: 0,
                zIndex: 5,
                background: "var(--bg-card)",
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
              {filteredTransactions.map((t) => (
                <tr
                  key={t.id}
                  className="hover:opacity-80"
                  style={{ borderTop: "1px solid var(--border-color)" }}
                >
                  <td className="px-3 py-2" style={{ opacity: 0.9 }}>
                    #{t.id}
                  </td>
                  <td className="px-3 py-2" style={{ color: "var(--text-color)" }}>
                    {t.operator_name || "—"}
                  </td>
                  <td className="px-3 py-2" style={{ color: "var(--text-color)" }}>
                    {t.request_id ? `#${t.request_id}` : "—"}
                  </td>
                  <td
                    className="px-3 py-2"
                    style={{ color: "var(--text-color)", fontWeight: 600 }}
                  >
                    {formatAmount(t.amount)} {t.currency}
                  </td>
                  <td
                    className="px-3 py-2"
                    style={{
                      color: t.status === "confirmée" ? "#16a34a" : "var(--muted)",
                      fontWeight: t.status === "confirmée" ? 600 : 500,
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
                          className="px-3 py-1 rounded text-sm transition-all flex items-center gap-1"
                          style={{ background: "var(--accent)", color: "#fff" }}
                          title="Confirmer la transaction"
                        >
                          <CheckCircleIcon className="w-4 h-4" />
                          Confirmer
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

function StatCard({ title, value, color }) {
  return (
    <div
      className="p-4 rounded-xl shadow-sm text-center"
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
        {value}
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

