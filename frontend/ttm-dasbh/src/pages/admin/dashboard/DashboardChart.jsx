import { useEffect, useMemo, useRef, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { can, isSuper } from "../../../utils/rbac"; // ✅ RBAC intégré
import { useAuth } from "../../../context/AuthContext";

export default function DashboardChart({ requests }) {
  const { user } = useAuth();

  // 🔒 Si l’admin n’a pas la permission de voir les stats
  if (!isSuper(user) && !can(user, "chart_view")) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--muted)] italic">
        📊 Accès restreint à ce module
      </div>
    );
  }

  // 🧮 Regroupe les missions par type réel depuis le backend
  const data = useMemo(() => {
    const list = Array.isArray(requests) ? requests : [];
    if (list.length === 0) return [];
    const counts = {};
    for (const req of list) {
      const type = req.service || "Autre";
      counts[type] = (counts[type] || 0) + 1;
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return Object.keys(counts).map((type) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      value: counts[type],
      percent: total > 0 ? ((counts[type] / total) * 100).toFixed(1) : "0.0",
    }));
  }, [requests]);

  // 🎨 Palette cohérente avec ton thème rouge / noir / blanc
  const COLORS = [
    "#E5372E", // rouge TowTruck Mali
    "#F97316", // orange d'alerte
    "#22C55E", // vert validé
    "#3B82F6", // bleu mission
    "#A855F7", // violet
    "#14B8A6", // turquoise
  ];

  let textColor = "#ffffff";
  if (typeof window !== "undefined" && window?.getComputedStyle) {
    try {
      textColor = getComputedStyle(document.documentElement)
        .getPropertyValue("--text-color")
        .trim() || textColor;
    } catch {}
  }

  const containerRef = useRef(null);
  const [hasSize, setHasSize] = useState(false);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    if (typeof ResizeObserver === "undefined") {
      setHasSize(true);
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries?.[0];
      const width = entry?.contentRect?.width ?? 0;
      const height = entry?.contentRect?.height ?? 0;
      setHasSize(width > 0 && height > 0);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const showEmpty = !Array.isArray(requests) || requests.length === 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full min-h-[320px]"
      style={{ minWidth: 0 }}
    >
      {showEmpty && (
        <div className="flex items-center justify-center h-full text-[var(--muted)] italic">
          Aucune donnée à afficher
        </div>
      )}
      {!showEmpty && hasSize && (
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Tooltip
              contentStyle={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                color: "var(--text-color)",
              }}
              formatter={(value, name) => [`${value} missions`, name]}
            />
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              iconType="circle"
              wrapperStyle={{
                color: textColor,
                fontSize: "0.85rem",
                paddingLeft: "1rem",
              }}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="40%"
              cy="50%"
              innerRadius="50%"
              outerRadius="75%"
              stroke="var(--bg-main)"
              strokeWidth={3}
              paddingAngle={3}
              animationDuration={800}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  stroke="var(--bg-main)"
                  style={{
                    filter:
                      "drop-shadow(0px 1px 2px rgba(0,0,0,0.3)) drop-shadow(0px 0px 3px rgba(0,0,0,0.2))",
                  }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      )}
      {!showEmpty && !hasSize && (
        <div className="flex items-center justify-center h-full text-[var(--muted)] italic">
          Préparation du graphique...
        </div>
      )}
    </div>
  );
}
