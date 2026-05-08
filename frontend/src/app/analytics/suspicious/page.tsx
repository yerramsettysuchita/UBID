"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getSuspiciousSignals, getAtRiskBusinesses } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";

const SEV_META: Record<string, { bg: string; color: string; border: string }> = {
  CRITICAL: { bg: "var(--closed-lt)",  color: "var(--closed)",  border: "rgba(127,29,29,0.30)"  },
  HIGH:     { bg: "var(--dormant-lt)", color: "var(--dormant)", border: "rgba(146,64,14,0.30)"  },
  MEDIUM:   { bg: "var(--gold-lt)",    color: "var(--gold-dk)", border: "rgba(184,132,12,0.30)" },
  LOW:      { bg: "var(--active-lt)",  color: "var(--active)",  border: "rgba(26,107,74,0.25)"  },
};

const TYPE_ICONS: Record<string, string> = {
  SHARED_ADDRESS:              "◈",
  SHARED_PAN:                  "⊙",
  DORMANT_WITH_ACTIVITY:       "⬡",
  LARGE_CLUSTER_LOW_CONFIDENCE:"⊞",
  LOW_CONFIDENCE_MULTI_DEPT:   "◧",
  MULTIPLE_OPEN_REVIEWS:       "⚠",
};

const TYPE_DESCRIPTIONS: Record<string, string> = {
  SHARED_ADDRESS:              "Multiple businesses at the same physical address — possible branch consolidation candidate",
  SHARED_PAN:                  "Same PAN number across distinct entities — may represent the same legal entity",
  DORMANT_WITH_ACTIVITY:       "Marked dormant but shows recent transactional activity across departments",
  LARGE_CLUSTER_LOW_CONFIDENCE:"Cluster with many source records but low entity resolution confidence",
  LOW_CONFIDENCE_MULTI_DEPT:   "Spans multiple departments but identity linkage confidence is low",
  MULTIPLE_OPEN_REVIEWS:       "Multiple open review cases create uncertainty about identity",
};

function SeverityBadge({ severity }: { severity: string }) {
  const c = SEV_META[severity] ?? SEV_META.LOW;
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 5,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      fontFamily: "'Poppins', sans-serif",
    }}>{severity}</span>
  );
}

