"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, Settings, X } from "lucide-react";
import "../../styles/mobile-tab-bar.css";

const APPS = [
  { key: "p", title: "Protokolle" },
  { key: "f", title: "Finanzen" },
  { key: "b", title: "Booking" },
];

// Phones only (hidden by CSS above 768px): bottom bar with Einstellungen,
// the sidebar burger and — for admins — the app switcher, whose button shows
// the current app and unfolds all apps stacked above it.
export default function MobileTabBar({
  activeApp,
  isAdmin,
  settingsActive,
  sidebarOpen,
  onToggleSidebar,
  onOpenSettings,
  onAppChange,
}) {
  // *** VARIABLES ***
  const [appsOpen, setAppsOpen] = useState(false);
  const appsRef = useRef(null);

  // *** FUNCTIONS/HANDLERS ***
  // Close the app stack on outside tap or Escape.
  useEffect(() => {
    if (!appsOpen) return;
    const onPointer = (e) => {
      if (!appsRef.current?.contains(e.target)) setAppsOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setAppsOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [appsOpen]);

  const handlePickApp = (key) => {
    setAppsOpen(false);
    if (key !== activeApp) onAppChange(key);
  };

  return (
    <nav className="mobile-tab-bar" aria-label="Navigation">
      <button
        type="button"
        className={`mobile-tab-button ${settingsActive ? "active" : ""}`}
        aria-label="Einstellungen"
        onClick={() => {
          setAppsOpen(false);
          onOpenSettings();
        }}
      >
        <Settings size={22} />
      </button>

      <button
        type="button"
        className={`mobile-tab-button ${sidebarOpen ? "active" : ""}`}
        aria-label={sidebarOpen ? "Menü schliessen" : "Menü öffnen"}
        aria-expanded={sidebarOpen}
        onClick={() => {
          setAppsOpen(false);
          onToggleSidebar();
        }}
      >
        {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {isAdmin && (
        <div className="mobile-tab-apps" ref={appsRef}>
          {appsOpen && (
            <div className="mobile-tab-apps-stack" role="menu">
              {APPS.map((app) => (
                <button
                  key={app.key}
                  type="button"
                  role="menuitem"
                  title={app.title}
                  aria-label={app.title}
                  className={`mobile-tab-app ${app.key === activeApp ? "active" : ""}`}
                  onClick={() => handlePickApp(app.key)}
                >
                  {app.key}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className={`mobile-tab-button mobile-tab-app-current ${appsOpen ? "active" : ""}`}
            aria-label="App wechseln"
            aria-haspopup="menu"
            aria-expanded={appsOpen}
            onClick={() => setAppsOpen((v) => !v)}
          >
            {activeApp}
          </button>
        </div>
      )}
    </nav>
  );
}
