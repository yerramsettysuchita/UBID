"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  getDashboardSummary, getOperationsMetrics,
  getAnalyticsTrends, getSupervisorOverview, getRiskHighlights,
} from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { KpiCard } from "@/components/ui/Card";

const STATUS_HEX: Record<string, string> = {
  ACTIVE: "#1A6B4A", DORMANT: "#92400E", CLOSED: "#B91C1C", REVIEW_NEEDED: "#0D1B35",
};
const STATUS_CSS: Record<string, string> = {
  ACTIVE: "var(--active)", DORMANT: "var(--dormant)", CLOSED: "var(--closed)", REVIEW_NEEDED: "var(--navy)",
};
const STATUS_BG: Record<string, string> = {
  ACTIVE: "var(--active-lt)", DORMANT: "var(--dormant-lt)", CLOSED: "var(--closed-lt)", REVIEW_NEEDED: "rgba(13,27,53,0.07)",
};
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active", DORMANT: "Dormant", CLOSED: "Closed", REVIEW_NEEDED: "Review",
};

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--edge)", borderRadius: 8,
      padding: "10px 14px", fontSize: 12, boxShadow: "var(--shadow-md)",
      borderLeft: "3px solid var(--gold)",
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: "var(--ink)", fontFamily: "'Poppins', serif", fontSize: 13 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color ?? "var(--navy)", flexShrink: 0 }} />
          <span style={{ color: "var(--ink-3)", fontSize: 11 }}>{p.name}</span>
          <span style={{ marginLeft: "auto", fontWeight: 700, color: "var(--ink)", fontFamily: "'Poppins', serif" }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function AccuracyArc({ pct, label, color }: { pct: number; label: string; color: string }) {
  const r = 26; const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const grade = pct >= 90 ? "A" : pct >= 75 ? "B" : pct >= 60 ? "C" : "D";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 72 }}>
      <div style={{ position: "relative", width: 64, height: 64 }}>
        <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="32" cy="32" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="6" />
          <circle
            cx="32" cy="32" r={r} fill="none"
            stroke={color} strokeWidth="6"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.95s cubic-bezier(0.34,1.56,0.64,1)" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 16, fontWeight: 900, color, fontFamily: "'Poppins', serif", lineHeight: 1 }}>{grade}</span>
          <span style={{ fontSize: 9, color: "var(--ink-3)", fontWeight: 600 }}>{pct}%</span>
        </div>
      </div>
      <div style={{ fontSize: 9.5, color: "var(--ink-3)", fontWeight: 600, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1.3, maxWidth: 70 }}>
        {label.replace(/_/g, " ")}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboardSummary().then((r) => r.data) });
  const { data: ops }       = useQuery({ queryKey: ["ops-metrics"], queryFn: () => getOperationsMetrics().then((r) => r.data), refetchInterval: 30000 });
  const { data: trends }    = useQuery({ queryKey: ["analytics-trends"], queryFn: () => getAnalyticsTrends().then((r) => r.data), refetchInterval: 60000 });
  const { data: overview }  = useQuery({ queryKey: ["supervisor-overview"], queryFn: () => getSupervisorOverview().then((r) => r.data), refetchInterval: 60000 });
  const { data: risks }     = useQuery({ queryKey: ["risk-highlights"], queryFn: () => getRiskHighlights().then((r) => r.data), refetchInterval: 60000 });

  const statusData = data?.status_breakdown
    ? Object.entries(data.status_breakdown).map(([k, v]) => ({ key: k, val: v as number }))
    : [];

  const trendData = (() => {
    const casesRaw: Record<string, unknown>[] = trends?.review_cases_created_trend ?? [];
    const decisRaw: Record<string, unknown>[] = trends?.decisions_trend ?? [];
    const map: Record<string, { d: string; n: number; r: number }> = {};
    casesRaw.forEach((row) => { const date = (row.day ?? row.date) as string; if (!date) return; map[date] = { d: date.slice(5), n: row.count as number, r: 0 }; });
    decisRaw.forEach((row) => { const date = (row.day ?? row.date) as string; if (!date) return; if (map[date]) map[date].r = row.count as number; else map[date] = { d: date.slice(5), n: 0, r: row.count as number }; });
    return Object.values(map).sort((a, b) => a.d.localeCompare(b.d)).slice(-14);
  })();

  const total   = data?.total_ubids ?? 0;
  const active  = data?.status_breakdown?.ACTIVE ?? 0;
  const er      = data?.er_summary;
  const totalP  = er?.total_pairs_evaluated ?? 0;
  const hotspots: Record<string, unknown>[] = overview?.hotspot_districts ?? [];
  const topPincodes: Record<string, unknown>[] = overview?.top_pincodes ?? [];
  const riskAlerts: string[] = [];
  if ((risks?.sla_breach_count ?? 0) > 0) riskAlerts.push(`${risks?.sla_breach_count} SLA breach${risks?.sla_breach_count === 1 ? "" : "es"}`);
  if ((risks?.old_pending_cases ?? 0) > 0) riskAlerts.push(`${risks?.old_pending_cases} case${risks?.old_pending_cases === 1 ? "" : "s"} overdue >7d`);

  if (isLoading) return (
    <AppShell title="Analytics Dashboard" subtitle="Live platform health and Karnataka business registry overview">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 20 }}>
        {Array(5).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: 100, borderRadius: "var(--r-lg)" }} />)}
      </div>
    </AppShell>
  );

  return (
    <AppShell title="Analytics Dashboard" subtitle="Live platform health, AI engine status and Karnataka business registry overview">

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 20 }}>
        <KpiCard label="Total Businesses" value={total.toLocaleString()} icon="⊞" accent="indigo" delta="Unified UBID identities" />
        <KpiCard label="Active Rate" value={`${total ? Math.round((active / total) * 100) : 0}%`} icon="⊕" accent="green" delta={`${active.toLocaleString()} businesses`} />
        <KpiCard label="Pending Review" value={data?.review_queue?.pending ?? 0} icon="◧" accent="amber" delta="Awaiting decision" />
        <KpiCard label="Escalated" value={data?.review_queue?.escalated ?? 0} icon="◈" accent="red" delta="Supervisor attention" />
        <KpiCard label="SLA Breaches" value={ops?.sla_breach_count ?? 0} icon="⊡" accent="gold" delta="Past deadline" />
      </div>

      {/* ER Intelligence banner */}
      {er && totalP > 0 && (
        <div style={{
          background: "var(--navy)", borderRadius: "var(--r-lg)",
          padding: "20px 24px", marginBottom: 16,
          border: "1px solid rgba(184,132,12,0.20)",
          boxShadow: "0 4px 20px rgba(13,27,53,0.22)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(184,132,12,0.20)", border: "1px solid rgba(184,132,12,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--gold)" }}>⊛</div>
            <div>
              <div style={{ fontFamily: "'Poppins', serif", fontWeight: 700, fontSize: 14, color: "#F0E8D8" }}>Identity Resolution Engine — Phase 2 Active</div>
              <div style={{ fontSize: 11, color: "var(--navy-text)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                Run:&nbsp;<span style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--gold)", fontSize: 10 }}>{er.latest_run_key ?? er.run_key}</span>
                <span style={{ width: 1, height: 10, background: "rgba(200,185,156,0.20)", display: "inline-block" }} />
                <span style={{ color: er.latest_run_status === "COMPLETED" ? "#4ade80" : "#fbbf24", fontWeight: 700 }}>{er.latest_run_status}</span>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 14 }}>
            {[
              { l: "Pairs Evaluated",  v: totalP,                   c: "rgba(200,185,156,0.85)" },
              { l: "Auto-Linked",      v: er.auto_matched ?? 0,     c: "#4ade80" },
              { l: "Review Queue",     v: er.review_needed ?? 0,    c: "#fbbf24" },
              { l: "Clusters Formed",  v: er.clusters_created ?? 0, c: "#c4b5fd" },
              { l: "UBIDs Assigned",   v: er.ubids_assigned ?? 0,   c: "var(--gold)" },
            ].map((s) => (
              <div key={s.l} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "12px 14px", border: "1px solid rgba(255,255,255,0.07)", textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: s.c, fontFamily: "'Poppins', serif", letterSpacing: "-0.02em", lineHeight: 1 }}>{s.v.toLocaleString()}</div>
                <div style={{ fontSize: 9.5, color: "rgba(200,185,156,0.50)", marginTop: 5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>{s.l}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 32px" }}>
            {[
              { label: "Auto-Link Rate", value: er.auto_matched ?? 0, color: "#4ade80" },
              { label: "Review Rate",    value: er.review_needed ?? 0, color: "#fbbf24" },
            ].map(({ label, value, color }) => {
              const pct = totalP > 0 ? Math.round((value / totalP) * 100) : 0;
              return (
                <div key={label} style={{ marginBottom: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5, color: "rgba(200,185,156,0.70)", fontWeight: 600 }}>
                    <span>{label}</span>
                    <span style={{ color, fontFamily: "'Poppins', serif" }}>{pct}%</span>
                  </div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 1s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Risk highlights */}
      {risks && (riskAlerts.length > 0 || (risks.high_risk_districts as unknown[])?.length > 0) && (
        <div style={{ background: "var(--dormant-lt)", borderRadius: "var(--r-lg)", border: "1px solid rgba(146,64,14,0.25)", padding: "12px 18px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 13 }}>⚠</span>
            <span style={{ fontWeight: 700, fontSize: 12.5, color: "var(--dormant)", fontFamily: "'Poppins', serif" }}>Risk Signals — Immediate Attention Required</span>
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {riskAlerts.map((a) => (
              <div key={a} className="stat-pill" style={{ background: "var(--closed-lt)", border: "1px solid rgba(127,29,29,0.25)", color: "var(--closed)" }}>{a}</div>
            ))}
            {(risks.high_risk_districts as Record<string, unknown>[])?.slice(0, 4).map((d) => (
              <div key={(d.district ?? d.name) as string} className="stat-pill" style={{ background: "var(--dormant-lt)", border: "1px solid rgba(146,64,14,0.22)", color: "var(--dormant)" }}>
                ⬡ {(d.district ?? d.name) as string} · {d.review_needed as number} pending
              </div>
            ))}
            {(risks.high_dormancy_pincodes as Record<string, unknown>[])?.slice(0, 3).map((p) => (
              <div key={p.pincode as string} className="stat-pill" style={{ background: "var(--gold-lt)", border: "1px solid rgba(184,132,12,0.22)", color: "var(--gold-dk)" }}>
                ◎ {p.pincode as string} · {p.dormant_count as number} dormant
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Status Registry ─────────────────────────────────────────────────── */}
      {statusData.length > 0 && (
        <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--edge)", padding: "20px 22px", marginBottom: 14, boxShadow: "var(--shadow-sm)" }}>
          <div className="chart-header">
            <div>
              <div className="chart-title">Business Status Registry</div>
              <div className="chart-subtitle">{total.toLocaleString()} unified entities across Karnataka</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--active)", animation: "pulse-gold 2s infinite" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--active)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Live</span>
            </div>
          </div>

          {/* Proportional status rail */}
          <div style={{ display: "flex", height: 12, borderRadius: 7, overflow: "hidden", gap: 2, marginBottom: 18 }}>
            {statusData.map((s) => {
              const pct = total > 0 ? (s.val / total) * 100 : 0;
              return (
                <div key={s.key} style={{
                  flex: pct, height: "100%",
                  background: STATUS_HEX[s.key] ?? "#8A95A8",
                  position: "relative", transition: "flex 0.9s cubic-bezier(0.34,1.56,0.64,1)",
                  borderRadius: 4,
                  minWidth: pct > 0 ? 4 : 0,
                }}>
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 60%)", borderRadius: 4 }} />
                </div>
              );
            })}
          </div>

          {/* Status breakdown cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {statusData.map((s) => {
              const pct = total > 0 ? Math.round((s.val / total) * 100) : 0;
              const border = STATUS_HEX[s.key] ? STATUS_HEX[s.key] + "33" : "var(--edge)";
              return (
                <div key={s.key} style={{
                  borderRadius: "var(--r-md)", padding: "12px 14px",
                  background: STATUS_BG[s.key] ?? "var(--surface-2)",
                  border: `1px solid ${border}`,
                  position: "relative", overflow: "hidden",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: STATUS_HEX[s.key] ?? "var(--ink-3)", flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_CSS[s.key] ?? "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      {STATUS_LABEL[s.key] ?? s.key.replace("_", " ")}
                    </span>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: STATUS_CSS[s.key] ?? "var(--ink)", fontFamily: "'Poppins', serif", letterSpacing: "-0.02em", lineHeight: 1, marginBottom: 2 }}>
                    {s.val.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: STATUS_CSS[s.key] ?? "var(--ink-3)", opacity: 0.65 }}>{pct}% of total</div>
                  <div style={{ position: "absolute", bottom: -4, right: 6, fontSize: 34, color: STATUS_HEX[s.key] ?? "#000", opacity: 0.05, fontFamily: "'Poppins', serif", pointerEvents: "none", lineHeight: 1 }}>
                    {pct}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Charts row ──────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 14, marginBottom: 14 }}>

        {/* Review activity area chart */}
        <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--edge)", padding: "20px 22px", boxShadow: "var(--shadow-sm)" }}>
          <div className="chart-header">
            <div>
              <div className="chart-title">Review Activity — 14-Day Trend</div>
              <div className="chart-subtitle">Cases opened vs decisions rendered</div>
            </div>
            <div style={{ display: "flex", gap: 14 }}>
              {[{ c: "#0D1B35", l: "Resolved" }, { c: "#B8840C", l: "New" }].map((x) => (
                <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, color: "var(--ink-3)" }}>
                  <div style={{ width: 20, height: 2.5, background: x.c, borderRadius: 2 }} />
                  {x.l}
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={trendData} margin={{ left: -10, right: 4 }}>
              <defs>
                <linearGradient id="gNav" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#0D1B35" stopOpacity={0.14} />
                  <stop offset="95%" stopColor="#0D1B35" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gGold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#B8840C" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#B8840C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="1 6" stroke="#E6E0D4" vertical={false} />
              <XAxis dataKey="d" tick={{ fontSize: 9.5, fill: "#8A95A8", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} interval={1} />
              <YAxis tick={{ fontSize: 9.5, fill: "#8A95A8" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="r" stroke="#0D1B35" fill="url(#gNav)" strokeWidth={2.5} name="Resolved" dot={false} activeDot={{ r: 5, fill: "#0D1B35", stroke: "#fff", strokeWidth: 2 }} />
              <Area type="monotone" dataKey="n" stroke="#B8840C" fill="url(#gGold)" strokeWidth={2.5} name="New" dot={false} activeDot={{ r: 5, fill: "#B8840C", stroke: "#fff", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Hotspot districts */}
        <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--edge)", padding: "20px 22px", boxShadow: "var(--shadow-sm)" }}>
          <div className="chart-header">
            <div>
              <div className="chart-title">Hotspot Districts</div>
              <div className="chart-subtitle">Ranked by pending review load</div>
            </div>
          </div>
          {hotspots.length === 0 && topPincodes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "var(--ink-3)", fontSize: 12 }}>No data yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {hotspots.slice(0, 4).map((d, idx) => {
                const count = (d.review_needed ?? d.risk_score ?? 0) as number;
                const name  = (d.district ?? d.name ?? "—") as string;
                const maxCount = Math.max(...hotspots.slice(0, 4).map((x) => (x.review_needed ?? x.risk_score ?? 0) as number), 1);
                const barW = Math.round((count / maxCount) * 100);
                return (
                  <div key={name} className="ledger-row">
                    <div className="ledger-rank">{idx + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
                      <div className="prog-track" style={{ marginTop: 4 }}>
                        <div className="prog-fill" style={{ width: `${barW}%`, background: "#92400E" }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--dormant)", background: "var(--dormant-lt)", padding: "2px 9px", borderRadius: 20, whiteSpace: "nowrap", border: "1px solid rgba(146,64,14,0.22)" }}>{count}</div>
                  </div>
                );
              })}
              {topPincodes.slice(0, 2).map((p) => (
                <div key={p.pincode as string} className="ledger-row">
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: "var(--gold-lt)", border: "1px solid rgba(184,132,12,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 10 }}>◎</div>
                  <code style={{ fontSize: 12, color: "var(--gold-dk)", fontFamily: "'JetBrains Mono', monospace", flex: 1 }}>{p.pincode as string}</code>
                  <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{((p.count ?? p.total ?? 0) as number).toLocaleString()} biz</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Accuracy arc badges ──────────────────────────────────────────────── */}
      {data?.accuracy_metrics && Object.keys(data.accuracy_metrics).length > 0 && (
        <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--edge)", padding: "20px 22px", boxShadow: "var(--shadow-sm)" }}>
          <div className="chart-header">
            <div>
              <div className="chart-title">Identity Engine — Accuracy Scorecard</div>
              <div className="chart-subtitle">Model performance by evaluation metric</div>
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.07em", background: "var(--surface-2)", padding: "4px 10px", borderRadius: 20, border: "1px solid var(--edge)" }}>
              A ≥90 · B ≥75 · C ≥60
            </div>
          </div>
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap", justifyContent: "space-around", paddingTop: 4 }}>
            {Object.entries(data.accuracy_metrics).map(([k, v]) => {
              const pct = Math.round((v as number) * 100);
              const color = pct >= 90 ? "#1A6B4A" : pct >= 75 ? "#B8840C" : "#B91C1C";
              return <AccuracyArc key={k} pct={pct} label={k} color={color} />;
            })}
          </div>
        </div>
      )}
    </AppShell>
  );
}
