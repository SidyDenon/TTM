import { useEffect, useState } from "react";
import {
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  StarIcon,
  UserGroupIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../../context/AuthContext";
import { can, isSuper } from "../../../utils/rbac";

export default function DashboardStats({ stats, navigate }) {
  const { user } = useAuth();

  const [prevStats, setPrevStats] = useState(stats);
  const [animatedStats, setAnimatedStats] = useState(stats);
  const [changedKeys, setChangedKeys] = useState([]);

  useEffect(() => {
    if (!stats) return;
    const changed = Object.keys(stats).filter(
      (key) => stats[key] !== prevStats[key]
    );
    if (changed.length > 0) {
      setChangedKeys(changed);
      setTimeout(() => setChangedKeys([]), 600);
      setAnimatedStats(stats);
      setPrevStats(stats);
    }
  }, [stats, prevStats]);

  // 🧱 Définition des cartes + permissions associées
  const cards = [
    {
      icon: ExclamationTriangleIcon,
      label: "Missions totales",
      key: "totalMissions",
      color: "#E5372E",
      path: "/dashboard/missions",
      perm: "requests_view",
    },
    {
      icon: ClockIcon,
      label: "Missions en cours",
      key: "ongoing",
      color: "#fb923c",
      perm: "requests_view",
    },
    {
      icon: CheckCircleIcon,
      label: "Missions terminées",
      key: "done",
      color: "#22c55e",
      perm: "requests_view",
    },
    {
      icon: ClockIcon,
      label: "Temps moyen",
      key: "avgTime",
      color: "#eab308",
      perm: "stats_view",
    },
    {
      icon: StarIcon,
      label: "Satisfaction",
      key: "satisfaction",
      color: "#E5372E",
      perm: "stats_view",
    },
    {
      icon: UserGroupIcon,
      label: "Clients inscrits",
      key: "totalClients",
      color: "#3b82f6",
      path: "/dashboard/clients",
      perm: "clients_view",
    },
    {
      icon: TruckIcon,
      label: "Opérateurs",
      key: "totalOperators",
      color: "#06b6d4",
      path: "/dashboard/operators",
      perm: "operators_view",
    },
  ];

  // 🔒 Filtrage RBAC
  const visibleCards = cards.filter(
    (card) => isSuper(user) || can(user, card.perm)
  );

  if (visibleCards.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--muted)] italic">
        🔒 Aucune statistique visible pour votre rôle
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
      {visibleCards.map(({ icon: Icon, label, key, color, path }, i) => (
        <div
          key={i}
          onClick={() => path && navigate(path)}
          className={`p-4 rounded-xl shadow-md flex flex-col items-center text-center select-none transition-all duration-300 hover:scale-105 cursor-pointer border border-[var(--border-color)] ${
            changedKeys.includes(key)
              ? "ring-2 ring-[var(--accent)] shadow-lg"
              : ""
          }`}
          style={{
            background: "var(--bg-card)",
            color: "var(--text-color)",
          }}
        >
          <Icon className="w-7 h-7 mb-2" style={{ color }} />
          <p className="text-sm font-medium text-[var(--muted)]">{label}</p>
          <h2
            className={`text-2xl font-bold transition-all duration-500 ease-out`}
            style={{ color }}
          >
            {animatedStats[key] ?? 0}
            {key === "avgTime" ? " min" : ""}
          </h2>
        </div>
      ))}
    </div>
  );
}
