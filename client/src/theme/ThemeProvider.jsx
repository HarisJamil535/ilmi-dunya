import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { ThemeContext } from "./useTheme";
const storageKey = (scope) => `ilmidunya-${scope}-theme`;

const readInitialPreference = (scope) => {
  if (typeof window === "undefined") return "system";
  const saved = window.localStorage.getItem(storageKey(scope));
  return saved === "light" || saved === "dark" ? saved : "system";
};

export function ThemeProvider({ scope, children }) {
  const [preference, setPreference] = useState(() => readInitialPreference(scope));
  const [systemDark, setSystemDark] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const theme = preference === "system" ? (systemDark ? "dark" : "light") : preference;

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const update = (event) => setSystemDark(event.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

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
      window.localStorage.setItem(storageKey(scope), next);
      setPreference(next);
    },
  }), [scope, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
