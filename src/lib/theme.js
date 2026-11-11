// UI colour scheme: "light", "dark" or "system" (follows the OS). The choice
// is per browser (localStorage); <html data-theme> carries the resolved
// value that the CSS tokens in main.css key off.

export const THEME_STORAGE_KEY = "theme";
export const THEME_OPTIONS = ["light", "dark", "system"];

const DARK_QUERY = "(prefers-color-scheme: dark)";

// Runs inline in <head> before first paint so a dark preference never
// flashes the light UI. Keep in sync with resolveTheme below.
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=p==="dark"||((p!=="light")&&window.matchMedia("${DARK_QUERY}").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}})();`;

export function getStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_OPTIONS.includes(value) ? value : "system";
  } catch {
    return "system";
  }
}

function resolveTheme(preference) {
  if (preference === "light" || preference === "dark") return preference;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function applyTheme(preference) {
  document.documentElement.dataset.theme = resolveTheme(preference);
}

export function setStoredTheme(preference) {
  try {
    if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage blocked (private mode): the choice still applies for this tab.
  }
  applyTheme(preference);
}

// Keeps "system" in step with the OS while the app is open. Returns cleanup.
export function watchSystemTheme() {
  const media = window.matchMedia(DARK_QUERY);
  const onChange = () => {
    if (getStoredTheme() === "system") applyTheme("system");
  };
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
