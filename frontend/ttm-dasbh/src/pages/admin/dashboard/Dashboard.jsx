import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import useRequireAuth from "../../../hooks/useRequireAuth";
import { useNavigate } from "react-router-dom";
import { ADMIN_API } from "../../../config/urls";
import { socket } from "../../../utils/socket";
import { can, canAny } from "../../../utils/rbac";
import { toast } from "react-toastify";

import DashboardStats from "./DashboardStats";
import DashboardMap from "./DashboardMap";
import DashboardTable from "./DashboardTable";
import DashboardDetailsModal from "./DashboardDetailsModal";
import FullscreenMapPortal from "./FullscreenMapPortal";
import DashboardChart from "./DashboardChart";

const fetchJsonSafe = async (res) => {
  if (!res) return null;
  try {
    const ct = res.headers?.get?.("content-type") || "";
    if (ct.includes("application/json")) {
      return await res.json();
    }
    const raw = await res.text();
    try {
      return JSON.parse(raw);
    } catch {
      return { __raw: raw };
    }
  } catch (err) {
    return { __error: err?.message || "parse_failed" };
  }
};

const formatHttpError = (res, fallback) => {
  if (!res) return fallback;
  const code = res.status ? ` (code ${res.status})` : "";
  const statusText = res.statusText ? ` – ${res.statusText}` : "";
  return `${fallback}${code}${statusText}`;
};

