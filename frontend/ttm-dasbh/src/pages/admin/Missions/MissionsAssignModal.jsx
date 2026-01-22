import { useModalOrigin } from "../../../hooks/useModalOrigin";

export default function MissionsAssignModal({ mission, operators, onClose, onAssign }) {
  const modalRef = useModalOrigin(true);
  const availableOps = Array.isArray(operators)
    ? operators.filter((op) => op.dispo === 1 || op.dispo === true || op.dispo === "1")
    : [];
  const fallbackOps = Array.isArray(operators) ? operators : [];
  const list = availableOps.length ? availableOps : fallbackOps;

  const handleAssign = async (id) => {
    await onAssign(mission, Number(id));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 modal-backdrop"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="bg-[var(--bg-card)] text-[var(--text-color)] p-6 rounded-xl shadow-xl w-96 font-roboto modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-4 font-poppins text-[var(--accent)]">
          Assigner la mission #{mission.id}
        </h2>

        {list.length === 0 ? (
          <p className="text-[var(--muted)] text-sm mb-4">
            Aucun opérateur disponible pour le moment.
          </p>
        ) : (
          <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
            {list.map((op) => (
              <button
                key={op.id}
                onClick={() => handleAssign(op.id)}
                className="w-full text-left px-3 py-2 rounded border border-[var(--border-color)] hover:bg-[var(--bg-main)] flex justify-between items-center"
              >
                <div>
                  <div className="font-semibold">{op.name || "Opérateur"}</div>
                  <div className="text-xs text-[var(--muted)]">{op.phone || ""}</div>
                  {op.ville && (
                    <div className="text-[11px] text-[var(--muted)]">Ville : {op.ville}</div>
                  )}
                </div>
                {op.dispo ? (
                  <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">
                    Disponible
                  </span>
                ) : (
                  <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700">
                    Statut inconnu
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[var(--bg-main)] text-white rounded hover:opacity-80"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
