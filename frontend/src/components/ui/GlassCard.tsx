import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover3d?: boolean;
  padding?: string;
  style?: React.CSSProperties;
}

export function GlassCard({ children, className, hover3d = false, padding = "p-6", style }: GlassCardProps) {
  return (
    <div
      className={cn("glass rounded-2xl", padding, hover3d && "card-3d", className)}
      style={style}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label, value, icon, color = "primary", trend,
}: {
  label: string; value: string | number; icon?: string;
  color?: "primary" | "gold" | "green" | "red"; trend?: string;
}) {
  const palette = {
    primary: { text: "var(--navy)",    bg: "rgba(13,27,53,0.08)",   ring: "rgba(13,27,53,0.20)"    },
    gold:    { text: "var(--gold-dk)", bg: "var(--gold-lt)",         ring: "rgba(184,132,12,0.30)"  },
    green:   { text: "var(--active)",  bg: "var(--active-lt)",       ring: "rgba(26,107,74,0.25)"   },
    red:     { text: "var(--closed)",  bg: "var(--closed-lt)",       ring: "rgba(127,29,29,0.25)"   },
  }[color];

  return (
    <div className="glass card-3d rounded-2xl p-5" style={{ position: "relative", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
            {label}
          </p>
          <p style={{ fontSize: 30, fontWeight: 900, color: palette.text, lineHeight: 1 }}>{value}</p>
          {trend && <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>{trend}</p>}
        </div>
        {icon && (
          <div style={{
            width: 40, height: 40, borderRadius: 12, fontSize: 18,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: palette.bg, border: `1px solid ${palette.ring}`,
          }}>
            {icon}
          </div>
        )}
      </div>
      {/* Decorative orb */}
      <div style={{
        position: "absolute", bottom: -16, right: -16,
        width: 80, height: 80, borderRadius: "50%",
        background: palette.text, opacity: 0.07, filter: "blur(20px)",
        pointerEvents: "none",
      }} />
    </div>
  );
}
