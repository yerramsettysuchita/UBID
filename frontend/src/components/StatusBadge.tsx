"use client";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  ACTIVE:        { label: "Active",       color: "var(--active)",  bg: "var(--active-lt)",  border: "rgba(26,107,74,0.25)",  dot: "#1A6B4A" },
  DORMANT:       { label: "Dormant",      color: "var(--dormant)", bg: "var(--dormant-lt)", border: "rgba(146,64,14,0.25)",  dot: "#92400E" },
  CLOSED:        { label: "Closed",       color: "var(--closed)",  bg: "var(--closed-lt)",  border: "rgba(127,29,29,0.25)",  dot: "#7F1D1D" },
  REVIEW_NEEDED: { label: "Needs Review", color: "var(--review)",  bg: "var(--review-lt)",  border: "rgba(55,65,81,0.20)",   dot: "#374151" },
  PENDING:       { label: "Pending",      color: "#1E40AF",        bg: "#EFF6FF",           border: "rgba(30,64,175,0.20)",  dot: "#2563EB" },
  APPROVED:      { label: "Approved",     color: "var(--active)",  bg: "var(--active-lt)",  border: "rgba(26,107,74,0.25)",  dot: "#1A6B4A" },
  REJECTED:      { label: "Rejected",     color: "var(--closed)",  bg: "var(--closed-lt)",  border: "rgba(127,29,29,0.25)",  dot: "#7F1D1D" },
  ESCALATED:     { label: "Escalated",    color: "var(--dormant)", bg: "var(--dormant-lt)", border: "rgba(146,64,14,0.25)",  dot: "#92400E" },
  RUNNING:       { label: "Running",      color: "#1E40AF",        bg: "#EFF6FF",           border: "rgba(30,64,175,0.20)",  dot: "#2563EB" },
  COMPLETED:     { label: "Completed",    color: "var(--active)",  bg: "var(--active-lt)",  border: "rgba(26,107,74,0.25)",  dot: "#1A6B4A" },
  FAILED:        { label: "Failed",       color: "var(--closed)",  bg: "var(--closed-lt)",  border: "rgba(127,29,29,0.25)",  dot: "#7F1D1D" },
};

interface Props { status: string; size?: "sm" | "md" | "lg"; showDot?: boolean; }

export function StatusBadge({ status, size = "md", showDot = true }: Props) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status, color: "var(--ink-3)", bg: "var(--surface-2)", border: "var(--edge)", dot: "var(--ink-3)",
  };
  const sz = { sm: { f: "10px", p: "2px 7px", d: 5, g: 5 }, md: { f: "11px", p: "3px 9px", d: 6, g: 6 }, lg: { f: "12px", p: "4px 11px", d: 7, g: 7 } }[size];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: sz.g,
      fontSize: sz.f, fontWeight: 600, padding: sz.p,
      borderRadius: 20, letterSpacing: "0.03em",
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.border}`,
      whiteSpace: "nowrap", fontFamily: "'Poppins', sans-serif",
    }}>
      {showDot && <span style={{ width: sz.d, height: sz.d, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />}
      {cfg.label}
    </span>
  );
}
