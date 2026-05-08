"use client";

interface PageBannerProps {
  icon: string;
  what: string;
  why?: string;
  steps?: unknown;
  tip?: string;
  roles?: string;
  color?: "indigo" | "green" | "amber" | "red" | "purple";
}

const COLOR_MAP = {
  indigo: { accent: "#4F46E5", light: "#F5F6FF", border: "rgba(79,70,229,0.14)", text: "#3D3D5C", dot: "#818CF8" },
  green:  { accent: "#059669", light: "#F0FDF9", border: "rgba(5,150,105,0.14)",  text: "#3D3D5C", dot: "#34D399" },
  amber:  { accent: "#D97706", light: "#FFFDF0", border: "rgba(217,119,6,0.14)",  text: "#3D3D5C", dot: "#FCD34D" },
  red:    { accent: "#DC2626", light: "#FFF5F5", border: "rgba(220,38,38,0.14)",  text: "#3D3D5C", dot: "#FCA5A5" },
  purple: { accent: "#7C3AED", light: "#F8F5FF", border: "rgba(124,58,237,0.14)", text: "#3D3D5C", dot: "#C4B5FD" },
};

export function PageBanner({ icon, what, roles, color = "indigo" }: PageBannerProps) {
  const c = COLOR_MAP[color];

  return (
    <div style={{
      background: c.light,
      border: `1px solid ${c.border}`,
      borderLeft: `3px solid ${c.accent}`,
      borderRadius: 10,
      padding: "13px 18px",
      marginBottom: 22,
      display: "flex",
      alignItems: "center",
      gap: 14,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
        background: `${c.accent}15`,
        border: `1px solid ${c.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 17,
      }}>
        {icon}
      </div>

      <p style={{
        flex: 1,
        fontSize: 13.5,
        color: c.text,
        lineHeight: 1.65,
        fontFamily: "'Poppins', sans-serif",
        fontWeight: 400,
        margin: 0,
      }}>
        {what}
      </p>

      {roles && (
        <div style={{
          flexShrink: 0,
          display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end",
          maxWidth: 200,
        }}>
          {roles.split(", ").map((r) => (
            <span key={r} style={{
              fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
              background: `${c.accent}12`,
              color: c.accent,
              border: `1px solid ${c.border}`,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              fontFamily: "'Poppins', sans-serif",
            }}>
              {r.trim()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
