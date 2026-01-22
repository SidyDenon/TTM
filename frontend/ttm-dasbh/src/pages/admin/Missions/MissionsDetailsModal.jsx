import React, { useState } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MAP_TILES, buildAssetUrl, getApiBase } from "../../../config/urls";
import { useModalOrigin } from "../../../hooks/useModalOrigin";

export default function MissionsDetailsModal({
  mission,
  onClose,
  onUpdateStatus,
  onDelete,
  onPublish,
  onAssign,
}) {
  const [photoView, setPhotoView] = useState(null); // 🆕 Lightbox
  const modalRef = useModalOrigin(true);
  const photoRef = useModalOrigin(!!photoView);

  const parsePhotos = (photos) => (Array.isArray(photos) ? photos : []);
  const normalizePhotoUrl = (p) => {
    if (!p) return null;
    const raw = typeof p === "object" && "url" in p ? p.url : p;
    if (!raw) return null;
    if (typeof raw === "string" && raw.startsWith("http")) {
      try {
        const api = new URL(getApiBase());
        const u = new URL(raw);
        // si le back renvoie http://127.../uploads, on recolle sur le host API
        if (u.origin !== api.origin && u.pathname.startsWith("/uploads/")) {
          return `${api.origin}${u.pathname}`;
        }
        return raw;
      } catch {
        return raw;
      }
    }
    return buildAssetUrl(raw) || null;
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 modal-backdrop"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="bg-[var(--bg-card)] text-[var(--text-color)] p-6 rounded-2xl shadow-xl w-[600px] relative overflow-y-auto max-h-[90vh] font-roboto modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ❌ Bouton fermer */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 bg-[var(--bg-main)] p-2 rounded-full hover:bg-red-600 transition"
        >
          ✕
        </button>

        {/* 🧾 Titre */}
        <h2 className="text-xl font-bold mb-4 font-poppins text-[var(--accent)]">
          Mission #{mission.id}
          <span className="ml-2 px-2 py-1 rounded text-xs bg-[var(--bg-main)]">
            {mission.status}
          </span>
        </h2>

        {/* 🗺️ Carte */}
        {mission.lat && mission.lng && (
          <div className="mb-4 h-56 rounded overflow-hidden">
            <MapContainer
              center={[mission.lat, mission.lng]}
              zoom={14}
              className="w-full h-full"
              whenCreated={(map) => setTimeout(() => map.invalidateSize(), 0)}
            >
              <TileLayer url={MAP_TILES.DEFAULT} />
              <Marker position={[mission.lat, mission.lng]} />
            </MapContainer>
          </div>
        )}

        {/* 📋 Informations */}
        <div className="space-y-2 text-sm">
          <p><strong>👤 Client :</strong> {mission.user_name || "—"}</p>
          <p><strong>📞 Téléphone :</strong> {mission.user_phone || "—"}</p>
          <p>
            <strong className="text-[var(--accent)]">🚚 Opérateur :</strong>{" "}
            {mission.operator_name || mission.operator?.name || "Non assigné"}
          </p>
          <p><strong>📍 Adresse :</strong> {mission.address || "—"}</p>
          <p><strong>🛠 Service :</strong> {mission.service || "—"}</p>
          <p>
            <strong>📅 Date :</strong>{" "}
            {mission.created_at
              ? new Date(mission.created_at).toLocaleString("fr-FR")
              : "—"}
          </p>
        </div>

        {/* 📸 Photos */}
        <div className="mt-4">
          <h3 className="font-semibold mb-2 text-[var(--accent)]">📷 Photos</h3>
          {parsePhotos(mission.photos).length > 0 ? (
            <div className="flex gap-2 flex-wrap">
              {parsePhotos(mission.photos).map((p, i) => {
                const url = normalizePhotoUrl(p);
                return (
                  <img
                    key={i}
                    src={url}
                    alt="mission"
                    className="w-24 h-24 object-cover rounded cursor-pointer border border-[var(--border-color)] hover:opacity-80 hover:scale-105 transition"
                    onClick={() => setPhotoView(url)} // 🆕 Ouvre lightbox
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-gray-400">Aucune photo disponible</p>
          )}
        </div>

        {/* ⚙️ Actions */}
        <div className="mt-6 flex flex-wrap gap-2">
          {mission.status === "en_attente" && (
            <button
              onClick={() => onPublish(mission.id)}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Publier
            </button>
          )}
          {mission.status === "publiee" && (
            <>
              <button
                onClick={() => onAssign?.(mission)}
                className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700"
              >
                Assigner
              </button>
              <button
                onClick={() => onUpdateStatus(mission.id, "annulee_admin")}
                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Annuler
              </button>
            </>
          )}
          {mission.status === "assignee" && (
            <>
              <button
                onClick={() => onUpdateStatus(mission.id, "terminee")}
                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Terminer
              </button>
              <button
                onClick={() => onUpdateStatus(mission.id, "annulee_admin")}
                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Annuler
              </button>
            </>
          )}
          <button
            onClick={() => onDelete(mission.id)}
            className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Supprimer
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[var(--bg-main)] text-white rounded hover:opacity-80 ml-auto"
          >
            Fermer
          </button>
        </div>
      </div>

      {/* 🖼️ Lightbox */}
      {photoView && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] modal-backdrop"
          onClick={() => setPhotoView(null)}
        >
          <div
            ref={photoRef}
            className="modal-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={photoView}
              alt="mission"
              className="max-w-[95vw] max-h-[90vh] rounded-xl object-contain shadow-2xl border border-[var(--border-color)]"
            />
          </div>
          <button
            onClick={() => setPhotoView(null)}
            className="absolute top-4 right-6 text-white text-2xl font-bold hover:scale-110 transition"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}


