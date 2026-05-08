"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listDistricts, getDepartmentCoverage, getRiskHighlights } from "@/lib/api";
import { AppShell } from "@/components/AppShell";

const DEPT_META: Record<string, { text: string; bg: string; border: string }> = {
  SHOPS:     { text: "var(--navy)",    bg: "rgba(13,27,53,0.07)",  border: "rgba(13,27,53,0.20)"   },
  FACTORIES: { text: "var(--dormant)", bg: "var(--dormant-lt)",    border: "rgba(146,64,14,0.22)"  },
  KSPCB:     { text: "var(--active)",  bg: "var(--active-lt)",     border: "rgba(26,107,74,0.22)"  },
  BESCOM:    { text: "var(--gold-dk)", bg: "var(--gold-lt)",       border: "rgba(184,132,12,0.22)" },
};

function HubCard({
  href, icon, title, desc, accent,
}: { href: string; icon: string; title: string; desc: string; accent: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div style={{
        background: "var(--surface)", borderRadius: "var(--r-lg)",
        border: "1px solid var(--edge)", padding: "22px 24px",
        cursor: "pointer", transition: "box-shadow 0.15s, border-color 0.15s",
        borderTop: `4px solid ${accent}`,
        boxShadow: "var(--shadow-sm)",
      }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-md)";
          (e.currentTarget as HTMLDivElement).style.borderColor = accent;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-sm)";
          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--edge)";
        }}
      >
        <div style={{ fontSize: 22, marginBottom: 10, color: accent, lineHeight: 1 }}>{icon}</div>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 5, fontFamily: "'Poppins', serif" }}>{title}</div>
        <div style={{ fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.55 }}>{desc}</div>
        <div style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: accent, fontFamily: "'Poppins', sans-serif" }}>Open →</div>
      </div>
    </Link>
  );
}

