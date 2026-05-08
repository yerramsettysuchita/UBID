"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  getBusinessProfile, getTimeline, getReviewHistory,
  getBusinessGraph, getNearbyBusinesses, getBusinessHealthScore,
} from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { AppShell } from "@/components/AppShell";
import { RelationshipGraph, GraphNode, GraphEdge } from "@/components/RelationshipGraph";

const DEPT_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  SHOPS:     { text: "#1E40AF", bg: "#EFF6FF", border: "rgba(30,64,175,0.20)" },
  FACTORIES: { text: "#92400E", bg: "#FEF3E2", border: "rgba(146,64,14,0.22)" },
  KSPCB:     { text: "#1A6B4A", bg: "#E8F5EE", border: "rgba(26,107,74,0.22)" },
  BESCOM:    { text: "#6D28D9", bg: "#EDE9FE", border: "rgba(109,40,217,0.20)" },
};

const EVENT_COLOR: Record<string, string> = {
  INSPECTION: "var(--navy)", RENEWAL: "var(--active)", METER_READ: "#6D28D9",
  FILING: "var(--dormant)", NOTICE: "var(--closed)", CLOSURE: "var(--ink-3)", REGISTRATION: "#0D9488",
};

const SEV_CONFIG: Record<string, { bg: string; color: string; border: string }> = {
  CRITICAL: { bg: "var(--closed-lt)", color: "var(--closed)",  border: "rgba(127,29,29,0.25)" },
  HIGH:     { bg: "#FFF7ED",          color: "#C2410C",         border: "rgba(194,65,12,0.22)" },
  MEDIUM:   { bg: "var(--dormant-lt)",color: "var(--dormant)", border: "rgba(146,64,14,0.22)" },
};

function InfoPill({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{
        fontSize: 9.5, fontWeight: 700, color: "var(--ink-3)",
        textTransform: "uppercase", letterSpacing: "0.08em",
        fontFamily: "'Poppins', sans-serif",
      }}>{label}</span>
      <span style={{
        fontSize: 11.5, fontWeight: 600, color: "var(--ink)",
        fontFamily: mono ? "'JetBrains Mono', monospace" : "'Poppins', sans-serif",
        background: mono ? "var(--gold-lt)" : "var(--surface-2)",
        padding: "3px 9px", borderRadius: 5,
        border: mono ? "1px solid rgba(184,132,12,0.22)" : "1px solid var(--edge)",
      }}>{value}</span>
    </div>
  );
}

type Tab = "records" | "timeline" | "health" | "history" | "relationships";

