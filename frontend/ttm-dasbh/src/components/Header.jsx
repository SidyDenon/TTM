import { BellIcon, UserIcon, Bars3Icon } from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { toast } from "../utils/toast";
import { can, canAny, isSuper } from "../utils/rbac";
import { useModalOrigin } from "../hooks/useModalOrigin";
import { apiUrl, getApiBase } from "../config/urls";
import { getSocketInstance } from "../utils/socket";

export default function Header({ onToggleSidebar, onOpenOilMissionDetail }) {
  const { user, token, logout } = useAuth();
  const apiBase = getApiBase();
  const [darkMode, setDarkMode] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [closingProfileMenu, setClosingProfileMenu] = useState(false);
  const [showOilNotifMenu, setShowOilNotifMenu] = useState(false);
  const [oilNotifLoading, setOilNotifLoading] = useState(false);
  const [oilMissions, setOilMissions] = useState([]);
  const [internalMissions, setInternalMissions] = useState([]);
  const profileMenuRef = useModalOrigin(showProfileMenu);
  const oilNotifMenuRef = useModalOrigin(showOilNotifMenu);
  const profileAnchorRef = useRef(null);
  const oilNotifAnchorRef = useRef(null);

  // 🌙 Thème
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  // Seuls les admins financiers peuvent cliquer sur la cloche
  const canSeeFinance =
    can(user, "withdrawals_view") ||
    can(user, "transactions_view") ||
    isSuper(user);

  const canSeeOilNotifications =
    isSuper(user) ||
    canAny(user, [
      "requests_view",
      "requests_manage",
      "requests_assign",
      "requests_publish",
      "requests_cancel",
      "requests_complete",
      "site_view",
      "site_manage",
    ]);

  const canUseBell = canSeeFinance || canSeeOilNotifications;

  const normalizeServiceKey = (value = "") =>
    String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "")
      .trim();

  const fetchBellMissions = async () => {
    if (!token || !canSeeOilNotifications) {
      setOilMissions([]);
      setInternalMissions([]);
      return;
    }
    setOilNotifLoading(true);
    try {
      const [oilRes, servicesRes, requestsRes] = await Promise.all([
        fetch(apiUrl("/admin/oil-service-requests"), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(apiUrl("/admin/services"), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(apiUrl("/admin/requests?status=publiee&limit=all"), {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const oilData = await oilRes.json();
      if (!oilRes.ok) {
        throw new Error(oilData?.error || "Impossible de charger les missions domicile");
      }

      const servicesData = await servicesRes.json();
      if (!servicesRes.ok) {
        throw new Error(servicesData?.error || "Impossible de charger les services");
      }

      const requestsData = await requestsRes.json();
      if (!requestsRes.ok) {
        throw new Error(requestsData?.error || "Impossible de charger les missions internes");
      }

      const oilList = Array.isArray(oilData?.data) ? oilData.data : [];
      const publishedOilOnly = oilList.filter(
        (m) => String(m?.status || "").toLowerCase() === "publiee"
      );
      setOilMissions(publishedOilOnly);

      const servicesList = Array.isArray(servicesData?.data) ? servicesData.data : [];
      const internalServiceNames = new Set(
        servicesList
          .filter((s) => Number(s?.is_internal) === 1)
          .map((s) => normalizeServiceKey(s?.name))
          .filter(Boolean)
      );

      const requestsList = Array.isArray(requestsData?.data) ? requestsData.data : [];
      const publishedInternal = requestsList.filter((m) => {
        const key = normalizeServiceKey(m?.service);
        if (!key || key === "oilservice") return false;
        return internalServiceNames.has(key);
      });
      setInternalMissions(publishedInternal);
    } catch (err) {
      console.error("Erreur chargement cloche missions:", err);
    } finally {
      setOilNotifLoading(false);
    }
  };

  //  Clic -> ouvrir/fermer menu interactif
  const handleNotificationsClick = () => {
    if (!canUseBell) return;

    setShowOilNotifMenu((v) => !v);

    if (typeof Notification === "undefined") return;

    if (Notification.permission === "granted") {
      return;
    }

    if (Notification.permission === "denied") {
      toast.error("Vous avez refusé les notifications dans votre navigateur");
      return;
    }

    // permission === "default"
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") {
        toast.success(" Notifications activées !");
      } else {
        toast.warn("Notifications refusées");
      }
    });
  };

  useEffect(() => {
    if (!showProfileMenu) return;
    const handleClickOutside = (e) => {
      if (profileAnchorRef.current && profileAnchorRef.current.contains(e.target)) {
        return;
      }
      setClosingProfileMenu(true);
      setTimeout(() => {
        setShowProfileMenu(false);
        setClosingProfileMenu(false);
      }, 180);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showProfileMenu]);

  useEffect(() => {
    if (!showOilNotifMenu) return;
    const handleClickOutside = (e) => {
      if (oilNotifAnchorRef.current && oilNotifAnchorRef.current.contains(e.target)) {
        return;
      }
      setShowOilNotifMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showOilNotifMenu]);

  useEffect(() => {
    fetchBellMissions();
  }, [token, canSeeOilNotifications]);

  useEffect(() => {
    const socket = getSocketInstance();
    if (!socket || !canSeeOilNotifications) return;

    const onNewOilMission = (payload) => {
      const missionId = payload?.requestId;
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Nouvelle mission Service à Domicile", {
          body: missionId ? `Mission #${missionId} publiée` : "Nouvelle mission publiée",
          icon: "/logoApp.png",
        });
      }
      toast.info(" Nouvelle mission Service à Domicile publiée");
      fetchBellMissions();
    };

    const onOilMissionUpdated = () => {
      fetchBellMissions();
    };

    const onNewInternalMission = (payload) => {
      const missionId = payload?.requestId;
      const serviceLabel = String(payload?.service || "Service").trim() || "Service";
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Nouvelle mission interne", {
          body: missionId
            ? `Mission #${missionId} (${serviceLabel}) publiée`
            : `Nouvelle mission interne (${serviceLabel}) publiée`,
          icon: "/logoApp.png",
        });
      }
      toast.info(
        missionId
          ? ` Nouvelle mission interne #${missionId} (${serviceLabel})`
          : ` Nouvelle mission interne (${serviceLabel})`
      );
    };

    socket.on("new_oil_service_request", onNewOilMission);
    socket.on("new_internal_service_request", onNewInternalMission);
    socket.on("oil_service_assigned", onOilMissionUpdated);
    socket.on("mission:status_changed", onOilMissionUpdated);
    socket.on("mission:deleted", onOilMissionUpdated);

    return () => {
      socket.off("new_oil_service_request", onNewOilMission);
      socket.off("new_internal_service_request", onNewInternalMission);
      socket.off("oil_service_assigned", onOilMissionUpdated);
      socket.off("mission:status_changed", onOilMissionUpdated);
      socket.off("mission:deleted", onOilMissionUpdated);
    };
  }, [canSeeOilNotifications, token]);

  const pendingBellCount = oilMissions.length + internalMissions.length;

  const openMissionDetailsFromBell = (mission) => {
    if (!mission?.id) return;
    setShowOilNotifMenu(false);
    onOpenOilMissionDetail?.(mission.id);
  };

  const resolveAvatarUrl = (avatarUrl) => {
    const raw = String(avatarUrl || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    return `${apiBase}/${raw.replace(/^\/+/, "")}`;
  };

  return (
    <header className="topbar flex items-center justify-between px-4 lg:px-6 py-3 shadow-md theme-fade sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {/* ☰ Mobile menu */}
        <button
          onClick={() => onToggleSidebar?.()}
          className="lg:hidden p-2 rounded-md border border-[var(--border-color)] text-[var(--text-color)] hover:bg-[var(--border-color)]/30"
          aria-label="Ouvrir le menu"
        >
          <Bars3Icon className="w-6 h-6" />
        </button>
        {/* 🧭 Titre */}
        <h2 className="text-lg lg:text-xl font-semibold text-[var(--accent)] whitespace-nowrap">
          Tableau de bord administrateur
        </h2>
      </div>

      {/*  Notifications + Thème + Profil */}
      <div className="flex items-center gap-4 lg:gap-8">

        {/*  Icône Notifications */}
        {canUseBell && (
          <div
            className="relative cursor-pointer"
            ref={oilNotifAnchorRef}
            onClick={handleNotificationsClick}
            title="Missions Service à Domicile"
          >
            <BellIcon className="w-6 h-6 text-[var(--text-color)] hover:text-[var(--accent)] transition" />

            {pendingBellCount > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                {pendingBellCount > 99 ? "99+" : pendingBellCount}
              </span>
            )}

            {showOilNotifMenu && (
              <div
                ref={oilNotifMenuRef}
                className="absolute right-0 top-full mt-2 w-[420px] max-h-[65vh] overflow-auto rounded-xl shadow-xl border"
                style={{
                  background: "var(--bg-card)",
                  borderColor: "var(--border-color)",
                  color: "var(--text-color)",
                  zIndex: 45,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-3 border-b" style={{ borderColor: "var(--border-color)" }}>
                  <p className="font-semibold">Missions publiées</p>
                </div>

                {oilNotifLoading ? (
                  <p className="p-4 text-sm" style={{ color: "var(--muted)" }}>
                    Chargement...
                  </p>
                ) : (
                  <div>
                    <div className="p-3 border-b" style={{ borderColor: "var(--border-color)" }}>
                      <p className="text-sm font-semibold">Service à Domicile</p>
                    </div>
                    {oilMissions.length === 0 ? (
                      <p className="p-3 text-sm" style={{ color: "var(--muted)" }}>
                        Aucune mission domicile publiée.
                      </p>
                    ) : (
                      <div className="divide-y" style={{ borderColor: "var(--border-color)" }}>
                        {oilMissions.map((m) => (
                          <div key={`oil-${m.id}`} className="p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium">Mission #{m.id}</p>
                                <p className="text-sm" style={{ color: "var(--muted)" }}>
                                  {m.user_name || "Client"} • {m.address || "Adresse non définie"}
                                </p>
                                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                                  {m.created_at ? new Date(m.created_at).toLocaleString("fr-FR") : "—"}
                                </p>
                              </div>
                              <button
                                className="px-2.5 py-1.5 rounded text-xs font-medium"
                                style={{ background: "var(--accent)", color: "#fff" }}
                                onClick={() => openMissionDetailsFromBell(m)}
                              >
                                Voir détail
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="p-3 border-b border-t" style={{ borderColor: "var(--border-color)" }}>
                      <p className="text-sm font-semibold">Missions internes</p>
                    </div>
                    {internalMissions.length === 0 ? (
                      <p className="p-3 text-sm" style={{ color: "var(--muted)" }}>
                        Aucune mission interne publiée.
                      </p>
                    ) : (
                      <div className="divide-y" style={{ borderColor: "var(--border-color)" }}>
                        {internalMissions.map((m) => (
                          <div key={`internal-${m.id}`} className="p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium">Mission #{m.id}</p>
                                <p className="text-sm" style={{ color: "var(--muted)" }}>
                                  {m.service || "Service interne"}
                                  {m.user_name ? ` • ${m.user_name}` : ""}
                                </p>
                                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                                  {m.created_at ? new Date(m.created_at).toLocaleString("fr-FR") : "—"}
                                </p>
                              </div>
                              <button
                                className="px-2.5 py-1.5 rounded text-xs font-medium"
                                style={{ background: "var(--accent)", color: "#fff" }}
                                onClick={() => openMissionDetailsFromBell(m)}
                              >
                                Voir détail
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 🌙 Switch thème */}
        <div onClick={toggleTheme} className="theme-toggle cursor-pointer" />

        {/* 👤 Profil */}
        <div className="relative flex items-center gap-3 pl-2" ref={profileAnchorRef}>
          <span className="text-sm font-medium text-[var(--text-color)]">
            {user?.name || "Admin"}
          </span>

          <button
            type="button"
            onClick={() => {
              if (showProfileMenu) {
                setClosingProfileMenu(true);
                setTimeout(() => {
                  setShowProfileMenu(false);
                  setClosingProfileMenu(false);
                }, 180);
              } else {
                setClosingProfileMenu(false);
                setShowProfileMenu(true);
              }
            }}
            className="flex items-center justify-center w-9 h-9 rounded-full border border-[var(--border-color)] bg-[var(--bg-card)]"
            title="Profil"
          >
            {user?.avatar_url ? (
              <img
                src={resolveAvatarUrl(user?.avatar_url)}
                alt="Profil"
                className="w-9 h-9 rounded-full object-cover"
              />
            ) : (
              <UserIcon className="w-5 h-5 text-[var(--text-color)]" />
            )}
          </button>

          {showProfileMenu && (
            <div
              ref={profileMenuRef}
              className={`absolute right-0 top-full mt-2 w-72 rounded-xl shadow-xl border modal-panel ${closingProfileMenu ? "closing" : ""}`}
              style={{
                background: "var(--bg-card)",
                borderColor: "var(--border-color)",
                color: "var(--text-color)",
                zIndex: 40,
              }}
            >
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-[var(--border-color)] bg-[var(--bg-main)]">
                    {user?.avatar_url ? (
                      <img
                        src={resolveAvatarUrl(user?.avatar_url)}
                        alt="Profil"
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <UserIcon className="w-5 h-5 text-[var(--text-color)]" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{user?.name || "Admin"}</p>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>
                      {user?.email || "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
                  Rôle : {user?.is_super ? "Superadmin" : "Admin"}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setShowProfileMenu(false);
                  }}
                  className="mt-4 w-full px-3 py-2 rounded text-sm font-semibold"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  Déconnexion
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
