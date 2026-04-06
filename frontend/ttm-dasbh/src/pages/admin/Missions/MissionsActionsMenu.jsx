import { useEffect, useRef, useState } from "react";
import { FaEllipsisH, FaTrashAlt, FaBan, FaUserCheck, FaBullhorn, FaCheckCircle } from "react-icons/fa";

export default function MissionsActionsMenu({ req, onUpdateStatus, onDelete, onPublish, onAssign }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);

  useEffect(() => {
    if (open && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 8,
        left: rect.right - 176
      });
    }
  }, [open]);

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
        className="p-2 rounded-full text-white shadow-md transition hover:opacity-90"
        style={{ background: "var(--accent)" }}
        title="Actions"
      >
        <FaEllipsisH className="w-5 h-5" />
      </button>

      {open && (
        <div
          className="fixed w-44 bg-[var(--bg-card)] border border-[var(--border-color)] rounded shadow-lg z-50"
          style={{
            top: `${pos.top}px`,
            left: `${pos.left}px`,
            borderColor: "var(--border-color)"
          }}
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
      )}
    </div>
  );
}