export default function BusinessProfilePage() {
  const { ubid } = useParams() as { ubid: string };
  const [tab, setTab] = useState<Tab>("records");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["business", ubid],
    queryFn: () => getBusinessProfile(ubid).then((r) => r.data),
  });
  const { data: timeline } = useQuery({
    queryKey: ["timeline", ubid],
    queryFn: () => getTimeline(ubid).then((r) => r.data),
    enabled: !!ubid,
  });
  const { data: reviewHistory } = useQuery({
    queryKey: ["review-history", ubid],
    queryFn: () => getReviewHistory(ubid).then((r) => r.data),
    enabled: !!ubid,
  });
  const { data: graphData } = useQuery({
    queryKey: ["business-graph", ubid],
    queryFn: () => getBusinessGraph(ubid).then((r) => r.data),
    enabled: !!ubid,
  });
  const { data: healthScore } = useQuery({
    queryKey: ["health-score", ubid],
    queryFn: () => getBusinessHealthScore(ubid).then((r) => r.data),
    enabled: !!ubid && tab === "health",
  });
  const { data: nearbyData } = useQuery({
    queryKey: ["business-nearby", ubid],
    queryFn: () => getNearbyBusinesses(ubid, 5).then((r) => r.data),
    enabled: !!ubid && tab === "relationships",
  });

  if (isLoading) return (
    <AppShell>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[160, 60, 240].map((h, i) => (
          <div key={i} className="skeleton" style={{ height: h, borderRadius: "var(--r-lg)" }} />
        ))}
      </div>
    </AppShell>
  );

  if (!profile) return (
    <AppShell>
      <div style={{ textAlign: "center", padding: 60, color: "var(--ink-3)", fontFamily: "'Poppins', serif", fontSize: 15 }}>
        Business not found.
      </div>
    </AppShell>
  );

  const depts: string[] = profile.department_coverage ?? [];
  const reviewCases: Record<string, unknown>[] = reviewHistory?.review_cases ?? [];
  const suspSignals: Record<string, unknown>[] = graphData?.suspicious_signals ?? [];
  const conf = Math.round((profile.confidence_score ?? 0) * 100);

  const TABS: { id: Tab; label: string }[] = [
    { id: "records",       label: `Linked Records (${profile.linked_records?.length ?? 0})` },
    { id: "timeline",      label: `Activity Timeline (${timeline?.events?.length ?? 0})` },
    { id: "health",        label: "Health Score" },
    { id: "history",       label: `Reviewer History (${reviewCases.length})` },
    { id: "relationships", label: `Relationships${suspSignals.length > 0 ? ` · ⚠ ${suspSignals.length}` : ""}` },
  ];

  return (
    <AppShell
      title={profile.canonical_name}
      subtitle={`${profile.district ?? ""}${profile.primary_pincode ? `  ${profile.primary_pincode}` : ""}`}
      actions={
        <Link href={`/graph/${ubid}`} style={{
          padding: "8px 16px", borderRadius: "var(--r-md)",
          background: "var(--navy)", color: "#fff",
          fontWeight: 600, fontSize: 12, display: "block",
          boxShadow: "0 4px 12px rgba(13,27,53,0.25)",
          fontFamily: "'Poppins', sans-serif", letterSpacing: "0.01em",
        }}>
          Investigate in Graph →
        </Link>
      }
    >
      {/* Hero card */}
      <div style={{
        background: "var(--surface)", borderRadius: "var(--r-lg)",
        border: "1px solid var(--edge)", padding: "20px 24px", marginBottom: 12,
        boxShadow: "var(--shadow-sm)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <StatusBadge status={profile.status} size="md" />
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                background: conf >= 90 ? "var(--active-lt)" : conf >= 70 ? "var(--dormant-lt)" : "var(--closed-lt)",
                border: `1px solid ${conf >= 90 ? "rgba(26,107,74,0.2)" : conf >= 70 ? "rgba(146,64,14,0.2)" : "rgba(127,29,29,0.2)"}`,
                borderRadius: 20, padding: "3px 10px",
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: conf >= 90 ? "var(--active)" : conf >= 70 ? "var(--dormant)" : "var(--closed)",
                  flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: conf >= 90 ? "var(--active)" : conf >= 70 ? "var(--dormant)" : "var(--closed)",
                  fontFamily: "'Poppins', sans-serif",
                }}>
                  {conf}% · {conf >= 90 ? "ID-verified" : conf >= 85 ? "Auto-linked" : conf >= 70 ? "Fuzzy match" : "Low confidence"}
                </span>
              </div>
            </div>

            {profile.status_reason && (
              <p style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 14 }}>
                {profile.status_reason}
              </p>
            )}

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <InfoPill label="UBID" value={profile.ubid} mono />
              {profile.canonical_pan   && <InfoPill label="PAN"   value={profile.canonical_pan}   mono />}
              {profile.canonical_gstin && <InfoPill label="GSTIN" value={profile.canonical_gstin} mono />}
            </div>
          </div>

          {/* Right: dept coverage */}
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, color: "var(--ink-3)",
              textTransform: "uppercase", letterSpacing: "0.08em",
              marginBottom: 8, fontFamily: "'Poppins', sans-serif",
            }}>
              Department Coverage
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {depts.map((d) => {
                const dc = DEPT_COLOR[d] ?? { text: "var(--ink-3)", bg: "var(--surface-2)", border: "var(--edge)" };
                return (
                  <span key={d} style={{
                    fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6,
                    background: dc.bg, color: dc.text, border: `1px solid ${dc.border}`,
                    fontFamily: "'Poppins', sans-serif",
                  }}>{d}</span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Suspicious signal banners */}
      {suspSignals.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {suspSignals.slice(0, 3).map((sig) => {
            const sev = sig.severity as string;
            const sc = SEV_CONFIG[sev] ?? SEV_CONFIG.MEDIUM;
            return (
              <div key={sig.id as string} style={{
                flex: 1, minWidth: 200, background: sc.bg,
                borderRadius: "var(--r-md)", padding: "10px 14px",
                border: `1px solid ${sc.border}`,
              }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: sc.color, marginBottom: 3, letterSpacing: "0.06em" }}>
                  ⚠ {sev}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", fontFamily: "'Poppins', sans-serif" }}>
                  {sig.title as string}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>
                  {((sig.description as string) ?? "").slice(0, 60)}…
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 0, marginBottom: 16,
        background: "var(--surface)", borderRadius: "var(--r-lg)",
        border: "1px solid var(--edge)", padding: 4,
        boxShadow: "var(--shadow-xs)",
      }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "8px 10px", border: "none", borderRadius: 9, cursor: "pointer",
            fontWeight: tab === t.id ? 700 : 500, fontSize: 12, transition: "all 0.15s",
            background: tab === t.id ? "var(--navy)" : "transparent",
            color: tab === t.id ? "#fff" : "var(--ink-3)",
            boxShadow: tab === t.id ? "0 2px 8px rgba(13,27,53,0.22)" : "none",
            fontFamily: "'Poppins', sans-serif", letterSpacing: "0.005em",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Tab: Linked Records ── */}
      {tab === "records" && (
        <div style={{
          background: "var(--surface)", borderRadius: "var(--r-lg)",
          border: "1px solid var(--edge)", overflow: "hidden",
          boxShadow: "var(--shadow-sm)",
        }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Record Name</th>
                <th>Reg. Number</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Pincode</th>
              </tr>
            </thead>
            <tbody>
              {profile.linked_records?.map((r: Record<string, unknown>, i: number) => {
                const dc = DEPT_COLOR[r.department_code as string];
                return (
                  <tr key={i}>
                    <td>
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 5,
                        background: dc?.bg ?? "var(--surface-2)",
                        color: dc?.text ?? "var(--ink-3)",
                        border: `1px solid ${dc?.border ?? "var(--edge)"}`,
                        fontFamily: "'Poppins', sans-serif",
                      }}>{r.department_code as string}</span>
                    </td>
                    <td style={{ fontWeight: 600, color: "var(--ink)", fontFamily: "'Poppins', sans-serif" }}>
                      {r.normalized_name as string}
                    </td>
                    <td>
                      <code style={{
                        fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace",
                        color: "var(--gold-dk)", background: "var(--gold-lt)",
                        padding: "2px 7px", borderRadius: 4,
                        border: "1px solid rgba(184,132,12,0.18)",
                      }}>{r.registration_number as string}</code>
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11, padding: "2px 8px", borderRadius: 5,
                        background: r.registration_status === "Active" ? "var(--active-lt)" : "var(--closed-lt)",
                        color: r.registration_status === "Active" ? "var(--active)" : "var(--closed)",
                        border: `1px solid ${r.registration_status === "Active" ? "rgba(26,107,74,0.20)" : "rgba(127,29,29,0.20)"}`,
                        fontWeight: 600,
                      }}>{r.registration_status as string}</span>
                    </td>
                    <td style={{ color: "var(--ink-2)" }}>{(r.owner_name as string) ?? "—"}</td>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: "var(--ink-3)" }}>
                      {r.pincode as string}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tab: Activity Timeline ── */}
      {tab === "timeline" && (
        <div style={{
          background: "var(--surface)", borderRadius: "var(--r-lg)",
          border: "1px solid var(--edge)", boxShadow: "var(--shadow-sm)",
        }}>
          {timeline?.classification_evidence && (
            <div style={{
              padding: "14px 20px", borderBottom: "1px solid var(--edge)",
              display: "flex", alignItems: "center", gap: 10,
              background: "var(--surface-2)", borderRadius: "var(--r-lg) var(--r-lg) 0 0",
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                background: "var(--gold-lt)", border: "1px solid rgba(184,132,12,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, color: "var(--gold)",
              }}>⊙</div>
              <div style={{ fontSize: 13, color: "var(--ink-2)", fontFamily: "'Poppins', sans-serif" }}>
                <strong style={{ color: "var(--ink)" }}>{timeline.classification_evidence.signal_count}</strong> signals from{" "}
                <strong style={{ color: "var(--navy)" }}>
                  {(timeline.classification_evidence.departments_with_signals as string[])?.join(", ")}
                </strong>
                {timeline.classification_evidence.recency_days != null && (
                  <> · Most recent <strong>{timeline.classification_evidence.recency_days} days ago</strong></>
                )}
              </div>
            </div>
          )}

          <div style={{ padding: "20px 24px" }}>
            {!timeline?.events?.length ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "var(--ink-3)" }}>
                No activity events linked yet.
              </div>
            ) : (
              <div style={{ position: "relative", paddingLeft: 28 }}>
                <div style={{
                  position: "absolute", left: 8, top: 8, bottom: 8,
                  width: 2,
                  background: "linear-gradient(to bottom, var(--navy), var(--edge))",
                  borderRadius: 2,
                }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {timeline.events.map((evt: Record<string, unknown>, i: number) => {
                    const evtColor = EVENT_COLOR[evt.event_type as string] ?? "var(--ink-3)";
                    const dc = DEPT_COLOR[evt.department_code as string];
                    return (
                      <div key={i} style={{ position: "relative", display: "flex", gap: 14 }}>
                        <div style={{
                          position: "absolute", left: -23, top: 10,
                          width: 10, height: 10, borderRadius: "50%",
                          background: evtColor,
                          border: "2px solid var(--surface)",
                          boxShadow: "0 0 0 2px var(--edge)",
                          flexShrink: 0,
                        }} />
                        <div style={{
                          flex: 1, background: "var(--surface-2)",
                          borderRadius: "var(--r-md)",
                          border: "1px solid var(--edge)",
                          padding: "10px 14px",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                                <span style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", fontFamily: "'Poppins', sans-serif" }}>
                                  {(evt.event_type as string).replace(/_/g, " ")}
                                </span>
                                <span style={{
                                  fontSize: 9.5, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                                  background: dc?.bg ?? "var(--surface-2)",
                                  color: dc?.text ?? "var(--ink-3)",
                                  border: `1px solid ${dc?.border ?? "var(--edge)"}`,
                                  fontFamily: "'Poppins', sans-serif",
                                }}>{evt.department_code as string}</span>
                                {!!(evt.event_outcome) && (
                                  <span style={{ fontSize: 11, color: "var(--active)", fontWeight: 600 }}>{evt.event_outcome as string}</span>
                                )}
                              </div>
                              {!!(evt.event_description) && (
                                <p style={{ fontSize: 12, color: "var(--ink-3)" }}>{evt.event_description as string}</p>
                              )}
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)", fontFamily: "'JetBrains Mono', monospace" }}>
                                {evt.event_date as string}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{String(evt.days_ago ?? "")}d ago</div>
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
        </div>
      )}

      {/* ── Tab: Health Score ── */}
      {tab === "health" && (
        <div>
          {!healthScore ? (
            <div className="skeleton" style={{ height: 240, borderRadius: "var(--r-lg)" }} />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 14 }}>
              {/* Score circle */}
              <div style={{
                background: "var(--surface)", borderRadius: "var(--r-lg)",
                border: "1px solid var(--edge)", padding: "28px 24px",
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", minWidth: 190, boxShadow: "var(--shadow-sm)",
              }}>
                <div style={{ position: "relative", width: 128, height: 128, marginBottom: 16 }}>
                  <svg width="128" height="128" viewBox="0 0 128 128">
                    <circle cx="64" cy="64" r="52" fill="none" stroke="var(--surface-2)" strokeWidth="10" />
                    <circle cx="64" cy="64" r="52" fill="none"
                      stroke={healthScore.tier_color as string}
                      strokeWidth="10"
                      strokeDasharray={`${((healthScore.health_score as number) / 100) * 327} 327`}
                      strokeLinecap="round"
                      transform="rotate(-90 64 64)"
                      style={{ transition: "stroke-dasharray 1s ease" }}
                    />
                    <text x="64" y="60" textAnchor="middle" dominantBaseline="middle"
                      fontSize="30" fontWeight="800" fill={healthScore.tier_color as string}
                      fontFamily="'Poppins', Georgia, serif">
                      {healthScore.health_score as number}
                    </text>
                    <text x="64" y="80" textAnchor="middle" fontSize="10" fill="var(--ink-3)"
                      fontFamily="'Poppins', sans-serif">/ 100</text>
                  </svg>
                </div>
                <div style={{
                  fontWeight: 800, fontSize: 15, color: healthScore.tier_color as string,
                  fontFamily: "'Poppins', serif",
                }}>{healthScore.health_tier as string}</div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>Business Health Score</div>
              </div>

              {/* Breakdown */}
              <div style={{
                background: "var(--surface)", borderRadius: "var(--r-lg)",
                border: "1px solid var(--edge)", padding: 22, boxShadow: "var(--shadow-sm)",
              }}>
                <div style={{ fontFamily: "'Poppins', serif", fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 16 }}>
                  Score Breakdown
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {Object.entries(healthScore.breakdown as Record<string, Record<string, unknown>>).map(([key, val]) => {
                    const score = val.score as number;
                    const max   = val.max   as number;
                    const pct   = Math.round((score / max) * 100);
                    const color = pct >= 70 ? "var(--active)" : pct >= 40 ? "var(--dormant)" : "var(--closed)";
                    return (
                      <div key={key}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                          <span style={{ color: "var(--ink-2)", fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>
                            {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                          </span>
                          <span style={{ fontWeight: 700, color, fontFamily: "'Poppins', serif" }}>
                            {score}/{max}
                            <span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 400, fontFamily: "'Poppins', sans-serif" }}>
                              {" "}— {val.detail as string}
                            </span>
                          </span>
                        </div>
                        <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.8s ease" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Risk flags */}
                {(healthScore.risk_flags as unknown[])?.length > 0 && (
                  <div style={{ marginTop: 18 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-2)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      Risk Flags
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {(healthScore.risk_flags as Record<string, string>[]).map((flag, i) => {
                        const isHigh = flag.severity === "HIGH";
                        return (
                          <div key={i} style={{
                            display: "flex", gap: 8, alignItems: "center",
                            padding: "7px 11px",
                            background: isHigh ? "var(--closed-lt)" : "var(--dormant-lt)",
                            borderRadius: "var(--r-md)",
                            border: `1px solid ${isHigh ? "rgba(127,29,29,0.22)" : "rgba(146,64,14,0.22)"}`,
                          }}>
                            <span style={{
                              fontSize: 9.5, fontWeight: 800, padding: "1px 6px", borderRadius: 4,
                              background: isHigh ? "rgba(127,29,29,0.12)" : "rgba(146,64,14,0.12)",
                              color: isHigh ? "var(--closed)" : "var(--dormant)",
                              letterSpacing: "0.05em",
                            }}>{flag.severity}</span>
                            <span style={{ fontSize: 12, color: "var(--ink-2)" }}>{flag.message}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {(healthScore.recommendations as string[])?.length > 0 && (
                  <div style={{
                    marginTop: 16, background: "var(--gold-lt)",
                    borderRadius: "var(--r-md)", border: "1px solid rgba(184,132,12,0.25)",
                    padding: "11px 14px",
                  }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--gold-dk)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      Recommendations
                    </div>
                    {(healthScore.recommendations as string[]).map((r, i) => (
                      <div key={i} style={{ fontSize: 12, color: "var(--dormant)", marginBottom: 3, fontFamily: "'Poppins', sans-serif" }}>
                        · {r}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Reviewer History ── */}
      {tab === "history" && (
        <div style={{
          background: "var(--surface)", borderRadius: "var(--r-lg)",
          border: "1px solid var(--edge)", padding: 20, boxShadow: "var(--shadow-sm)",
        }}>
          {reviewCases.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "var(--ink-3)" }}>
              No reviewer decisions recorded for this business.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {reviewCases.map((c) => {
                const dec    = c.decision as string | null;
                const status = c.status as string;
                const statusColor = status === "APPROVED" ? "var(--active)" : status === "REJECTED" ? "var(--closed)" : status === "ESCALATED" ? "var(--dormant)" : "var(--navy)";
                const statusBg    = status === "APPROVED" ? "var(--active-lt)" : status === "REJECTED" ? "var(--closed-lt)" : status === "ESCALATED" ? "var(--dormant-lt)" : "rgba(13,27,53,0.07)";
                return (
                  <div key={c.case_id as string} style={{
                    background: "var(--surface-2)", borderRadius: "var(--r-md)",
                    padding: "12px 16px", border: "1px solid var(--edge)",
                    borderLeft: `3px solid ${statusColor}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                        <span style={{
                          fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
                          background: statusBg, color: statusColor,
                          border: `1px solid ${statusColor}30`,
                          fontFamily: "'Poppins', sans-serif", letterSpacing: "0.04em",
                        }}>{status}</span>
                        <span style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "'Poppins', sans-serif" }}>
                          Confidence: <strong style={{ color: "var(--ink-2)" }}>{Math.round((c.confidence_score as number) * 100)}%</strong>
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "'JetBrains Mono', monospace" }}>
                        {c.resolved_at ? new Date(c.resolved_at as string).toLocaleDateString() : new Date(c.created_at as string).toLocaleDateString()}
                      </span>
                    </div>
                    {!!(dec) && (
                      <div style={{ fontSize: 12.5, color: "var(--ink)", marginBottom: 4, fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>
                        {dec.replace(/_/g, " ")}
                        {!!(c.reviewer) && <span style={{ color: "var(--ink-3)", fontWeight: 400 }}> · by {c.reviewer as string}</span>}
                      </div>
                    )}
                    {!!(c.reason) && (
                      <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{c.reason as string}</div>
                    )}
                    {!!(c.resulting_ubid) && (
                      <div style={{ marginTop: 6, fontSize: 11 }}>
                        <span style={{ color: "var(--ink-3)" }}>UBID assigned: </span>
                        <code style={{
                          fontSize: 10.5, background: "var(--gold-lt)",
                          padding: "1px 6px", borderRadius: 4, color: "var(--gold-dk)",
                          fontFamily: "'JetBrains Mono', monospace",
                          border: "1px solid rgba(184,132,12,0.18)",
                        }}>{c.resulting_ubid as string}</code>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Relationships ── */}
      {tab === "relationships" && (
        <div>
          {/* Graph card */}
          <div style={{
            background: "var(--surface)", borderRadius: "var(--r-lg)",
            border: "1px solid var(--edge)", marginBottom: 14, overflow: "hidden",
            boxShadow: "var(--shadow-sm)",
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 18px", borderBottom: "1px solid var(--edge)",
              background: "var(--surface-2)",
            }}>
              <div>
                <div style={{ fontFamily: "'Poppins', serif", fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>
                  Relationship Graph
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
                  {graphData?.summary ? `${graphData.summary.total_nodes} nodes · ${graphData.summary.total_edges} connections` : "Loading…"}
                </div>
              </div>
              <Link href={`/graph/${ubid}`} style={{
                padding: "6px 14px", background: "var(--navy)", color: "#fff",
                borderRadius: "var(--r-md)", fontSize: 12, fontWeight: 600,
                fontFamily: "'Poppins', sans-serif",
                boxShadow: "0 2px 8px rgba(13,27,53,0.20)",
              }}>
                Open Full View →
              </Link>
            </div>
            {graphData?.nodes ? (
              <RelationshipGraph
                nodes={graphData.nodes as GraphNode[]}
                edges={graphData.edges as GraphEdge[]}
                height={320}
                onNodeSelect={setSelectedNode}
              />
            ) : (
              <div style={{
                height: 320, display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--ink-3)",
              }}>Loading graph…</div>
            )}
          </div>

          {/* Selected node detail */}
          {selectedNode && (
            <div style={{
              background: "var(--surface)", borderRadius: "var(--r-md)",
              border: "1px solid var(--gold)", padding: "12px 16px", marginBottom: 14,
              boxShadow: "var(--shadow-gold)",
            }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "var(--ink)", marginBottom: 8, fontFamily: "'Poppins', serif" }}>
                Selected: {selectedNode.label}
                <button onClick={() => setSelectedNode(null)} style={{
                  marginLeft: 10, border: "none", background: "none",
                  color: "var(--ink-3)", cursor: "pointer", fontSize: 14,
                }}>×</button>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12 }}>
                {selectedNode.status && <span style={{ color: "var(--ink-2)" }}>Status: <strong>{selectedNode.status}</strong></span>}
                {selectedNode.dept   && <span style={{ color: "var(--ink-2)" }}>Dept: <strong>{selectedNode.dept}</strong></span>}
                {selectedNode.confidence !== undefined && (
                  <span style={{ color: "var(--gold-dk)", fontWeight: 600 }}>
                    {Math.round(selectedNode.confidence * 100)}% conf.
                  </span>
                )}
                {selectedNode.type === "BUSINESS" && !selectedNode.is_subject && (
                  <Link href={`/business/${selectedNode.id.replace("biz-", "")}`} style={{ color: "var(--navy)", fontWeight: 600 }}>
                    Open Profile →
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Suspicious signals */}
          {suspSignals.length > 0 && (
            <div style={{
              background: "var(--surface)", borderRadius: "var(--r-lg)",
              border: "1px solid var(--edge)", marginBottom: 14, overflow: "hidden",
              boxShadow: "var(--shadow-sm)",
            }}>
              <div style={{
                padding: "12px 18px", borderBottom: "1px solid var(--edge)",
                fontFamily: "'Poppins', serif", fontWeight: 700, fontSize: 13, color: "var(--ink)",
                background: "var(--surface-2)",
              }}>
                Investigation Signals ({suspSignals.length})
              </div>
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                {suspSignals.map((sig) => {
                  const sev = sig.severity as string;
                  const sc = SEV_CONFIG[sev] ?? SEV_CONFIG.MEDIUM;
                  return (
                    <div key={sig.id as string} style={{
                      background: sc.bg, borderRadius: "var(--r-md)",
                      padding: "10px 14px", border: `1px solid ${sc.border}`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{
                          fontSize: 9.5, fontWeight: 800, padding: "2px 7px", borderRadius: 5,
                          background: `${sc.border}80`, color: sc.color, letterSpacing: "0.06em",
                        }}>{sev}</span>
                        <span style={{ fontWeight: 700, fontSize: 12.5, color: "var(--ink)", fontFamily: "'Poppins', sans-serif" }}>
                          {sig.title as string}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{sig.description as string}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 5 }}>
                        → {sig.recommended_action as string}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Nearby businesses */}
          {nearbyData?.nearby && (nearbyData.nearby as unknown[]).length > 0 && (
            <div style={{
              background: "var(--surface)", borderRadius: "var(--r-lg)",
              border: "1px solid var(--edge)", overflow: "hidden",
              boxShadow: "var(--shadow-sm)",
            }}>
              <div style={{
                padding: "12px 18px", borderBottom: "1px solid var(--edge)",
                fontFamily: "'Poppins', serif", fontWeight: 700, fontSize: 13, color: "var(--ink)",
                background: "var(--surface-2)",
              }}>
                Nearby Businesses — {profile.primary_pincode}
              </div>
              <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 7 }}>
                {(nearbyData.nearby as Record<string, unknown>[]).map((biz) => (
                  <div key={biz.ubid as string} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "9px 14px", background: "var(--surface-2)",
                    borderRadius: "var(--r-md)", border: "1px solid var(--edge)",
                  }}>
                    <div>
                      <Link href={`/business/${biz.ubid}`} style={{
                        fontWeight: 600, color: "var(--navy)", fontSize: 12.5,
                        fontFamily: "'Poppins', sans-serif",
                      }}>
                        {(biz.name as string).slice(0, 40)}
                      </Link>
                      <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
                        <StatusBadge status={biz.status as string} size="sm" />
                        {((biz.shared_signals as string[]) ?? []).slice(0, 2).map((s) => (
                          <span key={s} style={{
                            fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4,
                            background: "var(--dormant-lt)", color: "var(--dormant)",
                            border: "1px solid rgba(146,64,14,0.18)",
                          }}>{s.replace(/_/g, " ")}</span>
                        ))}
                      </div>
                    </div>
                    <Link href={`/graph/${biz.ubid}`} style={{ fontSize: 11.5, color: "var(--navy)", fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>
                      Graph →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
