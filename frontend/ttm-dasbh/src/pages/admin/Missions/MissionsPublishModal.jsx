import { useModalOrigin } from "../../../hooks/useModalOrigin";

export default function MissionsPublishModal({
  mission,
  price,
  setPrice,
  distance,
  setDistance,
  onClose,
  onConfirm,
}) {
  const isTowing =
    typeof mission?.service === "string" &&
    mission.service.toLowerCase().includes("remorqu");
  const maxDistance = isTowing ? 100 : undefined;

  const modalRef = useModalOrigin(true);

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
          Publier la mission #{mission.id}
        </h2>

        <input
          type="number"
          placeholder="Prix (€)"
          className="w-full mb-3 p-2 rounded bg-[var(--bg-main)] text-[var(--text-color)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          min="1"
        />
        <input
          type="number"
          placeholder={`Distance (km)${isTowing ? " • max 100 km" : ""}`}
          className="w-full mb-3 p-2 rounded bg-[var(--bg-main)] text-[var(--text-color)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
          min="1"
          max={maxDistance}
        />
        {isTowing && (
          <p className="text-xs text-[var(--muted)] mb-3">
            Mission de remorquage : distance limitée à 100 km.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[var(--bg-main)] text-white rounded hover:opacity-80"
          >
            Annuler
          </button>
          <button
            disabled={!price || !distance || price <= 0 || distance <= 0}
            onClick={async () => {
              await onConfirm(mission, price, distance);
              onClose();
              setPrice("");
              setDistance("");
            }}
            className={`px-3 py-1 rounded transition ${
              !price || !distance || price <= 0 || distance <= 0
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-[var(--accent)] hover:opacity-90"
            }`}
          >
            Publier
          </button>
        </div>
      </div>
    </div>
  );
}
