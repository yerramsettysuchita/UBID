"use client";

import { useEffect, useState } from "react";
import { NavSidebar } from "./NavSidebar";
import { ErrorBoundary } from "./ErrorBoundary";

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

function LiveClock() {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    function tick() {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!time) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        width: 6, height: 6, borderRadius: "50%",
        background: "#34D399",
        boxShadow: "0 0 0 3px rgba(52,211,153,0.18)",
        flexShrink: 0,
        animation: "pulse-gold 2s infinite",
      }} />
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11, color: "var(--ink-3)",
        letterSpacing: "0.06em",
        background: "var(--surface-2)",
        border: "1px solid var(--edge)",
        borderRadius: 20,
        padding: "3px 10px",
      }}>
        {time} <span style={{ color: "var(--edge-2)", fontSize: 9 }}>IST</span>
      </div>
    </div>
  );
}

export function AppShell({ children, title, subtitle, actions }: AppShellProps) {
  return (
    <div style={{
      display: "flex",
      height: "100vh",
      background: "var(--parchment)",
      overflow: "hidden",
    }}>
      <NavSidebar />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Top header bar */}
        {(title || actions) && (
          <header style={{
            background: "var(--surface)",
            borderBottom: "1px solid var(--edge)",
            padding: "0 32px",
            height: 66,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
            position: "relative",
          }}>
            {/* Indigo accent line — full width with fade */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 2,
              background: "linear-gradient(90deg, #4F46E5 0%, #818CF8 40%, rgba(129,140,248,0.15) 70%, transparent 100%)",
              pointerEvents: "none",
            }} />

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {title && (
                <h1 style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 17, color: "var(--ink)",
                  fontWeight: 700, lineHeight: 1, letterSpacing: "-0.01em",
                  whiteSpace: "nowrap",
                }}>
                  {title}
                </h1>
              )}
              {title && subtitle && (
                <div style={{
                  width: 1, height: 20, flexShrink: 0,
                  background: "var(--edge-2)",
                }} />
              )}
              {subtitle && (
                <p style={{
                  fontSize: 13, color: "var(--ink-3)", fontWeight: 400,
                  fontFamily: "'Poppins', sans-serif",
                  lineHeight: 1, margin: 0,
                }}>
                  {subtitle}
                </p>
              )}
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <LiveClock />
              {actions && (
                <div style={{
                  display: "flex", gap: 8, alignItems: "center",
                  paddingLeft: 12,
                  borderLeft: "1px solid var(--edge)",
                }}>
                  {actions}
                </div>
              )}
            </div>
          </header>
        )}

        {/* Main scrollable content */}
        <main style={{
          flex: 1,
          overflowY: "auto",
          padding: "28px 32px",
        }}>
          <ErrorBoundary>
            <div className="fade-in">
              {children}
            </div>
          </ErrorBoundary>
        </main>

        {/* Footer strip */}
        <div style={{
          height: 30,
          background: "var(--surface)",
          borderTop: "1px solid var(--edge)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--gold)", opacity: 0.5 }} />
            <span style={{ fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.07em", textTransform: "uppercase", fontWeight: 600 }}>
              Karnataka Commerce &amp; Industry · AI for Bharat 2026
            </span>
          </div>
          <span style={{ fontSize: 9.5, color: "var(--edge-2)", letterSpacing: "0.05em", fontFamily: "'JetBrains Mono', monospace" }}>UBID · v2.0</span>
        </div>
      </div>
    </div>
  );
}
