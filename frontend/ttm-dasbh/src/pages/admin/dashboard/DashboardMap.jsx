import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { ArrowsPointingOutIcon } from "@heroicons/react/24/outline";
import { getServiceIcon, FitBounds } from "./helpers";
import { useAuth } from "../../../context/AuthContext";
import { can, isSuper } from "../../../utils/rbac";
import { MAP_TILES } from "../../../config/urls";

export default function DashboardMap({
  requests,
  fetchData,
  setMapFullscreen,
  setSelectedMission,
  operatorPositions = {},
}) {
  const { user } = useAuth();

  // 🔒 Permissions
  const canViewMap = isSuper(user) || can(user, "map_view") || can(user, "requests_view");
  const canRefresh = isSuper(user) || can(user, "requests_refresh");
  const canOpenFullscreen = isSuper(user) || can(user, "map_fullscreen");

  const active = requests.filter(
    (r) =>
      !["terminee", "annulee", "annulee_client", "annulee_admin"].includes(
        r.status?.toLowerCase()
      )
  );

  // 🧭 Si l’utilisateur n’a pas accès à la carte
  if (!canViewMap) {
    return (
      <div
        className="flex items-center justify-center h-72 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--muted)] italic shadow-sm"
        style={{ background: "var(--bg-card)" }}
      >
        🔒 Accès restreint à la carte des missions
      </div>
    );
  }

  return (
    <div
      className="p-4 rounded-2xl shadow-md relative transition-all duration-300"
      style={{ background: "var(--bg-card)", color: "var(--text-color)" }}
    >
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold text-[var(--accent)]">
          Carte des missions{" "}
          <span className="ml-2 text-sm text-[var(--muted)]">
            🟢 {active.length} actives
          </span>
        </h3>

        <div className="flex items-center gap-2">
          {canRefresh && (
            <button
              onClick={fetchData}
              className="px-2 py-1 text-xs rounded-md border border-[var(--border-color)] hover:bg-[var(--accent)] hover:text-white transition-all"
              style={{
                background: "var(--bg-main)",
                color: "var(--text-color)",
              }}
            >
              Actualiser
            </button>
          )}
          {canOpenFullscreen && (
            <button
              onClick={() => setMapFullscreen(true)}
              className="p-1 hover:text-[var(--accent)] transition-all"
              title="Agrandir la carte"
            >
              <ArrowsPointingOutIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <MapContainer
        center={[33.9716, -6.8498]} // Casablanca par défaut
        zoom={8}
        className="h-60 w-full rounded-lg border border-[var(--border-color)] overflow-hidden"
        attributionControl={false}
      >
        <TileLayer url={MAP_TILES.DEFAULT} />
        {active
          .filter((r) => r.lat && r.lng)
          .map((r) => (
            <Marker
              key={`${r.id}-${r.status}`}
              position={[Number(r.lat), Number(r.lng)]}
              icon={getServiceIcon(r.service, r.status)}
            >
              <Popup>
                <div className="space-y-1">
                  <p>
                    <strong>Service :</strong> {r.service}
                  </p>
                  <p>
                    <strong>Client :</strong> {r.user_name}
                  </p>
                  <p>
                    <strong>Téléphone :</strong> {r.user_phone || "—"}
                  </p>
                  <button
                    onClick={() => setSelectedMission(r)}
                    className="mt-2 px-3 py-1 rounded text-sm text-white transition-all hover:brightness-110"
                    style={{ background: "var(--accent)" }}
                  >
                    Voir détails
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        {/* Positions opérateurs (live) */}
        {active.map((r) => {
          const pos = operatorPositions?.[r.id];
          if (!pos || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) return null;
          return (
            <Marker key={`op-${r.id}-${pos.timestamp}`} position={[Number(pos.lat), Number(pos.lng)]}>
              <Popup>
                <div className="space-y-1">
                  <p><strong>Opérateur:</strong> {pos.operatorId}</p>
                  <p><strong>Maj:</strong> {new Date(pos.timestamp).toLocaleTimeString()}</p>
                </div>
              </Popup>
            </Marker>
          );
        })}
        <FitBounds requests={active} />
      </MapContainer>
    </div>
  );
}

