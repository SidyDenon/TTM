import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { can, isSuper } from "../../../utils/rbac";
import {
  FaEllipsisV,
  FaTrashAlt,
  FaBan,
  FaUserCheck,
  FaBullhorn,
  FaCheckCircle,
} from "react-icons/fa";

export default function DashboardTable({
  requests = [],
  openMissionDetails,
  onUpdateStatus,
  onDelete,
  onPublish,
}) {
  const { user } = useAuth();

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
                <th className="px-3 py-2">Opérateur</th>
                <th className="px-3 py-2">Zone</th>
                <th className="px-3 py-2">Adresse</th>
                <th className="px-3 py-2">État</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {requests.map((r, i) => {
                const id = r?.id ?? i + 1;
                const client = r?.user_name || r?.client_name || "—";
                const operator =
                  r?.operator_name ||
                  r?.operator?.name ||
                  "Non assigné";
                const zone = r?.zone || "—";
                const address = r?.address || "—";
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
                    <td className="px-3 py-2">{operator}</td>
                    <td className="px-3 py-2">{zone}</td>
                    <td className="px-3 py-2">{address}</td>
                    <td
                      className="px-3 py-2 font-semibold"
                      style={getStatusStyle(status)}
                    >
                      {status}
                    </td>
                    <td className="px-3 py-2 text-[var(--muted)]">
                      {formatWhen(when)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <ActionsMenu
                        req={r}
                        onUpdateStatus={onUpdateStatus}
                        onDelete={onDelete}
                        onPublish={onPublish}
                        user={user}
                      />
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

// ✅ Menu d’actions RBAC + fermeture auto
function ActionsMenu({ req, onUpdateStatus, onDelete, onPublish, user }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef();

  const canPublish = isSuper(user) || can(user, "requests_publish");
  const canAssign = isSuper(user) || can(user, "requests_assign");
  const canCancel = isSuper(user) || can(user, "requests_cancel");
  const canComplete = isSuper(user) || can(user, "requests_complete");
  const canDelete = isSuper(user) || can(user, "requests_delete");

  // ✅ ferme le menu si clic à l’extérieur
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="px-2 py-1 border border-[var(--border-color)] text-xs rounded flex items-center gap-1 hover:opacity-80"
        style={{ background: "var(--bg-card)", color: "var(--text-color)" }}
      >
        <FaEllipsisV /> Actions
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-44 bg-[var(--bg-card)] border border-[var(--border-color)] rounded shadow-lg z-20 overflow-hidden animate-fadeIn"
          onClick={(e) => e.stopPropagation()}
        >
          {req.status === "en_attente" && canPublish && (
            <button
              onClick={() => onPublish(req.id)}
              className="flex items-center gap-2 w-full px-3 py-2 text-blue-400 hover:bg-[var(--bg-main)]"
            >
              <FaBullhorn /> Publier
            </button>
          )}
          {["publiee", "publiée"].includes(req.status?.toLowerCase()) &&
            canAssign && (
              <button
                onClick={() => onUpdateStatus(req.id, "assignee")}
                className="flex items-center gap-2 w-full px-3 py-2 text-yellow-400 hover:bg-[var(--bg-main)]"
              >
                <FaUserCheck /> Assigner
              </button>
            )}
          {req.status === "assignee" && canComplete && (
            <button
              onClick={() => onUpdateStatus(req.id, "terminee")}
              className="flex items-center gap-2 w-full px-3 py-2 text-green-400 hover:bg-[var(--bg-main)]"
            >
              <FaCheckCircle /> Terminer
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => onUpdateStatus(req.id, "annulee_admin")}
              className="flex items-center gap-2 w-full px-3 py-2 text-red-400 hover:bg-[var(--bg-main)]"
            >
              <FaBan /> Annuler
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(req.id)}
              className="flex items-center gap-2 w-full px-3 py-2 text-gray-300 hover:bg-[var(--bg-main)]"
            >
              <FaTrashAlt /> Supprimer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
