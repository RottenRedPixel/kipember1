"use client";
import { useState, useEffect } from "react";

export default function TestPage() {
  const [count, setCount] = useState(0);
  const [jsLoaded, setJsLoaded] = useState(false);

  useEffect(() => {
    setJsLoaded(true);
  }, []);

  return (
    <div style={{
      background: "#0a0a0a", minHeight: "100vh", display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24
    }}>
      <p style={{ color: jsLoaded ? "#4ade80" : "#ef4444", fontSize: 18, fontWeight: "bold" }}>
        JS: {jsLoaded ? "✓ running" : "✗ not running"}
      </p>
      <p style={{ color: "white", fontSize: 48, fontWeight: "bold" }}>{count}</p>
      <button
        onClick={() => setCount(c => c + 1)}
        style={{
          background: "#f97316", color: "white", border: "none",
          padding: "12px 32px", borderRadius: 999, fontSize: 16,
          fontWeight: "bold", cursor: "pointer", touchAction: "manipulation"
        }}
      >
        tap me
      </button>
      <a href="/home" style={{ color: "#f97316", fontSize: 14 }}>← back to home</a>
    </div>
  );
}
