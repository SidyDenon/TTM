import { FaEllipsisV, FaTrashAlt, FaBan, FaUserCheck, FaBullhorn, FaCheckCircle } from "react-icons/fa";

export default function MissionsActionsMenu({ req, onUpdateStatus, onDelete, onPublish }) {
  return (
    <div className="relative inline-block text-left">
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.currentTarget.nextSibling.classList.toggle("hidden");
        }}
        className="px-2 py-1 bg-[var(--bg-card)] border border-[var(--border-color)] text-xs rounded flex items-center gap-1 hover:opacity-80"
      >
        <FaEllipsisV /> Actions
      </button>

      <div className="hidden absolute right-0 mt-2 w-44 bg-[var(--bg-card)] border border-[var(--border-color)] rounded shadow-lg z-20">
        {req.status === "en_attente" && (
          <button onClick={() => onPublish(req.id)} className="flex items-center gap-2 w-full px-3 py-2 text-blue-400 hover:bg-[var(--bg-main)]">
            <FaBullhorn /> Publier
          </button>
        )}
        {["publiee", "publiee"].includes(req.status?.toLowerCase()) && (
          <button onClick={() => onUpdateStatus(req.id, "assignee")} className="flex items-center gap-2 w-full px-3 py-2 text-yellow-400 hover:bg-[var(--bg-main)]">
            <FaUserCheck /> Assigner
          </button>
        )}
        {req.status === "assignee" && (
          <button onClick={() => onUpdateStatus(req.id, "terminee")} className="flex items-center gap-2 w-full px-3 py-2 text-green-400 hover:bg-[var(--bg-main)]">
            <FaCheckCircle /> Terminer
          </button>
        )}
        <button onClick={() => onUpdateStatus(req.id, "annulee_admin")} className="flex items-center gap-2 w-full px-3 py-2 text-red-400 hover:bg-[var(--bg-main)]">
          <FaBan /> Annuler
        </button>
        <button onClick={() => onDelete(req.id)} className="flex items-center gap-2 w-full px-3 py-2 text-gray-300 hover:bg-[var(--bg-main)]">
          <FaTrashAlt /> Supprimer
        </button>
      </div>
    </div>
  );
}
