import { useState } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth } from "../../../context/AuthContext";
import { can, isSuper } from "../../../utils/rbac";
import { MAP_TILES, buildAssetUrl, getApiBase } from "../../../config/urls";

export default function MissionsDetailsModal({
  mission,
  onClose,
  onUpdateStatus,
  onDelete,
  onPublish,
  onPhoto,
}) {
  const [closing, setClosing] = useState(false);
  const { user } = useAuth();

  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 250);
  };

  const parsePhotos = (photos) => (Array.isArray(photos) ? photos : []);
  const normalizePhotoUrl = (p) => {
    if (!p) return null;
    const raw = typeof p === "object" && "url" in p ? p.url : p;
    if (!raw) return null;
    if (typeof raw === "string" && raw.startsWith("http")) {
      try {
        const api = new URL(getApiBase());
        const u = new URL(raw);
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

  // 🔒 Vérification des permissions
  const canPublish = isSuper(user) || can(user, "requests_publish");
  const canAssign = isSuper(user) || can(user, "requests_assign");
  const canCancel = isSuper(user) || can(user, "requests_cancel");
  const canComplete = isSuper(user) || can(user, "requests_complete");
  const canDelete = isSuper(user) || can(user, "requests_delete");

  return (
    <div
      className={`fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 transition-opacity duration-300 ${
        closing ? "opacity-0" : "opacity-100"
      }`}
    >
      <div
        className={`relative w-[600px] max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border border-[var(--border-color)] bg-[var(--bg-card)]/80 text-[var(--text-color)] backdrop-blur-xl transition-all duration-300 transform ${
          closing ? "scale-95 opacity-0" : "scale-100 opacity-100"
        } font-roboto`}
      >
        {/* ❌ Bouton fermer */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 p-2 rounded-full bg-[var(--bg-main)] text-[var(--text-color)] hover:bg-[var(--accent)] hover:text-white transition-all shadow-md"
        >
          ✕
        </button>

        {/* 🧾 Titre */}
        <div className="p-6">
          <h2 className="text-xl font-poppins font-semibold mb-4 text-[var(--accent)]">
            Mission #{mission.id}
            <span className="ml-2 px-2 py-1 rounded text-xs bg-[var(--bg-main)] text-[var(--text-color)] border border-[var(--border-color)]">
              {mission.status}
            </span>
          </h2>

          {/* 🗺️ Carte */}
          {mission.lat && mission.lng && (
            <div className="mb-4 h-56 rounded overflow-hidden border border-[var(--border-color)] shadow-sm">
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

          {/* 📋 Infos mission */}
          <div className="space-y-2 text-sm leading-relaxed">
            <p><strong className="text-[var(--accent)]">👤 Client :</strong> {mission.user_name || "—"}</p>
            <p><strong className="text-[var(--accent)]">📞 Téléphone :</strong> {mission.user_phone || "—"}</p>
            <p><strong className="text-[var(--accent)]">📍 Adresse :</strong> {mission.address || "—"}</p>
            <p><strong className="text-[var(--accent)]">🛠 Service :</strong> {mission.service || "—"}</p>
            <p><strong className="text-[var(--accent)]">📅 Date :</strong> {mission.created_at ? new Date(mission.created_at).toLocaleString("fr-FR") : "—"}</p>
          </div>

          {/* 📸 Photos */}
          <div className="mt-5">
            <h3 className="font-poppins font-medium mb-3 text-[var(--accent)]">📷 Photos</h3>
            {parsePhotos(mission.photos).length > 0 ? (
              <div className="flex gap-2 flex-wrap">
                {parsePhotos(mission.photos).map((p, i) => (
                  <img
                    key={i}
                    src={normalizePhotoUrl(p)}
                    alt="mission"
                    className="w-24 h-24 object-cover rounded-md border border-[var(--border-color)] shadow-sm cursor-pointer hover:scale-105 transition-transform duration-200"
                    onClick={() => onPhoto(normalizePhotoUrl(p))}
                  />
                ))}
              </div>
            ) : (
              <p className="text-[var(--muted)] italic">Aucune photo disponible</p>
            )}
          </div>

          {/* ⚙️ Actions */}
          <div className="mt-6 flex flex-wrap gap-3">
            {mission.status === "en_attente" && canPublish && (
              <button
                onClick={() => onPublish(mission.id)}
                className="px-3 py-1 rounded bg-[var(--info,#3b82f6)] text-white hover:brightness-110 transition-all shadow-md"
              >
                Publier
              </button>
            )}
            {mission.status === "publiee" && (
              <>
                {canAssign && (
                  <button
                    onClick={() => onUpdateStatus(mission.id, "assignee")}
                    className="px-3 py-1 rounded bg-[var(--warning,#facc15)] text-black hover:brightness-110 transition-all shadow-md"
                  >
                    Assigner
                  </button>
                )}
                {canCancel && (
                  <button
                    onClick={() => onUpdateStatus(mission.id, "annulee_admin")}
                    className="px-3 py-1 rounded bg-[var(--danger,#ef4444)] text-white hover:brightness-110 transition-all shadow-md"
                  >
                    Annuler
                  </button>
                )}
              </>
            )}
            {mission.status === "assignee" && (
              <>
                {canComplete && (
                  <button
                    onClick={() => onUpdateStatus(mission.id, "terminee")}
                    className="px-3 py-1 rounded bg-[var(--success,#22c55e)] text-white hover:brightness-110 transition-all shadow-md"
                  >
                    Terminer
                  </button>
                )}
                {canCancel && (
                  <button
                    onClick={() => onUpdateStatus(mission.id, "annulee_admin")}
                    className="px-3 py-1 rounded bg-[var(--danger,#ef4444)] text-white hover:brightness-110 transition-all shadow-md"
                  >
                    Annuler
                  </button>
                )}
              </>
            )}
            {canDelete && (
              <button
                onClick={() => onDelete(mission.id)}
                className="px-3 py-1 rounded bg-[var(--muted)] text-white hover:opacity-90 transition-all shadow-md"
              >
                Supprimer
              </button>
            )}
            <button
              onClick={handleClose}
              className="ml-auto px-3 py-1 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-color)] hover:opacity-80 transition-all shadow-md"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

