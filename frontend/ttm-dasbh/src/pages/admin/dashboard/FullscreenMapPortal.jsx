import { createPortal } from "react-dom";
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { getServiceIcon, FitBounds } from "./helpers";
import { useAuth } from "../../../context/AuthContext";
import { can, isSuper } from "../../../utils/rbac";
import { MAP_TILES } from "../../../config/urls";

export default function FullscreenMapPortal({ requests, onClose, onSelectMission }) {
  const { user } = useAuth();

  // ✅ Filtrer uniquement les missions actives
  const active = (requests || []).filter((r) => {
    const s = r.status?.toLowerCase();
    return [
      "acceptee", "en_attente", "publiee", "assignee", "en_route", "sur_place"
    ].includes(s);
  });

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => (document.body.style.overflow = "unset");
  }, []);

  // ✅ Règle RBAC : seuls les admins avec droit de lecture peuvent voir la carte
  if (!user || (!isSuper(user) && !can(user, "requests_view"))) {
    return createPortal(
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]">
        <div className="bg-[var(--bg-card)] p-6 rounded-xl shadow-xl text-center text-[var(--text-color)]">
          <p className="text-lg font-semibold text-[var(--accent)]">
            🚫 Accès restreint
          </p>
          <p className="text-sm text-[var(--muted)] mt-2">
            Vous n’avez pas l’autorisation d’afficher la carte des missions.
          </p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)]"
          >
            Fermer
          </button>
        </div>
      </div>,
      document.body
    );
  }

  const content = (
    <div className="fixed inset-0 z-[9999] bg-[var(--bg-main)] text-[var(--text-color)] animate-fadeIn">
      {/* 🔘 Bouton Fermer */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-3 rounded-full bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] shadow-lg transition-all z-[10000]"
      >
        <XMarkIcon className="w-6 h-6" />
      </button>

      {/* 🧭 Légende / info */}
      <div
        className="absolute top-4 left-4 p-4 rounded-2xl shadow-lg"
        style={{
          background: "var(--bg-card)",
          color: "var(--text-color)",
          border: "1px solid var(--border-color)",
        }}
      >
        <h3 className="font-bold text-[var(--accent)] mb-1">
          Carte des missions (plein écran)
        </h3>
        <p className="text-sm text-[var(--muted)]">
          Cliquez sur un marqueur pour plus d’informations.
        </p>
        <p className="text-xs text-[var(--muted)] mt-1">
          🟢 {active.length} mission{active.length > 1 ? "s" : ""} active
          {active.length > 1 ? "s" : ""}
        </p>
      </div>

      {/* 🗺️ Carte */}
      <MapContainer
        center={[33.9716, -6.8498]}
        zoom={8}
        className="w-full h-full"
        scrollWheelZoom
        fadeAnimation
      >
        <TileLayer url={MAP_TILES.DEFAULT} />

        {active.map((r, i) => {
          const operator = r.operator_name || r.operator?.name || "—";
          const status = r.status?.charAt(0).toUpperCase() + r.status?.slice(1);

          return (
            <Marker
              key={`portal-${i}`}
              position={[Number(r.lat), Number(r.lng)]}
              icon={getServiceIcon(r.service, r.status)}
            >
              <Popup>
                <div className="space-y-1 text-sm text-[var(--text-color)]">
                  <p>
                    <strong>🛠 Service :</strong> {r.service || "—"}
                  </p>
                  <p>
                    <strong>👤 Client :</strong> {r.user_name || "—"}
                  </p>
                  <p>
                    <strong>🚚 Opérateur :</strong> {operator}
                  </p>
                  <p>
                    <strong>📞 Téléphone :</strong> {r.user_phone || "—"}
                  </p>
                  <p>
                    <strong>📍 Zone :</strong> {r.zone || "—"}
                  </p>
                  <p>
                    <strong>📅 Statut :</strong>{" "}
                    <span
                      style={{
                        color:
                          r.status?.toLowerCase() === "terminee"
                            ? "var(--success,#22c55e)"
                            : r.status?.toLowerCase().includes("annulee")
                            ? "var(--danger,#ef4444)"
                            : r.status?.toLowerCase().includes("publiee")
                            ? "var(--info,#3b82f6)"
                            : "var(--warning,#facc15)",
                      }}
                    >
                      {status}
                    </span>
                  </p>

                  {/* 🔒 RBAC : seul les admins autorisés peuvent ouvrir le détail */}
                  {(isSuper(user) || can(user, "requests_view")) && (
                    <button
                      onClick={() => onSelectMission(r)}
                      className="mt-3 px-3 py-1 rounded text-sm text-white w-full"
                      style={{ background: "var(--accent)" }}
                    >
                      Voir détails
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        <FitBounds requests={active} />
      </MapContainer>
    </div>
  );

  return createPortal(content, document.body);
}