export default function Dashboard() {
  const user = useRequireAuth("admin");
  const { token } = useAuth();
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({});
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [selectedMission, setSelectedMission] = useState(null);
  const [errors, setErrors] = useState({ requests: null, stats: null }); // 👈 pour afficher les 403/erreurs
  const [operatorPositions, setOperatorPositions] = useState({}); // { [requestId]: { lat, lng, operatorId, timestamp } }
  const [monthFilter, setMonthFilter] = useState("all"); // "all" or "YYYY-MM"
  const lastToastRef = useRef(null);

  const showSystemNotification = useMemo(
    () => (title, body) => {
      if (typeof Notification !== "undefined" &&
          Notification.permission === "granted" &&
          document.visibilityState === "hidden") {
        new Notification(title, { body, icon: "/icon.png" });
      }
    }, []
  );

  const ONGOING_STATUSES = useMemo(
    () => new Set(["assignee", "acceptee", "en_route", "sur_place", "remorquage"]),
    []
  );
  const computeStatsFromRequests = useCallback(
    (list, prev = {}) => {
      const lower = (s) => String(s || "").toLowerCase();
      const totalLoaded = list.length;
      const ongoingLoaded = list.filter((r) => ONGOING_STATUSES.has(lower(r.status))).length;
      const doneLoaded = list.filter((r) => lower(r.status) === "terminee").length;
      const totalBaseline = Number(prev.totalMissions ?? 0);
      const ongoingBaseline = Number(prev.ongoing ?? 0);
      const doneBaseline = Number(prev.done ?? 0);
      const total = Math.max(totalLoaded, totalBaseline);
      const ongoing = Math.max(ongoingLoaded, ongoingBaseline);
      const done = Math.max(doneLoaded, doneBaseline);
      const satisfaction =
        total > 0 ? Math.round(((done > 0 ? done : 0) / total) * 100) : 0;

      return {
        avgTime: prev.avgTime ?? 0,
        satisfaction,
        totalMissions: total,
        ongoing,
        done,
        totalClients: prev.totalClients ?? 0,
        totalOperators: prev.totalOperators ?? 0,
      };
    },
    [ONGOING_STATUSES]
  );

  const updateRequestsState = useCallback(
    (updater) => {
      setRequests((prev) => {
        const next = updater(prev);
        if (!next || next === prev) return prev;
        setStats((s) => computeStatsFromRequests(next, { ...s }));
        return next;
      });
    },
    [computeStatsFromRequests]
  );

  const upsertMission = useCallback(
    (mission) => {
      if (!mission || !mission.id) return;
      const normalized = {
        ...mission,
        photos: Array.isArray(mission.photos) ? mission.photos : [],
      };
      updateRequestsState((prev) => {
        const idx = prev.findIndex((r) => Number(r.id) === Number(normalized.id));
        if (idx === -1) {
          return [normalized, ...prev];
        }
        const next = [...prev];
        next[idx] = { ...next[idx], ...normalized };
        return next;
      });
    },
    [updateRequestsState]
  );

  const removeMission = useCallback(
    (missionId) => {
      if (!missionId) return;
      updateRequestsState((prev) => {
        const next = prev.filter((r) => Number(r.id) !== Number(missionId));
        return next.length === prev.length ? prev : next;
      });
      setOperatorPositions((ops) => {
        const updated = { ...ops };
        delete updated[missionId];
        return updated;
      });
    },
    [updateRequestsState]
  );

  // ---------- Data Fetch ----------
 // remplace intégralement ta fonction fetchData par ceci
const fetchData = async (signal) => {
  if (!token) return;

  try {
    const reqUrl = ADMIN_API.requests("?limit=100");
    const statsUrl = ADMIN_API.dashboard();

    let reqRes = await fetch(reqUrl, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    if (reqRes.status === 401) {
      navigate("/login");
      return;
    }

    let reqJson = null;
    let reqError = null;
    if (reqRes.ok) {
      reqJson = await fetchJsonSafe(reqRes.clone());
    } else {
      reqError = formatHttpError(reqRes, "Impossible de charger les missions");
      const reqRes2 = await fetch(`${reqUrl}?compact=1`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (reqRes2.status === 401) {
        navigate("/login");
        return;
      }
      if (reqRes2.ok) {
        reqJson = await fetchJsonSafe(reqRes2.clone());
        reqError = null;
      } else {
        reqError = formatHttpError(reqRes2, "Impossible de charger les missions (compact)");
      }
    }

    const statsRes = await fetch(statsUrl, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    if (statsRes.status === 401) {
      navigate("/login");
      return;
    }
    let statsJson = null;
    let statsError = null;
    if (statsRes.ok) {
      statsJson = await fetchJsonSafe(statsRes.clone());
    } else {
      statsError = formatHttpError(statsRes, "Impossible de charger les statistiques");
    }

    setErrors((prev) => ({
      ...prev,
      requests: reqError,
      stats: statsError,
    }));

    const list = Array.isArray(reqJson?.data) ? reqJson.data : [];
    setRequests(list);

    const sd = statsJson?.data || {};
    const totals = sd.totals || {};
    const baseline = {
      avgTime: sd.avg_time ?? 0,
      totalMissions: Number(totals.total_requests ?? 0),
      ongoing: Number(totals.total_en_cours ?? 0),
      done: Number(totals.total_terminees ?? 0),
      totalClients: sd.clients_total ?? 0,
      totalOperators: sd.operateurs_total ?? 0,
    };

    setStats((prev) => computeStatsFromRequests(list, { ...baseline, ...prev }));
  } catch (err) {
    if (err?.name === "AbortError") return;
    console.error("Erreur dashboard:", err);
    const msg =
      err?.message?.toLowerCase?.().includes("session")
        ? "Session expirée, veuillez vous reconnecter."
        : "Erreur réseau inattendue. Vérifiez votre connexion puis réessayez.";
    // évite de spammer si la même erreur se répète
    if (lastToastRef.current !== msg) {
      lastToastRef.current = msg;
      toast.error(msg, { autoClose: 3500 });
    }
    if (err?.message?.toLowerCase?.().includes("session")) {
      navigate("/login");
    }
    setErrors((prev) => ({
      ...prev,
      requests: prev.requests || msg,
      stats: prev.stats || msg,
    }));
  }
};

  // ---------- WebSocket ----------
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    fetchData(controller.signal);

    const refresh = () => {
      const c = new AbortController();
      fetchData(c.signal);
    };

    const handleMissionCreated = (mission) => {
      if (!mission?.id) return;
      console.debug("[WS][admin] mission:created", mission.id, mission.status);
      showSystemNotification("🚨 Nouvelle mission", `Mission #${mission.id}`);
      upsertMission(mission);
    };

    const handleMissionUpdated = (mission) => {
      if (!mission?.id) return;
      const status = String(mission.status || "").toLowerCase();
      console.debug("[WS][admin] mission:updated", mission.id, status);
      showSystemNotification("🔄 Mission mise à jour", `Statut : ${mission.status}`);
      upsertMission(mission);
    };

    const handleMissionStatusChanged = (payload) => {
      const { id } = payload || {};
      if (!id) return;
      console.debug("[WS][admin] mission:status_changed", id, payload?.status);
      updateRequestsState((prev) => {
        const idx = prev.findIndex((r) => Number(r.id) === Number(id));
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], ...payload };
        return next;
      });
    };

    const handleMissionDeleted = (idOrObj) => {
      const id = typeof idOrObj === "object" ? idOrObj?.id : idOrObj;
      if (!id) return;
      console.debug("[WS][admin] mission:deleted", id);
      showSystemNotification("❌ Mission supprimée", `Mission #${id} retirée`);
      removeMission(id);
    };

    const handleOperatorPosition = (pos) => {
      if (!pos || !pos.requestId) return;
      setOperatorPositions((prev) => ({ ...prev, [pos.requestId]: pos }));
    };

    socket.on("mission:created", handleMissionCreated);
    socket.on("mission:updated", handleMissionUpdated);
    socket.on("mission:status_changed", handleMissionStatusChanged);
    socket.on("mission:deleted", handleMissionDeleted);
    socket.on("operator_position_update", handleOperatorPosition);
    socket.on("transaction_created", refresh);
    socket.on("transaction_updated", refresh);
    socket.on("transaction_confirmed", refresh);
    socket.on("withdrawal_updated_admin", refresh);
    socket.on("dashboard_update", refresh);

    return () => {
      controller.abort();
      socket.off("mission:created", handleMissionCreated);
      socket.off("mission:updated", handleMissionUpdated);
      socket.off("mission:status_changed", handleMissionStatusChanged);
      socket.off("mission:deleted", handleMissionDeleted);
      socket.off("operator_position_update", handleOperatorPosition);
      socket.off("transaction_created");
      socket.off("transaction_updated");
      socket.off("transaction_confirmed");
      socket.off("withdrawal_updated_admin");
      socket.off("dashboard_update");
    };
  }, [
    token,
    showSystemNotification,
    upsertMission,
    removeMission,
    updateRequestsState,
  ]);

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  if (!user) return null;

  return (
    <main
      className="flex-1 p-6 space-y-6 theme-fade"
      style={{ background: "var(--bg-main)", color: "var(--text-color)" }}
    >
      {/* 🧩 Statistiques principales */}
      {/* ⬇️ permission alignée avec backend: dashboard_view */}
      {canAny(user, ["dashboard_view", "stats_view"]) ? (
        <DashboardStats stats={stats} navigate={navigate} />
      ) : (
        errors.stats && <p className="text-sm text-[var(--muted)]">{errors.stats}</p>
      )}

      {/* 🗺️ Carte + Graphique */}
      {(!mapFullscreen && canAny(user, ["requests_view", "map_view"])) ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DashboardMap
            requests={requests}
            fetchData={() => fetchData()}
            setMapFullscreen={setMapFullscreen}
            setSelectedMission={setSelectedMission}
            operatorPositions={operatorPositions}
          />
          <div
            className="p-4 rounded-2xl shadow-md transition-all duration-300"
            style={{ background: "var(--bg-card)", color: "var(--text-color)" }}
          >
            <h3 className="font-semibold mb-3 text-[var(--accent)]">
              📊 Répartition des missions par type
            </h3>
            {requests.length > 0 ? (
              <DashboardChart requests={requests} />
            ) : (
              <p className="text-sm text-[var(--muted)] italic">Aucune donnée à afficher</p>
            )}
          </div>
        </div>
      ) : (
        !mapFullscreen && errors.requests && (
          <p className="text-sm text-[var(--muted)]">{errors.requests}</p>
        )
      )}

      {/* 📋 Tableau des missions */}
      {!mapFullscreen && can(user, "requests_view") && (
        <div className="space-y-3">
          {/* Filtre mois */}
          <div className="flex items-center gap-3">
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
            return (
              <option key={`${ym}-${i}`} value={ym}>{ym}</option>
            );
          })}
        </select>
      </div>
          <DashboardTable
            requests={requests.filter((r) => {
              if (monthFilter === 'all') return true;
              const when = r?.created_at
                ? new Date(r.created_at)
                : r?.published_at
                ? new Date(r.published_at)
                : null;
              if (!when || isNaN(when.getTime())) return false;
              const ym = `${when.getFullYear()}-${String(when.getMonth()+1).padStart(2,'0')}`;
              return ym === monthFilter;
            })}
            openMissionDetails={setSelectedMission}
          />
        </div>
      )}

      {/* 🗺️ Carte plein écran */}
      {mapFullscreen && (
        <FullscreenMapPortal
          requests={requests}
          onClose={() => setMapFullscreen(false)}
          onSelectMission={setSelectedMission}
        />
      )}

      {/* 🧾 Détails mission */}
      {selectedMission && (
        <DashboardDetailsModal
          mission={selectedMission}
          onClose={() => setSelectedMission(null)}
          navigate={navigate}
        />
      )}
    </main>
  );
}

