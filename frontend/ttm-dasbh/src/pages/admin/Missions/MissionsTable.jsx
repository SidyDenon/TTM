import MissionsActionsMenu from "./MissionsActionsMenu";

export default function MissionsTable({ requests, onSelect, onUpdateStatus, onDelete, onPublish, onAssign }) {
  const normalizeStatus = (s) => {
    if (!s) return { label: "—", key: "unknown" };
    const map = {
      publiee: "publiee",
      acceptee: "acceptee",
      assignee: "assignee",
      terminee: "terminee",
      annulee_admin: "annulee admin",
      annulee_client: "annulee client",
    };
    const key = map[String(s).toLowerCase()] || s;
    return { label: key, key };
  };

  const getColor = (key) => {
    switch (key) {
      case "terminee": return "#22c55e";
      case "assignee": return "#facc15";
      case "publiee": return "#3b82f6";
      case "en_attente": return "#fb923c";
      case "acceptee": return "#14b8a6";
      case "annulee admin":
      case "annulee client": return "#ef4444";
      default: return "var(--muted)";
    }
  };

  return (
    <div className="overflow-y-auto" style={{ maxHeight: "65vh" }}>
      <table className="w-full text-sm border-collapse font-roboto">
        <thead style={{ color: "var(--muted)", borderBottom: "1px solid var(--border-color)", position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 1 }}>
          <tr>
            <th className="px-3 py-2">ID</th>
            <th className="px-3 py-2">Client</th>
            <th className="px-3 py-2">Téléphone</th>
            <th className="px-3 py-2">Adresse</th>
            <th className="px-3 py-2">Service</th>
            <th className="px-3 py-2">État</th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => {
          const { label, key } = normalizeStatus(req.status);
          const color = getColor(key);
          return (
            <tr
              key={req.id}
              className="cursor-pointer hover:opacity-90 transition"
              style={{ borderTop: `1px solid var(--border-color)` }}
              onClick={() => onSelect(req)}
            >
              <td className="px-3 py-2">#{req.id}</td>
              <td className="px-3 py-2">{req.user_name || "—"}</td>
              <td className="px-3 py-2">{req.user_phone || "—"}</td>
              <td className="px-3 py-2">{req.address || "—"}</td>
              <td className="px-3 py-2">{req.service || "—"}</td>
              <td className="px-3 py-2 font-semibold flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}55` }}
                ></span>
                <span style={{ color }}>{label}</span>
              </td>
              <td className="px-3 py-2">
                {req.created_at ? new Date(req.created_at).toLocaleString("fr-FR") : "—"}
              </td>
              <td className="px-3 py-2 relative">
                <MissionsActionsMenu
                  req={req}
                  onUpdateStatus={onUpdateStatus}
                  onDelete={onDelete}
                  onPublish={onPublish}
                  onAssign={onAssign}
                />
              </td>
            </tr>
          );
          })}
        </tbody>
      </table>
    </div>
  );
}
