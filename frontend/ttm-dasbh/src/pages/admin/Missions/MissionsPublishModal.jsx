export default function MissionsPublishModal({
  id,
  price,
  setPrice,
  distance,
  setDistance,
  onClose,
  onConfirm,
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[var(--bg-card)] text-[var(--text-color)] p-6 rounded-xl shadow-xl w-96 font-roboto">
        <h2 className="text-lg font-bold mb-4 font-poppins text-[var(--accent)]">
          Publier la mission #{id}
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
          placeholder="Distance (km)"
          className="w-full mb-3 p-2 rounded bg-[var(--bg-main)] text-[var(--text-color)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
          min="1"
        />

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
              await onConfirm(id, price, distance);
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
