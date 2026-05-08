"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";

const NAV = [
  {
    section: "DISCOVERY",
    items: [
      { href: "/search",   label: "Business Search",    icon: "⊛", roles: ["OFFICER","REVIEWER","SUPERVISOR","ADMIN","AUDITOR"] },
      { href: "/lookup",   label: "UBID Lookup",        icon: "◎", roles: ["OFFICER","SUPERVISOR","ADMIN"] },
      { href: "/pincode",  label: "Pincode Lookup",     icon: "⊙", roles: ["OFFICER","REVIEWER","SUPERVISOR","ADMIN","AUDITOR"] },
      { href: "/query",    label: "Intelligence Query", icon: "⊕", roles: ["OFFICER","REVIEWER","SUPERVISOR","ADMIN","AUDITOR"] },
    ],
  },
  {
    section: "REVIEW",
    items: [
      { href: "/review",              label: "Review Queue",       icon: "◧", roles: ["REVIEWER","SUPERVISOR","AUDITOR"] },
      { href: "/operations/clusters", label: "Cluster Management", icon: "⊞", roles: ["SUPERVISOR","ADMIN","AUDITOR","REVIEWER"] },
    ],
  },
  {
    section: "ANALYTICS",
    items: [
      { href: "/analytics/pincode",     label: "Pincode Analytics", icon: "◎", roles: ["SUPERVISOR","ADMIN","AUDITOR"] },
      { href: "/analytics/districts",   label: "Districts",         icon: "⬡", roles: ["SUPERVISOR","ADMIN","AUDITOR"] },
      { href: "/analytics/departments", label: "Departments",       icon: "⊟", roles: ["SUPERVISOR","ADMIN","AUDITOR"] },
      { href: "/analytics/suspicious",  label: "Risk Signals",      icon: "◈", roles: ["SUPERVISOR","ADMIN","AUDITOR"] },
    ],
  },
  {
    section: "COMMAND",
    items: [
      { href: "/dashboard", label: "Supervisor View", icon: "▦", roles: ["SUPERVISOR","ADMIN","AUDITOR"] },
      { href: "/admin",     label: "Administration",  icon: "⊠", roles: ["ADMIN"] },
    ],
  },
];

const ROLE_META: Record<string, { color: string; bg: string; glow: string; label: string }> = {
  OFFICER:    { color: "#818CF8", bg: "rgba(129,140,248,0.15)", glow: "rgba(129,140,248,0.25)", label: "Officer" },
  REVIEWER:   { color: "#A78BFA", bg: "rgba(167,139,250,0.15)", glow: "rgba(167,139,250,0.25)", label: "Reviewer" },
  SUPERVISOR: { color: "#F59E0B", bg: "rgba(245,158,11,0.15)",  glow: "rgba(245,158,11,0.25)",  label: "Supervisor" },
  ADMIN:      { color: "#34D399", bg: "rgba(52,211,153,0.15)",  glow: "rgba(52,211,153,0.25)",  label: "Administrator" },
  AUDITOR:    { color: "#94A3B8", bg: "rgba(148,163,184,0.15)", glow: "rgba(148,163,184,0.25)", label: "Auditor" },
};

