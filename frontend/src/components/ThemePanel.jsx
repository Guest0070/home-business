import { useState, useContext, useEffect, useRef } from "react";
import { ThemeContext } from "../context/ThemeContext";

export default function ThemePanel() {
  const [open, setOpen] = useState(false);
  const { setTheme, themes, theme } = useContext(ThemeContext);
  const panelRef = useRef();

  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <>
      <div
        onClick={() => setOpen(!open)}
        style={{
          position: "fixed",
          bottom: "20px",
          left: "20px",
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "var(--primary)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 1000,
          fontSize: "22px",
        }}
      >
        🎨
      </div>

      <div
        ref={panelRef}
        style={{
          position: "fixed",
          bottom: open ? "90px" : "60px",
          left: "20px",
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0)" : "translateY(20px)",
          pointerEvents: open ? "auto" : "none",
          transition: "all 0.3s ease",
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(10px)",
          padding: "16px",
          borderRadius: "12px",
        }}
      >
        {Object.entries(themes).map(([name, colors]) => (
          <div
            key={name}
            onClick={() => setTheme(name)}
            style={{
              marginBottom: "8px",
              cursor: "pointer",
              padding: "6px",
              border:
                theme === name
                  ? "2px solid var(--primary)"
                  : "2px solid transparent",
            }}
          >
            {name}
          </div>
        ))}
      </div>
    </>
  );
}