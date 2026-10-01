import type { ReactNode } from "react";
import {
  CalendarDays,
  ChevronRight,
  CircleHelp,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings2,
  SunMedium,
  Users,
} from "lucide-react";
import type { Page, Role } from "../types/domain";

type Props = {
  role: Role;
  page: Page;
  setPage: (page: Page) => void;
  mobileNav: boolean;
  setMobileNav: (open: boolean) => void;
  fullName: string;
  dataState: "loading" | "ready" | "error";
  onSignOut: () => void;
  onHelp: () => void;
  children: ReactNode;
  overlays?: ReactNode;
};

export function AppLayout({
  role,
  page,
  setPage,
  mobileNav,
  setMobileNav,
  fullName,
  dataState,
  onSignOut,
  onHelp,
  children,
  overlays,
}: Props) {
  const nav = [
    { id: "overview" as Page, label: "Overview", icon: LayoutDashboard },
    { id: "stations" as Page, label: "Solar stations", icon: SunMedium },
    { id: "reservations" as Page, label: "Reservations", icon: CalendarDays },
    ...(role === "Backoffice"
      ? [{ id: "people" as Page, label: "People & access", icon: Users }]
      : []),
  ];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "is-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">
            <SunMedium size={20} />
          </span>
          <span>
            solar<span>grid</span>
          </span>
        </div>
        <div className="workspace-label">
          {role === "Prosumer" ? "PROSUMER SPACE" : "CONTROL ROOM"}{" "}
          <span>
            {dataState === "ready"
              ? "API"
              : dataState === "loading"
                ? "LOADING"
                : "UNAVAILABLE"}
          </span>
        </div>
        <nav>
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={page === id ? "nav-item active" : "nav-item"}
              onClick={() => {
                setPage(id);
                setMobileNav(false);
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {page === id && <ChevronRight size={15} className="nav-arrow" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className={page === "settings" ? "nav-item active" : "nav-item"}
            onClick={() => {
              setPage("settings");
              setMobileNav(false);
            }}
          >
            <Settings2 size={18} />
            <span>Settings</span>
          </button>
          <button className="nav-item" onClick={onSignOut}>
            <LogOut size={18} />
            <span>Sign out</span>
          </button>
          <div className="mini-profile">
            <div className="avatar">
              {fullName
                .split(/\s+/)
                .filter(Boolean)
                .map((part) => part[0])
                .join("")
                .slice(0, 2) || role[0]}
            </div>
            <div>
              <strong>{fullName || role}</strong>
              <small>{role}</small>
            </div>
            <CircleHelp size={16} />
          </div>
        </div>
      </aside>
      {mobileNav && (
        <button
          className="scrim"
          onClick={() => setMobileNav(false)}
          aria-label="Close navigation"
        />
      )}
      <main className="main-content">
        <header className="topbar">
          <button
            className="icon-button menu-button"
            onClick={() => setMobileNav(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumbs">
            <span>Solargrid</span>
            <ChevronRight size={14} />
            <strong>
              {page === "settings"
                ? "Settings"
                : nav.find((item) => item.id === page)?.label}
            </strong>
          </div>
          <div className="top-actions">
            <span className="role-badge">{role}</span>
            <button
              className="icon-button"
              title="Search reservations"
              onClick={() => setPage("reservations")}
            >
              <Search size={18} />
            </button>
            <button className="help-button" onClick={onHelp}>
              <CircleHelp size={16} /> Help centre
            </button>
            <div className="avatar">
              {fullName
                .split(/\s+/)
                .filter(Boolean)
                .map((part) => part[0])
                .join("")
                .slice(0, 2) || role[0]}
            </div>
          </div>
        </header>
        <div className="content-wrap">{children}</div>
      </main>
      {overlays}
    </div>
  );
}
