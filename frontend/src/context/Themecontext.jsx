import { createContext, useState, useEffect } from "react";

export const ThemeContext = createContext();

const themes = {
  blue: {
    bg: "#0f172a",
    sidebar: "#111827",
    card: "#1e293b",
    text: "#ffffff",
    primary: "#3b82f6",
  },
  green: {
    bg: "#022c22",
    sidebar: "#013220",
    card: "#064e3b",
    text: "#d1fae5",
    primary: "#10b981",
  },
  purple: {
    bg: "#1e1b4b",
    sidebar: "#2e1065",
    card: "#312e81",
    text: "#e0e7ff",
    primary: "#8b5cf6",
  },
  orange: {
    bg: "#431407",
    sidebar: "#7c2d12",
    card: "#9a3412",
    text: "#ffedd5",
    primary: "#f97316",
  },
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState("blue");

  useEffect(() => {
    const selected = themes[theme];

    Object.entries(selected).forEach(([key, value]) => {
      document.documentElement.style.setProperty(`--${key}`, value);
    });

    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved) setTheme(saved);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
};