export function NavSidebar() {
  const { user, clearAuth } = useAuthStore();
  const pathname = usePathname();
  const router   = useRouter();

  const roleMeta = ROLE_META[user?.role ?? "AUDITOR"] ?? ROLE_META.AUDITOR;

  const visibleSections = NAV.map((sec) => ({
    ...sec,
    items: sec.items.filter((n) => user && n.roles.includes(user.role)),
  })).filter((sec) => sec.items.length > 0);

  return (
    <aside style={{
      width: 228,
      height: "100vh",
      flexShrink: 0,
      background: "var(--navy)",
      display: "flex",
      flexDirection: "column",
      position: "sticky",
      top: 0,
      overflowY: "auto",
      borderRight: "1px solid rgba(99,102,241,0.12)",
    }}>

      {/* ── Logo ── */}
      <div style={{
        padding: "22px 18px 18px",
        borderBottom: "1px solid rgba(99,102,241,0.12)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9, flexShrink: 0,
            background: "linear-gradient(135deg, #4F46E5 0%, #818CF8 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 14px rgba(79,70,229,0.40)",
          }}>
            <span style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 800, fontSize: 16, color: "#fff" }}>U</span>
          </div>
          <div>
            <div style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 16, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.2,
            }}>
              UBID
            </div>
            <div style={{
              fontSize: 9, color: "rgba(199,210,254,0.45)", marginTop: 1,
              letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600,
              fontFamily: "'Poppins', sans-serif",
            }}>
              Karnataka Commerce
            </div>
          </div>
        </div>
      </div>

      {/* ── Nav sections ── */}
      <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
        {visibleSections.map((sec) => (
          <div key={sec.section} style={{ marginBottom: 18 }}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.22)",
              textTransform: "uppercase", padding: "0 10px",
              marginBottom: 4, fontFamily: "'Poppins', sans-serif",
            }}>
              {sec.section}
            </div>

            {sec.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link key={item.href} href={item.href} style={{ display: "block", marginBottom: 2 }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 9,
                    padding: "8px 10px", borderRadius: 8,
                    background: active ? "rgba(99,102,241,0.18)" : "transparent",
                    border: active
                      ? "1px solid rgba(99,102,241,0.32)"
                      : "1px solid transparent",
                    color: active ? "#C7D2FE" : "rgba(255,255,255,0.48)",
                    fontWeight: active ? 600 : 400,
                    fontSize: 12.5,
                    transition: "all 0.15s",
                    cursor: "pointer",
                    position: "relative",
                    fontFamily: "'Poppins', sans-serif",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.05)";
                      (e.currentTarget as HTMLDivElement).style.color = "rgba(255,255,255,0.75)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLDivElement).style.background = "transparent";
                      (e.currentTarget as HTMLDivElement).style.color = "rgba(255,255,255,0.48)";
                    }
                  }}
                  >
                    {active && (
                      <div style={{
                        position: "absolute", left: 0, top: "50%",
                        transform: "translateY(-50%)",
                        width: 2.5, height: 16, borderRadius: 2,
                        background: "#818CF8",
                        boxShadow: "0 0 8px rgba(129,140,248,0.6)",
                      }} />
                    )}

                    <span style={{
                      fontSize: 13, width: 18, textAlign: "center", flexShrink: 0,
                      color: active ? "#818CF8" : "rgba(255,255,255,0.30)",
                      transition: "color 0.15s",
                    }}>
                      {item.icon}
                    </span>

                    <span style={{ flex: 1, letterSpacing: "0.01em" }}>{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Divider glow ── */}
      <div style={{
        height: 1,
        background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.3), transparent)",
        margin: "0 16px",
      }} />

      {/* ── User card ── */}
      {user && (
        <div style={{ padding: "12px 8px 16px" }}>
          <div style={{
            background: "rgba(255,255,255,0.04)",
            borderRadius: 10,
            padding: "10px 12px",
            border: "1px solid rgba(99,102,241,0.14)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: roleMeta.bg,
                border: `1.5px solid ${roleMeta.glow}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: roleMeta.color, fontWeight: 800, fontSize: 13,
                fontFamily: "'Poppins', sans-serif",
                boxShadow: `0 0 12px ${roleMeta.glow}`,
              }}>
                {user.full_name.charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontWeight: 600, fontSize: 12.5, color: "#E0E7FF",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  fontFamily: "'Poppins', sans-serif",
                }}>
                  {user.full_name}
                </div>
                <div style={{
                  fontSize: 9.5, marginTop: 1, fontWeight: 700,
                  color: roleMeta.color,
                  letterSpacing: "0.05em", textTransform: "uppercase",
                  fontFamily: "'Poppins', sans-serif",
                }}>
                  {roleMeta.label}
                </div>
              </div>
            </div>

            <button
              onClick={() => { clearAuth(); router.replace("/"); }}
              style={{
                width: "100%",
                border: "1px solid rgba(99,102,241,0.18)",
                borderRadius: 6,
                background: "transparent",
                color: "rgba(199,210,254,0.40)",
                fontSize: 11, fontWeight: 600, padding: "6px 0",
                cursor: "pointer",
                fontFamily: "'Poppins', sans-serif",
                transition: "all 0.15s",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget).style.borderColor = "rgba(220,38,38,0.40)";
                (e.currentTarget).style.color = "#F87171";
                (e.currentTarget).style.background = "rgba(220,38,38,0.07)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget).style.borderColor = "rgba(99,102,241,0.18)";
                (e.currentTarget).style.color = "rgba(199,210,254,0.40)";
                (e.currentTarget).style.background = "transparent";
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
