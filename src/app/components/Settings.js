"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAuthStore } from "../stores/useAuthStore";
import { useWorkspacesStore } from "../stores/useWorkspacesStore";
import { getStoredTheme, setStoredTheme } from "@/lib/theme";
import MembersList from "./MembersList";
import TopicsList from "./TopicsList";
import "../../styles/settings.css";

const THEMES = [
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
  { value: "system", label: "System" },
];

export default function Settings() {
  // *** VARIABLES ***
  const user = useAuthStore((state) => state.user);
  const role = useAuthStore((state) => state.role);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const workspace = useAuthStore((state) => state.workspace);
  const setWorkspace = useAuthStore((state) => state.setWorkspace);
  const renameWorkspace = useWorkspacesStore((state) => state.renameWorkspace);

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  // Read from localStorage after mount (not during render) so the server
  // render and hydration agree.
  const [theme, setTheme] = useState(null);

  // *** FUNCTIONS/HANDLERS ***
  useEffect(() => {
    setName(user?.name || "");
  }, [user?.name]);

  useEffect(() => {
    setWorkspaceName(workspace?.name || "");
  }, [workspace?.name]);

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  const handleThemeChange = (value) => {
    setTheme(value);
    setStoredTheme(value);
  };

  const handleSaveWorkspaceName = async (e) => {
    e.preventDefault();
    if (!workspaceName.trim()) return;

    setSavingWorkspace(true);
    try {
      const item = await renameWorkspace(workspaceName.trim());
      setWorkspace({ ...workspace, name: item.name });
      toast.success("Workspace umbenannt");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingWorkspace(false);
    }
  };

  const handleSaveName = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      await updateProfile(name.trim());
      toast.success("Name aktualisiert");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings">
      <div className="settings-header">
        <h2 className="section-title">Einstellungen</h2>
      </div>

      <section className="settings-section">
        <h3 className="settings-section-title">Mein Profil</h3>
        <form className="settings-name-form" onSubmit={handleSaveName}>
          <div className="settings-field">
            <label htmlFor="settings-name">Name</label>
            <input
              id="settings-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vor- und Nachname"
              required
            />
          </div>
          <button
            type="submit"
            className="primary"
            disabled={
              saving || !name.trim() || name.trim() === (user?.name || "")
            }
          >
            {saving ? "Speichern..." : "Speichern"}
          </button>
        </form>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">Darstellung</h3>
        <div className="settings-theme-options" role="radiogroup">
          {THEMES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              className={
                "member-toggle" +
                (theme === value ? " member-toggle-selected" : "")
              }
              onClick={() => handleThemeChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {role === "owner" && workspace && (
        <section className="settings-section">
          <h3 className="settings-section-title">Workspace</h3>
          <form
            className="settings-name-form"
            onSubmit={handleSaveWorkspaceName}
          >
            <div className="settings-field">
              <label htmlFor="settings-workspace-name">Name</label>
              <input
                id="settings-workspace-name"
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="Workspace-Name"
                required
              />
            </div>
            <button
              type="submit"
              className="primary"
              disabled={
                savingWorkspace ||
                !workspaceName.trim() ||
                workspaceName.trim() === workspace.name
              }
            >
              {savingWorkspace ? "Speichern..." : "Speichern"}
            </button>
          </form>
        </section>
      )}

      <TopicsList />

      {role === "owner" && <MembersList />}
    </div>
  );
}