export default function AnalyticsHubPage() {
  const { data: depts } = useQuery({
    queryKey: ["dept-coverage"],
    queryFn: () => getDepartmentCoverage().then((r) => r.data),
  });

  const { data: districts } = useQuery({
    queryKey: ["districts-list"],
    queryFn: () => listDistricts().then((r) => r.data),
  });

  const { data: risks } = useQuery({
    queryKey: ["risk-highlights"],
    queryFn: () => getRiskHighlights().then((r) => r.data),
  });

  const totalRecords = (depts?.departments ?? []).reduce(
    (s: number, d: Record<string, unknown>) => s + (d.total_records as number), 0
  );

  return (
    <AppShell
      title="Analytics Hub"
      subtitle="Geographic intelligence, department coverage, risk signals, and district-level insights"
    >
      {/* Quick stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total Source Records", value: totalRecords.toLocaleString(),                  color: "var(--navy)" },
          { label: "Districts Covered",    value: (districts?.total_districts ?? "—").toString(),  color: "var(--active)" },
          { label: "SLA Breaches",         value: (risks?.sla_breach_count ?? "—").toString(),    color: "var(--closed)" },
          { label: "Old Pending (>7d)",    value: (risks?.old_pending_cases ?? "—").toString(),   color: "var(--dormant)" },
        ].map((s) => (
          <div key={s.label} style={{
            background: "var(--surface)", borderRadius: "var(--r-lg)",
            border: "1px solid var(--edge)", padding: "16px 20px",
            boxShadow: "var(--shadow-sm)", borderTop: `3px solid ${s.color}`,
          }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: s.color, fontFamily: "'Poppins', serif", letterSpacing: "-0.02em" }}>
              {s.value}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 4, fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Department coverage summary */}
      {depts?.departments?.length > 0 && (
        <div style={{
          background: "var(--surface)", borderRadius: "var(--r-lg)",
          border: "1px solid var(--edge)", padding: 20, marginBottom: 20,
          boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{ fontFamily: "'Poppins', serif", fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 14 }}>
            Department Coverage
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
            {(depts.departments as Record<string, unknown>[]).map((d) => {
              const code = d.code as string;
              const total = d.total_records as number;
              const linked = d.linked_records as number;
              const matchPct = d.match_rate_pct as number;
              const m = DEPT_META[code] ?? { text: "var(--ink-3)", bg: "var(--surface-2)", border: "var(--edge)" };
              return (
                <div key={code} style={{
                  background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: "14px 16px",
                  border: "1px solid var(--edge)", borderLeft: `4px solid ${m.text}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", fontFamily: "'Poppins', sans-serif" }}>
                      {d.name as string}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: m.text, background: m.bg, padding: "2px 8px", borderRadius: 5, border: `1px solid ${m.border}` }}>
                      {code}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 10 }}>
                    {[
                      { label: "Records",  value: total.toLocaleString() },
                      { label: "Linked",   value: linked.toLocaleString() },
                      { label: "Match %",  value: `${matchPct}%` },
                    ].map((s) => (
                      <div key={s.label} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: "var(--ink)", fontFamily: "'Poppins', serif" }}>{s.value}</div>
                        <div style={{ fontSize: 10, color: "var(--ink-3)", fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ height: 4, background: "var(--edge)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${matchPct}%`, background: m.text, borderRadius: 3, transition: "width 0.8s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Nav cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, marginBottom: 20 }}>
        <HubCard
          href="/analytics/pincode"
          icon="◎"
          title="Pincode Intelligence"
          desc="Deep-dive by pincode: business density, status distribution, risk score, department coverage, and CSV export."
          accent="var(--navy)"
        />
        <HubCard
          href="/analytics/districts"
          icon="⬡"
          title="District Analytics"
          desc="Compare all districts by active/dormant rate, review backlog, and hotspot identification."
          accent="var(--active)"
        />
        <HubCard
          href="/analytics/departments"
          icon="⊛"
          title="Department Coverage"
          desc="Track ingestion quality, identifier (PAN/GSTIN) coverage, and match rates per source department."
          accent="var(--dormant)"
        />
        <HubCard
          href="/analytics/suspicious"
          icon="⚠"
          title="Suspicious Clusters"
          desc="Surface high-risk clusters with low confidence scores, SLA breaches, and unresolved duplicates."
          accent="var(--closed)"
        />
      </div>

      {/* Risk signals */}
      {risks && (
        <div style={{
          background: "var(--dormant-lt)", borderRadius: "var(--r-lg)",
          border: "1px solid rgba(146,64,14,0.25)", padding: "16px 20px",
          boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--dormant)", marginBottom: 12, fontFamily: "'Poppins', serif" }}>
            ⚠ Active Risk Signals
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {(risks.sla_breach_count > 0) && (
              <span style={{ padding: "5px 12px", background: "var(--closed-lt)", border: "1px solid rgba(127,29,29,0.25)", borderRadius: 20, fontSize: 12, color: "var(--closed)", fontWeight: 700 }}>
                {risks.sla_breach_count} SLA breach{risks.sla_breach_count !== 1 ? "es" : ""}
              </span>
            )}
            {(risks.old_pending_cases > 0) && (
              <span style={{ padding: "5px 12px", background: "var(--closed-lt)", border: "1px solid rgba(127,29,29,0.25)", borderRadius: 20, fontSize: 12, color: "var(--closed)", fontWeight: 700 }}>
                {risks.old_pending_cases} overdue &gt;7d
              </span>
            )}
            {(risks.high_risk_districts as Record<string, unknown>[])?.slice(0, 4).map((d) => (
              <span key={(d.district ?? d.name) as string} style={{ padding: "5px 12px", background: "rgba(146,64,14,0.10)", border: "1px solid rgba(146,64,14,0.22)", borderRadius: 20, fontSize: 12, color: "var(--dormant)", fontWeight: 600 }}>
                ⬡ {(d.district ?? d.name) as string} · {d.review_needed as number} pending
              </span>
            ))}
            {(risks.high_dormancy_pincodes as Record<string, unknown>[])?.slice(0, 3).map((p) => (
              <span key={p.pincode as string} style={{ padding: "5px 12px", background: "var(--gold-lt)", border: "1px solid rgba(184,132,12,0.22)", borderRadius: 20, fontSize: 12, color: "var(--gold-dk)", fontWeight: 600 }}>
                ◎ {p.pincode as string} · {p.dormant_count as number} dormant
              </span>
            ))}
            {!risks.sla_breach_count && !risks.old_pending_cases &&
              !(risks.high_risk_districts as unknown[])?.length &&
              !(risks.high_dormancy_pincodes as unknown[])?.length && (
              <span style={{ fontSize: 13, color: "var(--ink-3)" }}>No active risk signals. All clear.</span>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
