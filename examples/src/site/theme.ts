import { useEffect, useState } from "react";

export type Theme = "system" | "light" | "dark";

const query = () => matchMedia("(prefers-color-scheme: dark)");

function read(): Theme {
  try {
    const t = localStorage.getItem("theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && query().matches);
  document.documentElement.classList.toggle("dark", dark);
}

/** The chosen theme, saved per browser; "system" follows the OS setting. */
export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState(read);
  useEffect(() => {
    applyTheme(theme);
    try {
      if (theme === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", theme);
    } catch {
      // Storage can be unavailable; the theme still applies for this visit
    }
    if (theme !== "system") return;
    const mq = query();
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);
  return [theme, setTheme];
}
