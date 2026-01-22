import { BellIcon, UserIcon, Bars3Icon } from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import { can, isSuper } from "../utils/rbac";
import { useModalOrigin } from "../hooks/useModalOrigin";

export default function Header({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const [darkMode, setDarkMode] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [closingProfileMenu, setClosingProfileMenu] = useState(false);
  const profileMenuRef = useModalOrigin(showProfileMenu);
  const profileAnchorRef = useRef(null);

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

  // ⚙️ Seuls les admins financiers peuvent cliquer sur la cloche
  const canSeeFinance =
    can(user, "withdrawals_view") ||
    can(user, "transactions_view") ||
    isSuper(user);

  // 🔔 Clic -> juste activer notifications, aucune redirection
  const handleNotificationsClick = () => {
    if (!canSeeFinance) return;

    if (Notification.permission === "granted") {
      toast.info("🔔 Notifications déjà activées");
      return;
    }

    if (Notification.permission === "denied") {
      toast.error("⚠️ Vous avez refusé les notifications dans votre navigateur");
      return;
    }

    // permission === "default"
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") {
        toast.success("🔔 Notifications activées !");
      } else {
        toast.warn("⚠️ Notifications refusées");
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

      {/* 🔔 Notifications + Thème + Profil */}
      <div className="flex items-center gap-4 lg:gap-8">

        {/* 🔔 Icône Notifications */}
        {canSeeFinance && (
          <div
            className="cursor-pointer"
            onClick={handleNotificationsClick}
            title="Activer les notifications"
          >
            <BellIcon className="w-6 h-6 text-[var(--text-color)] hover:text-[var(--accent)] transition" />
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
            {user?.avatar ? (
              <img
                src={user.avatar}
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
                    {user?.avatar ? (
                      <img
                        src={user.avatar}
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
