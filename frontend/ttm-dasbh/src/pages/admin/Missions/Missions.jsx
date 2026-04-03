import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "../../../utils/toast";
import { API_BASE } from "../../../config/urls";
import { ArrowPathIcon, PrinterIcon } from "@heroicons/react/24/outline";
import "react-toastify/dist/ReactToastify.css";

import MissionsTable from "./MissionsTable";
import MissionsDetailsModal from "./MissionsDetailsModal";
import MissionsPublishModal from "./MissionsPublishModal";
import MissionsAssignModal from "./MissionsAssignModal";

import { can, canAny, isSuper } from "../../../utils/rbac";

const STATUS_OPTIONS = [
  "all",
  "ongoing",
  "publiee",
  "acceptee",
  "assignee",
  "en_route",
  "sur_place",
  "remorquage",
  "terminee",
  "annulee_admin",
  "annulee_client",
];
const ONGOING_STATUSES = new Set([
  "assignee",
  "acceptee",
  "en_route",
  "sur_place",
  "remorquage",
]);

export default function Missions() {
  const { token, user } = useAuth();
  const location = useLocation();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedMission, setSelectedMission] = useState(null);
  const [publishModal, setPublishModal] = useState(null); // mission objet
  const [assignModal, setAssignModal] = useState(null); // mission objet
  const [operators, setOperators] = useState([]);
  const [monthFilter, setMonthFilter] = useState("all"); // YYYY-MM or "all"

  const [price, setPrice] = useState("");
  const [distance, setDistance] = useState("");
  const [statusFilter, setStatusFilter] = useState(() => {
    const params = new URLSearchParams(location.search);
    const fromUrl = String(params.get("status") || "").toLowerCase();
    return STATUS_OPTIONS.includes(fromUrl) ? fromUrl : "all";
  });
  const [idSearch, setIdSearch] = useState("");
  const normalizedId = idSearch.replace(/[^0-9]/g, "");

  // ---------- RBAC helpers ----------
  const missionViewPerms = [
    "requests_view",
    "requests_publish",
    "requests_assign",
    "requests_cancel",
    "requests_complete",
    "requests_delete",
  ];
  const canView = canAny(user, missionViewPerms);
  const canPublish = isSuper(user) || can(user, "requests_publish");
  const canAssign  = isSuper(user) || can(user, "requests_assign");
  const canCancel  = isSuper(user) || can(user, "requests_cancel");
  const canComplete= isSuper(user) || can(user, "requests_complete");
  const canDelete  = isSuper(user) || can(user, "requests_delete");

  // ---------- Data ----------
  const loadRequests = async () => {
    if (!canView) {
      setLoading(false);
      setError("Accès refusé : vous n’avez pas la permission de voir les missions.");
      return;
    }
    setLoading(true);
    try {
      // récupère toutes les missions (limite gérée côté backend)
      const res = await fetch(`${API_BASE}/api/admin/requests?limit=all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      if (!res.ok) {
        // Si le back renvoie 403, on affiche un message RBAC
        if (res.status === 403) {
          throw new Error(result?.error || "Accès restreint (RBAC)");
        }
        throw new Error(result?.error || "Erreur serveur");
      }
      setRequests(result.data || []);
      setError("");
    } catch (err) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Actions protégées RBAC ----------
  const publishRequest = async (mission, price, distance) => {
    if (!canPublish) {
      toast.error("Permission insuffisante : publier une mission");
      return;
    }
    try {
      const isTowing =
        typeof mission?.service === "string" &&
        mission.service.toLowerCase().includes("remorqu");
      const safeDistance = isTowing
        ? Math.min(Number(distance) || 0, 100)
        : Number(distance);

      const payload = { price: Number(price), distance: safeDistance };
      const res = await fetch(`${API_BASE}/api/admin/requests/${mission.id}/publier`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec publication");
      toast.success(`Mission #${mission.id} publiée ✅`);
      await loadRequests();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const loadOperators = async () => {
    if (!canAssign) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/operators`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Impossible de charger les opérateurs");
      setOperators(json.data || []);
    } catch (err) {
      console.error("❌ loadOperators:", err);
      toast.error(err.message);
    }
  };

  const assignRequest = async (mission, operatorId) => {
    if (!canAssign) {
      toast.error("Permission insuffisante : assigner une mission");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/requests/${mission.id}/assigner`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ operator_id: operatorId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec assignation");
      toast.success(`Mission #${mission.id} assignée ✅`);
      await loadRequests();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const updateStatus = async (id, status) => {
    // Map statut -> permission requise
    const needPerm =
      status === "assignee" ? canAssign
      : status === "terminee" ? canComplete
      : status === "annulee_admin" ? canCancel
      : true; // fallback (au cas où)

    if (!needPerm) {
      toast.error("Permission insuffisante pour cette action");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/requests/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec mise à jour");
      toast.success(`Mission #${id} → ${status}`);
      await loadRequests();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const deleteMission = async (id) => {
    if (!canDelete) {
      toast.error("Permission insuffisante : supprimer une mission");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/requests/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec suppression");
      toast.success(`Mission #${id} supprimée ✅`);
      await loadRequests();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (monthFilter !== "all") {
      const when = r?.created_at ? new Date(r.created_at) : null;
      if (!when || Number.isNaN(when.getTime())) return false;
      const ym = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}`;
      if (ym !== monthFilter) return false;
    }

    if (statusFilter !== "all") {
      const currentStatus = String(r?.status || "").toLowerCase();
      if (statusFilter === "ongoing") {
        if (!ONGOING_STATUSES.has(currentStatus)) return false;
      } else if (currentStatus !== statusFilter) {
        return false;
      }
    }

    if (normalizedId) {
      if (Number(r?.id) !== Number(normalizedId)) return false;
    }

    return true;
  });

  const printTable = () => {
    const win = window.open("", "_blank");
    if (!win) return;

    const rowsHtml = filteredRequests
      .map(
        (r) => `
          <tr>
            <td>#${r.id}</td>
            <td>${r.operator_name || "—"}</td>
            <td>${r.user_name || "—"}</td>
            <td>${r.user_phone || "—"}</td>
            <td>${r.address || "—"}</td>
            <td>${r.service || "—"}</td>
            <td>${r.status || "—"}</td>
            <td>${r.created_at ? new Date(r.created_at).toLocaleString("fr-FR") : "—"}</td>
          </tr>`
      )
      .join("");

    win.document.write(`
      <html>
        <head>
          <title>Rapport missions</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            th { background: #f5f5f5; }
          </style>
        </head>
        <body>
          <h2>Rapport missions Tow Truck Mali</h2>
          <p><strong>Mois :</strong> ${monthFilter === "all" ? "Tous" : monthFilter}</p>
          <p><strong>Statut :</strong> ${statusFilter}</p>
          <table>
            <thead>
              <tr>
                <th>#ID</th><th>Opérateur</th><th>Client</th><th>Téléphone</th><th>Adresse</th><th>Service</th><th>Statut</th><th>Date</th>
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

  useEffect(() => {
    if (token) loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, canView]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fromUrl = String(params.get("status") || "").toLowerCase();
    if (STATUS_OPTIONS.includes(fromUrl) && fromUrl !== statusFilter) {
      setStatusFilter(fromUrl);
    }
  }, [location.search, statusFilter]);

  useEffect(() => {
    if (token && canAssign) loadOperators();
  }, [token, canAssign]);

  // ---------- UI ----------
  if (!canView) {
    return (
      <div
        className="p-6 rounded shadow"
        style={{ background: "var(--bg-card)", color: "var(--text-color)" }}
      >
        <h2 className="text-lg font-semibold text-[var(--accent)]">🚫 Accès restreint</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Vous n’avez pas la permission d’afficher les missions.
        </p>
      </div>
    );
  }

  if (loading) return <p className="p-4">⏳ Chargement...</p>;

  if (error)
    return (
      <div
        className="p-4 rounded"
        style={{ background: "var(--bg-card)", color: "var(--text-color)" }}
      >
        ❌ {error}
        <button
          onClick={loadRequests}
          className="ml-4 px-3 py-1 bg-[var(--accent)] text-white rounded hover:opacity-90"
        >
          Réessayer
        </button>
      </div>
    );

  return (
    <div
      className="p-6 rounded shadow"
      style={{ background: "var(--bg-card)", color: "var(--text-color)" }}
    >
      <h2 className="text-xl font-bold mb-4 text-[var(--accent)] font-poppins">
         Liste des missions
      </h2>

      {/* Filtre Mois */}
      <div className="flex items-center gap-3 mb-3">
        <label className="text-sm text-[var(--muted)]">Mois:</label>
        <select
          className="px-2 py-1 rounded border"
          style={{ background: "var(--bg-card)", color: "var(--text-color)", borderColor: "var(--border-color)" }}
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
        >
          <option value="all">Tous</option>
          {Array.from({ length: 12 }).map((_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const key = `${ym}-${i}`;
            return (
              <option key={key} value={ym}>{ym}</option>
            );
          })}
        </select>
      </div>

      {/* Filtres supplémentaires */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-[var(--muted)]">Statut:</label>
          <select
            className="px-2 py-1 rounded border"
            style={{ background: "var(--bg-card)", color: "var(--text-color)", borderColor: "var(--border-color)" }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Tous</option>
            <option value="ongoing">en cours</option>
            <option value="publiee">publiée</option>
            <option value="acceptee">acceptée</option>
            <option value="assignee">assignée</option>
            <option value="en_route">en route</option>
            <option value="sur_place">sur place</option>
            <option value="remorquage">remorquage</option>
            <option value="terminee">terminée</option>
            <option value="annulee_admin">annulée admin</option>
            <option value="annulee_client">annulée client</option>
          </select>

          <label className="text-sm text-[var(--muted)]">Recherche ID:</label>
          <input
            type="text"
            placeholder="#id"
            value={idSearch}
            onChange={(e) => setIdSearch(e.target.value)}
            className="px-2 py-1 rounded border"
            style={{ background: "var(--bg-card)", color: "var(--text-color)", borderColor: "var(--border-color)", width: 120 }}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadRequests}
            className="px-4 py-2 rounded-lg transition-all flex items-center gap-2 shadow-sm"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            <ArrowPathIcon className="w-5 h-5" />
            Actualiser
          </button>
          <button
            onClick={printTable}
            className="px-3 py-2 rounded-lg transition-all flex items-center gap-2 border shadow-sm"
            style={{ background: "var(--bg-card)", color: "var(--text-color)", border: "1px solid var(--border-color)" }}
            title="Imprimer le rapport"
          >
            <PrinterIcon className="w-5 h-5" />
            Imprimer
          </button>
        </div>
      </div>

      <MissionsTable
        requests={filteredRequests}
        onSelect={setSelectedMission}
        onUpdateStatus={updateStatus}
        onDelete={deleteMission}
        // On ouvre le modal de publication seulement si autorisé
        onPublish={(mission) => {
          if (!canPublish) {
            toast.error("Permission insuffisante : publier une mission");
            return;
          }
          setPublishModal(mission);
        }}
      />

      {selectedMission && (
        <MissionsDetailsModal
          mission={selectedMission}
          onClose={() => setSelectedMission(null)}
          onUpdateStatus={updateStatus}  // les permissions sont re-vérifiées dedans
          onDelete={deleteMission}       // idem
          onPublish={(mission) => {
            if (!canPublish) {
              toast.error("Permission insuffisante : publier une mission");
              return;
            }
            setPublishModal(mission);
          }}
          onAssign={(mission) => {
            if (!canAssign) {
              toast.error("Permission insuffisante : assigner une mission");
              return;
            }
            setAssignModal(mission);
          }}
        />
      )}

      {publishModal && (
        <MissionsPublishModal
          mission={publishModal}
          price={price}
          setPrice={setPrice}
          distance={distance}
          setDistance={setDistance}
          onClose={() => setPublishModal(null)}
          onConfirm={publishRequest} // recheck des perms dans publishRequest
        />
      )}

      {assignModal && (
        <MissionsAssignModal
          mission={assignModal}
          operators={operators}
          onClose={() => setAssignModal(null)}
          onAssign={assignRequest}
        />
      )}
    </div>
  );
}
