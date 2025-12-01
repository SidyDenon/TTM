import React from "react";

export default function DashboardTable({
  requests = [],
  openMissionDetails,
}) {
  const norm = (s) => String(s || "").toLowerCase().trim();

  const getStatusStyle = (status) => {
    const s = norm(status);
    if (["terminee", "terminée", "done"].includes(s))
      return { color: "var(--success,#22c55e)" };
    if (["publiee", "publiée"].includes(s))
      return { color: "var(--info,#3b82f6)" };
    if (
      ["annulee", "annulee_admin", "annulee_client", "canceled"].includes(s)
    )
      return { color: "var(--danger,#ef4444)" };
    if (
      ["en_cours", "acceptee", "assignee", "en_route", "sur_place"].includes(s)
    )
      return { color: "var(--warning,#facc15)" };
    if (["en_attente", "pending"].includes(s))
      return { color: "var(--muted,#94a3b8)" };
    return { color: "var(--accent,#ef4444)" };
  };

  const formatWhen = (v) => {
    if (!v) return "—";
    const d = new Date(v);
    if (isNaN(d.getTime())) return "—";
    return `${d.toLocaleDateString("fr-FR")} ${d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  const empty = !Array.isArray(requests) || requests.length === 0;
  const limited = empty ? [] : requests.slice(0, 4); // afficher seulement 4 missions

  return (
    <div
      className="p-5 rounded-2xl shadow theme-fade font-roboto"
      style={{
        background: "var(--bg-card)",
        color: "var(--text-color)",
      }}
    >
      <h3 className="font-poppins font-semibold mb-4 text-lg">
        Dernières missions
      </h3>

      {empty ? (
        <div
          className="text-sm p-4 rounded border"
          style={{
            borderColor: "var(--border-color)",
            color: "var(--muted)",
          }}
        >
          Aucune mission à afficher pour le moment.
        </div>
      ) : (
        <div className="overflow-y-auto" style={{ maxHeight: "55vh" }}>
          <table className="w-full text-sm text-left border-collapse">
            <thead
              style={{
                color: "var(--muted)",
                borderBottom: "1px solid var(--border-color)",
                position: "sticky",
                top: 0,
                background: "var(--bg-card)",
                zIndex: 1,
              }}
            >
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">État</th>
                <th className="px-3 py-2">Date</th>
              </tr>
            </thead>

            <tbody>
              {limited.map((r, i) => {
                const id = r?.id ?? i + 1;
                const client = r?.user_name || r?.client_name || "—";
                const status = r?.status || "—";
                const when = r?.created_at;

                return (
                  <tr
                    key={id}
                    className="hover:bg-[var(--bg-main)]/30 transition cursor-pointer"
                    style={{
                      borderTop: `1px solid var(--border-color)`,
                    }}
                    onClick={() => openMissionDetails?.(r)}
                  >
                    <td className="px-3 py-2 font-medium">#{id}</td>
                    <td className="px-3 py-2">{client}</td>
                    <td
                      className="px-3 py-2 font-semibold"
                      style={getStatusStyle(status)}
                    >
                      {status}
                    </td>
                    <td className="px-3 py-2 text-[var(--muted)]">
                      {formatWhen(when)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
