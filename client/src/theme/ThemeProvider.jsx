import { useLayoutEffect, useMemo, useSyncExternalStore } from "react";
import { ThemeContext } from "./useTheme";
const storageKey = (scope) => `ilmidunya-${scope}-theme`;
const temporaryPreferences = new Map();
const subscribe = (onChange) => {
  window.addEventListener('storage', onChange);
  window.addEventListener('ilmidunya-theme-change', onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener('ilmidunya-theme-change', onChange);
  };
};

const readInitialPreference = (scope) => {
  if (typeof window === "undefined") return "light";
  if (temporaryPreferences.has(scope)) return temporaryPreferences.get(scope);
  try {
    return window.localStorage.getItem(storageKey(scope)) === "dark" ? "dark" : "light";
  } catch { return "light"; }
};

export function ThemeProvider({ scope, children }) {
  // The server snapshot keeps theme-dependent controls consistent during hydration.
  const theme = useSyncExternalStore(subscribe, () => readInitialPreference(scope), () => "light");

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.dataset.theme = theme;
    root.dataset.themeScope = scope;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#10111a" : "#623fcd");
  }, [scope, theme]);

  const value = useMemo(() => ({
    theme,
    toggleTheme() {
      const next = theme === "dark" ? "light" : "dark";
      try { window.localStorage.setItem(storageKey(scope), next); }
      catch { temporaryPreferences.set(scope, next); }
      window.dispatchEvent(new Event('ilmidunya-theme-change'));
    },
  }), [scope, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
