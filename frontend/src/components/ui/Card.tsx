import { cn } from "@/lib/utils";

export function Card({
  children, className, padding = "p-5",
}: { children: React.ReactNode; className?: string; padding?: string }) {
  return (
    <div className={cn("bg-white rounded-xl border", padding, className)}
      style={{ borderColor: "var(--edge)", boxShadow: "var(--shadow-sm)" }}>
      {children}
    </div>
  );
}

const ACCENT = {
  indigo: { val: "#4F46E5", bg: "rgba(79,70,229,0.07)",  border: "rgba(79,70,229,0.18)",  icon: "#4F46E5", bar: "#4F46E5" },
  amber:  { val: "#D97706", bg: "var(--dormant-lt)",     border: "rgba(217,119,6,0.22)",  icon: "#D97706", bar: "#D97706" },
  green:  { val: "#059669", bg: "var(--active-lt)",      border: "rgba(5,150,105,0.22)",  icon: "#059669", bar: "#059669" },
  red:    { val: "#DC2626", bg: "var(--closed-lt)",      border: "rgba(220,38,38,0.22)",  icon: "#DC2626", bar: "#DC2626" },
  gold:   { val: "#4F46E5", bg: "rgba(79,70,229,0.07)",  border: "rgba(79,70,229,0.22)",  icon: "#4F46E5", bar: "#4F46E5" },
};

export function KpiCard({
  label, value, delta, icon, accent = "indigo",
}: {
  label: string; value: string | number;
  delta?: string; icon: React.ReactNode;
  accent?: "indigo" | "amber" | "green" | "red" | "gold";
}) {
  const a = ACCENT[accent];
  return (
    <div className="card-lift" style={{
      background: "#fff",
      borderRadius: "var(--r-lg)",
      border: `1px solid ${a.border}`,
      padding: "16px 18px 14px",
      position: "relative", overflow: "hidden",
      boxShadow: "0 1px 3px rgba(13,13,26,0.06),0 4px 16px rgba(79,70,229,0.05)",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: a.bar, borderRadius: "var(--r-lg) var(--r-lg) 0 0",
        opacity: 0.85,
      }} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, marginTop: 2 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: a.bg, border: `1px solid ${a.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, color: a.icon,
        }}>{icon}</div>
        <div style={{
          fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)",
          textTransform: "uppercase", letterSpacing: "0.07em", lineHeight: 1.2,
          fontFamily: "'Poppins', sans-serif",
        }}>
          {label}
        </div>
      </div>

      <div style={{
        fontSize: 28, fontWeight: 700, color: a.val,
        fontFamily: "'Poppins', sans-serif",
        letterSpacing: "-0.02em", lineHeight: 1, marginBottom: 4,
      }}>{value}</div>

      {delta && (
        <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "'Poppins', sans-serif" }}>{delta}</div>
      )}

      <div style={{
        position: "absolute", bottom: -4, right: 10,
        fontSize: 38, color: a.bar, opacity: 0.05,
        fontFamily: "'Poppins', sans-serif",
        pointerEvents: "none", lineHeight: 1, userSelect: "none",
      }}>{icon}</div>
    </div>
  );
}