export default function SuspiciousClustersPage() {
  const [severity, setSeverity] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"signals" | "atrisk">("signals");

  const { data, isLoading } = useQuery({
    queryKey: ["suspicious-signals", severity, page],
    queryFn: () => getSuspiciousSignals({
      severity: severity === "ALL" ? undefined : severity,
      page,
    }).then((r) => r.data),
    enabled: activeTab === "signals",
  });

  const { data: atRisk } = useQuery({
    queryKey: ["at-risk-businesses"],
    queryFn: () => getAtRiskBusinesses(0.4).then((r) => r.data),
    enabled: activeTab === "atrisk",
  });

  const signals: Record<string, unknown>[] = data?.signals ?? [];
  const counts = data?.severity_counts ?? {};

  return (
    <AppShell
      title="Risk Signals"
      subtitle="AI generated fraud and anomaly signals for investigative review"
    >
      {/* Summary strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Total Signals", value: data?.total ?? 0,                               meta: SEV_META.HIGH    },
          { label: "Critical",      value: (counts as Record<string, number>).CRITICAL ?? 0, meta: SEV_META.CRITICAL },
          { label: "High",          value: (counts as Record<string, number>).HIGH ?? 0,     meta: SEV_META.HIGH    },
          { label: "Medium",        value: (counts as Record<string, number>).MEDIUM ?? 0,   meta: SEV_META.MEDIUM  },
        ].map((s, i) => (
          <div key={s.label} style={{
            background: i === 0 ? "var(--surface)" : s.meta.bg,
            borderRadius: "var(--r-lg)", padding: "14px 18px",
            border: `1px solid ${i === 0 ? "var(--edge)" : s.meta.border}`,
            borderTop: `3px solid ${s.meta.color}`,
            boxShadow: "var(--shadow-sm)",
          }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: s.meta.color, letterSpacing: "-0.02em", fontFamily: "'Poppins', serif" }}>{s.value}</div>
            <div style={{ fontSize: 11, color: s.meta.color, fontWeight: 600, marginTop: 3, fontFamily: "'Poppins', sans-serif" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 3, marginBottom: 14, background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: 4, width: "fit-content", border: "1px solid var(--edge)" }}>
        {([["signals", `Suspicious Signals (${data?.total ?? "—"})`], ["atrisk", `Dormancy At-Risk (${atRisk?.at_risk_count ?? "—"})`]] as [string, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id as typeof activeTab)} style={{
            padding: "7px 16px", borderRadius: "var(--r-sm)", fontSize: 12, fontWeight: 600,
            border: "none", cursor: "pointer", fontFamily: "'Poppins', sans-serif",
            background: activeTab === id ? "var(--surface)" : "transparent",
            color: activeTab === id ? "var(--navy)" : "var(--ink-3)",
            boxShadow: activeTab === id ? "var(--shadow-xs)" : "none",
            transition: "all 0.12s",
          }}>{label}</button>
        ))}
      </div>

      {/* Disclaimer */}
      <div style={{
        background: "#FFFBEB",
        borderRadius: "var(--r-md)",
        border: "1px solid rgba(217,119,6,0.25)",
        borderLeft: "3px solid #D97706",
        padding: "12px 16px",
        marginBottom: 14,
        fontSize: 13,
        color: "#78350F",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        fontFamily: "'Poppins', sans-serif",
      }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>⚠</span>
        <span>
          <strong style={{ color: "#92400E", fontWeight: 700 }}>Important</strong>{" "}
          These signals are investigative leads based on data patterns and are not accusations. Every signal needs a human review before any action is taken.
        </span>
      </div>

      {/* Severity filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {(["ALL", "CRITICAL", "HIGH", "MEDIUM"] as string[]).map((s) => {
          const m = SEV_META[s];
          const isActive = severity === s;
          return (
            <button key={s} onClick={() => { setSeverity(s); setPage(1); }} style={{
              padding: "6px 14px", borderRadius: "var(--r-md)", fontSize: 12, fontWeight: 700,
              cursor: "pointer", border: "1.5px solid", fontFamily: "'Poppins', sans-serif",
              borderColor: isActive ? (m?.border ?? "rgba(13,27,53,0.30)") : "var(--edge)",
              background: isActive ? (m?.bg ?? "rgba(13,27,53,0.07)") : "var(--surface)",
              color: isActive ? (m?.color ?? "var(--navy)") : "var(--ink-3)",
              transition: "all 0.12s",
            }}>
              {s === "ALL" ? "All" : s}
              {s !== "ALL" && (counts as Record<string, number>)[s] !== undefined
                ? ` (${(counts as Record<string, number>)[s]})` : ""}
            </button>
          );
        })}
      </div>

      {/* Signals list */}
      {activeTab === "signals" && (
        <>
          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1,2,3].map((i) => <div key={i} className="skeleton" style={{ height: 120, borderRadius: "var(--r-lg)" }} />)}
            </div>
          ) : signals.length === 0 ? (
            <div style={{
              background: "var(--surface)", borderRadius: "var(--r-lg)",
              border: "1px solid var(--edge)", padding: "60px 0",
              textAlign: "center", color: "var(--ink-3)", boxShadow: "var(--shadow-sm)",
            }}>
              <div style={{ fontSize: 32, opacity: 0.2, marginBottom: 12 }}>⊛</div>
              No suspicious signals found {severity !== "ALL" ? `for severity: ${severity}` : ""}.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {signals.map((sig) => {
                const sev = sig.severity as string;
                const m = SEV_META[sev] ?? SEV_META.LOW;
                const entities = sig.entities_involved as Record<string, unknown>[];
                const icon = TYPE_ICONS[sig.type as string] ?? "◉";
                const typeDesc = TYPE_DESCRIPTIONS[sig.type as string];
                return (
                  <div key={sig.id as string} style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", border: `1px solid ${m.border}`, overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
                    <div style={{ background: m.bg, padding: "12px 16px", borderBottom: `1px solid ${m.border}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 20, color: m.color }}>{icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                            <SeverityBadge severity={sev} />
                            <span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>{(sig.type as string).replace(/_/g, " ")}</span>
                          </div>
                          <div style={{ fontWeight: 800, fontSize: 14, color: "var(--ink)", fontFamily: "'Poppins', serif" }}>{sig.title as string}</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 22, fontWeight: 900, color: m.color, fontFamily: "'Poppins', serif" }}>{sig.total_entities as number}</div>
                          <div style={{ fontSize: 10, color: "var(--ink-3)" }}>entities</div>
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: "12px 16px" }}>
                      <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 6, lineHeight: 1.5 }}>{sig.description as string}</div>
                      {typeDesc && (
                        <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 10 }}>{typeDesc}</div>
                      )}

                      {entities.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-2)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Poppins', sans-serif" }}>Involved Entities</div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {entities.map((e) => (
                              <Link key={e.ubid as string} href={`/business/${e.ubid}`} style={{ textDecoration: "none" }}>
                                <div style={{ padding: "5px 10px", borderRadius: "var(--r-md)", background: "var(--surface-2)", border: "1px solid var(--edge)", fontSize: 12, transition: "border-color 0.1s" }}
                                  onMouseEnter={(el) => (el.currentTarget.style.borderColor = "var(--gold)")}
                                  onMouseLeave={(el) => (el.currentTarget.style.borderColor = "var(--edge)")}
                                >
                                  <div style={{ fontWeight: 600, color: "var(--navy)", fontFamily: "'Poppins', sans-serif" }}>{(e.name as string).slice(0, 30)}</div>
                                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3 }}>
                                    <StatusBadge status={e.status as string} size="sm" />
                                    <code style={{ fontSize: 9, color: "var(--ink-3)", fontFamily: "'JetBrains Mono', monospace" }}>{e.ubid as string}</code>
                                  </div>
                                </div>
                              </Link>
                            ))}
                            {(sig.total_entities as number) > entities.length && (
                              <div style={{ padding: "5px 10px", borderRadius: "var(--r-md)", background: "var(--surface-2)", border: "1px solid var(--edge)", fontSize: 12, color: "var(--ink-3)" }}>
                                +{(sig.total_entities as number) - entities.length} more
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div style={{ background: "var(--surface-2)", borderRadius: "var(--r-sm)", padding: "8px 12px", border: "1px solid var(--edge)", fontSize: 12, marginBottom: 10 }}>
                        <span style={{ fontWeight: 700, color: "var(--ink-2)" }}>Recommended action: </span>
                        <span style={{ color: "var(--ink-3)" }}>{sig.recommended_action as string}</span>
                      </div>

                      {entities.length > 0 && (
                        <div style={{ display: "flex", gap: 8 }}>
                          <Link href={`/graph/${entities[0].ubid}`} style={{
                            display: "inline-block", padding: "7px 14px",
                            background: "var(--navy)", color: "#fff", borderRadius: "var(--r-md)",
                            fontSize: 12, fontWeight: 600, textDecoration: "none", fontFamily: "'Poppins', sans-serif",
                            boxShadow: "0 2px 8px rgba(13,27,53,0.22)",
                          }}>
                            Investigate in Graph →
                          </Link>
                          <Link href={`/business/${entities[0].ubid}`} style={{
                            display: "inline-block", padding: "7px 14px",
                            background: "var(--surface)", color: "var(--navy)", borderRadius: "var(--r-md)",
                            fontSize: 12, fontWeight: 600, textDecoration: "none",
                            border: "1.5px solid var(--navy)", fontFamily: "'Poppins', sans-serif",
                          }}>
                            Business Profile
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {data && (data.pages as number) > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
              {[
                { label: "← Prev", disabled: page === 1, onClick: () => setPage(page - 1) },
                { label: `Page ${page} of ${data.pages}`, disabled: true, onClick: () => {} },
                { label: "Next →", disabled: page >= (data.pages as number), onClick: () => setPage(page + 1) },
              ].map((btn) => (
                <button key={btn.label} disabled={btn.disabled} onClick={btn.onClick} style={{
                  border: "1.5px solid var(--edge)", borderRadius: "var(--r-md)", padding: "7px 14px",
                  background: "var(--surface)", fontSize: 12, color: "var(--ink-2)",
                  cursor: btn.disabled ? "not-allowed" : "pointer", opacity: btn.disabled ? 0.5 : 1,
                  fontFamily: "'Poppins', sans-serif",
                }}>{btn.label}</button>
              ))}
            </div>
          )}
        </>
      )}

      {/* At-risk businesses tab */}
      {activeTab === "atrisk" && (
        <div>
          {!atRisk ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}>Loading dormancy predictions…</div>
          ) : (
            <div>
              <div style={{ background: "var(--dormant-lt)", borderRadius: "var(--r-md)", border: "1px solid rgba(146,64,14,0.25)", padding: "12px 16px", marginBottom: 14, fontSize: 12, color: "var(--dormant)" }}>
                <strong>ML Dormancy Predictor:</strong> {atRisk.at_risk_count} of {atRisk.total_active} active businesses show elevated dormancy risk (≥40% probability). Model: GradientBoosting trained on 8 behavioral features.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(atRisk.businesses as Record<string, unknown>[]).map((biz) => {
                  const prob = Math.round((biz.dormancy_probability as number) * 100);
                  const color = biz.tier_color as string;
                  return (
                    <div key={biz.ubid as string} style={{
                      background: "var(--surface)", borderRadius: "var(--r-md)",
                      border: "1px solid var(--edge)", padding: "14px 16px",
                      borderLeft: `4px solid ${color}`,
                      boxShadow: "var(--shadow-xs)",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 5, background: `${color}15`, color, fontFamily: "'Poppins', sans-serif" }}>
                              {biz.risk_tier as string}
                            </span>
                            <span style={{ fontWeight: 700, color: "var(--ink)", fontSize: 13, fontFamily: "'Poppins', sans-serif" }}>{biz.canonical_name as string}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "'Poppins', sans-serif" }}>
                            {biz.district as string} · {biz.primary_pincode as string}
                            · {biz.dept_count as number} depts
                            · Last activity: {biz.days_since_last_event as number}d ago
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 26, fontWeight: 900, color, fontFamily: "'Poppins', serif" }}>{prob}%</div>
                          <div style={{ fontSize: 10, color: "var(--ink-3)" }}>dormancy risk</div>
                          <div style={{ marginTop: 4, display: "flex", gap: 4 }}>
                            <Link href={`/business/${biz.ubid}`} style={{ fontSize: 10, padding: "3px 8px", background: "var(--navy)", color: "#fff", borderRadius: "var(--r-sm)", textDecoration: "none", fontWeight: 700 }}>Profile</Link>
                            <Link href={`/graph/${biz.ubid}`} style={{ fontSize: 10, padding: "3px 8px", background: "var(--gold-lt)", color: "var(--gold-dk)", borderRadius: "var(--r-sm)", textDecoration: "none", fontWeight: 700, border: "1px solid rgba(184,132,12,0.22)" }}>Graph</Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
