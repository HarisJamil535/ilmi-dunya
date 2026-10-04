import { Moon, Sun } from "lucide-react";
import { useTheme } from "../theme/useTheme";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";

  return <button type="button" onClick={toggleTheme} aria-label={label} title={label} className={`theme-toggle ${className}`}>
    <span className="theme-toggle-icon" aria-hidden="true">{dark ? <Sun size={17} /> : <Moon size={17} />}</span>
    <span className="theme-toggle-label">{dark ? "Light" : "Dark"}</span>
  </button>;
}
