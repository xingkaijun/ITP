import { FolderKanban, Languages, LayoutDashboard, LogOut } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";

const APP_BASE = import.meta.env.BASE_URL || "/";

export function Layout() {
  const { t, toggleLocale } = useI18n();
  const { user, role, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-brand">
          <div className="topbar-logo">
            <img src={`${APP_BASE}pg-logo.png`} alt="PG" />
          </div>
          <div className="topbar-title">
            <h1 className="brand">{t("app.name")}</h1>
            <div className="eyebrow">{t("app.tagline")}</div>
          </div>
        </div>

        <nav className="nav-panel">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            <LayoutDashboard size={15} strokeWidth={2.2} />
            {t("nav.overview")}
          </NavLink>
          <NavLink to="/projects" className={({ isActive }) => (isActive ? "active" : "")}>
            <FolderKanban size={15} strokeWidth={2.2} />
            {t("nav.projects")}
          </NavLink>
        </nav>

        <div className="topbar-side">
          <div className="user-chip" title={user}>
            <span className="user-name">{user}</span>
            <span className="role-tag">{role}</span>
          </div>
          <button type="button" className="topbar-btn" onClick={toggleLocale} title={t("lang.toggle")}>
            <Languages size={14} />
            {t("lang.toggle")}
          </button>
          <button type="button" className="topbar-btn" onClick={logout}>
            <LogOut size={14} />
            {t("nav.logout")}
          </button>
        </div>
      </header>

      <main key={location.pathname} className="page-inner stack">
        <Outlet />
      </main>
    </div>
  );
}
