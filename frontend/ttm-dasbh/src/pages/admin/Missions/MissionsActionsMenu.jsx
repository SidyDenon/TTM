import { useEffect, useRef, useState } from "react";
import { FaEllipsisV, FaTrashAlt, FaBan, FaUserCheck, FaBullhorn, FaCheckCircle } from "react-icons/fa";

export default function MissionsActionsMenu({ req, onUpdateStatus, onDelete, onPublish, onAssign }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

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
        className="px-2 py-1 bg-[var(--bg-card)] border border-[var(--border-color)] text-xs rounded flex items-center gap-1 hover:opacity-80"
      >
        <FaEllipsisV /> Actions
      </button>

      <div
        className={`${open ? "" : "hidden"} absolute right-0 mt-2 w-44 bg-[var(--bg-card)] border border-[var(--border-color)] rounded shadow-lg z-20`}
      >
        {req.status === "en_attente" && (
          <button
            onClick={() => {
              setOpen(false);
              onPublish(req);
            }}
            className="flex items-center gap-2 w-full px-3 py-2 text-blue-400 hover:bg-[var(--bg-main)]"
          >
            <FaBullhorn /> Publier
          </button>
        )}
        {["publiee", "publiee"].includes(req.status?.toLowerCase()) && (
          <button
            onClick={() => {
              setOpen(false);
              onAssign(req);
            }}
            className="flex items-center gap-2 w-full px-3 py-2 text-yellow-400 hover:bg-[var(--bg-main)]"
          >
            <FaUserCheck /> Assigner
          </button>
        )}
        {req.status === "assignee" && (
          <button
            onClick={() => {
              setOpen(false);
              onUpdateStatus(req.id, "terminee");
            }}
            className="flex items-center gap-2 w-full px-3 py-2 text-green-400 hover:bg-[var(--bg-main)]"
          >
            <FaCheckCircle /> Terminer
          </button>
        )}
        <button
          onClick={() => {
            setOpen(false);
            onUpdateStatus(req.id, "annulee_admin");
          }}
          className="flex items-center gap-2 w-full px-3 py-2 text-red-400 hover:bg-[var(--bg-main)]"
        >
          <FaBan /> Annuler
        </button>
        <button
          onClick={() => {
            setOpen(false);
            onDelete(req.id);
          }}
          className="flex items-center gap-2 w-full px-3 py-2 text-gray-300 hover:bg-[var(--bg-main)]"
        >
          <FaTrashAlt /> Supprimer
        </button>
      </div>
    </div>
  );
}
