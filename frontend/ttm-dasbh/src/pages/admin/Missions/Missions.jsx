import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "react-toastify";
import { API_BASE } from "../../../config/urls";
import "react-toastify/dist/ReactToastify.css";

import MissionsTable from "./MissionsTable";
import MissionsDetailsModal from "./MissionsDetailsModal";
import MissionsPublishModal from "./MissionsPublishModal";
import MissionsAssignModal from "./MissionsAssignModal";

import { can, canAny, isSuper } from "../../../utils/rbac";

export default function Missions() {
  const { token, user } = useAuth();

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
  const [statusFilter, setStatusFilter] = useState("all");
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

  useEffect(() => {
    if (token) loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, canView]);

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
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <label className="text-sm text-[var(--muted)]">Statut:</label>
        <select
          className="px-2 py-1 rounded border"
          style={{ background: "var(--bg-card)", color: "var(--text-color)", borderColor: "var(--border-color)" }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Tous</option>
          <option value="publiee">publiée</option>
          <option value="acceptee">acceptée</option>
          <option value="assignee">assignée</option>
          <option value="en_route">en route</option>
          <option value="sur_place">sur place</option>
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

      <MissionsTable
        requests={requests.filter((r) => {
          // Filtre mois
          if (monthFilter !== 'all') {
            const when = r?.created_at ? new Date(r.created_at) : null;
            if (!when || isNaN(when.getTime())) return false;
            const ym = `${when.getFullYear()}-${String(when.getMonth()+1).padStart(2,'0')}`;
            if (ym !== monthFilter) return false;
          }
          // Filtre statut
          if (statusFilter !== 'all') {
            if (String(r?.status || '').toLowerCase() !== statusFilter) return false;
          }
          // Recherche ID
          if (normalizedId) {
            if (Number(r?.id) !== Number(normalizedId)) return false;
          }
          return true;
        })}
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
