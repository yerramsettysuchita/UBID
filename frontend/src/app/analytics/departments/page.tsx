"use client";

import { useQuery } from "@tanstack/react-query";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { getDepartmentCoverage } from "@/lib/api";
import { AppShell } from "@/components/AppShell";

const DEPT_META: Record<string, { text: string; bg: string; border: string; radarColor: string }> = {
  SHOPS:     { text: "var(--navy)",    bg: "rgba(13,27,53,0.07)",  border: "rgba(13,27,53,0.20)",   radarColor: "#0D1B35" },
  FACTORIES: { text: "var(--dormant)", bg: "var(--dormant-lt)",    border: "rgba(146,64,14,0.22)",  radarColor: "#92400E" },
  KSPCB:     { text: "var(--active)",  bg: "var(--active-lt)",     border: "rgba(26,107,74,0.22)",  radarColor: "#1A6B4A" },
  BESCOM:    { text: "var(--gold-dk)", bg: "var(--gold-lt)",       border: "rgba(184,132,12,0.22)", radarColor: "#B8840C" },
};
const DEPT_FULL: Record<string, string> = {
  SHOPS:     "Shops & Establishments",
  FACTORIES: "Factories & Boilers",
  KSPCB:     "Karnataka Pollution Control",
  BESCOM:    "Electricity Supply",
};

function MetricBar({ value, color }: { value: number; color: string }) {
  const pct = Math.min(100, value);
  return (
    <div style={{ height: 4, background: "var(--edge)", borderRadius: 3, overflow: "hidden", marginTop: 4 }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.8s ease" }} />
    </div>
  );
}

function Tip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--edge)", borderRadius: 8, padding: "8px 12px", fontSize: 12, boxShadow: "var(--shadow-md)" }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: "var(--ink)", fontFamily: "'Poppins', serif" }}>{label}</div>
      {payload.map((p) => <div key={p.name} style={{ color: "var(--ink-2)" }}>{p.name}: <strong style={{ color: "var(--ink)" }}>{p.value}</strong></div>)}
    </div>
  );
}

export default function DepartmentCoveragePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dept-coverage"],
    queryFn: () => getDepartmentCoverage().then((r) => r.data),
  });

  const depts: Record<string, unknown>[] = data?.departments ?? [];

  const matchRateData = depts.map((d) => ({
    name: d.code as string,
    matched: d.linked_records as number,
    unmatched: d.unlinked_records as number,
  }));

  const radarData = depts.map((d) => ({
    dept: d.code as string,
    "PAN Coverage":    d.pan_coverage_pct as number,
    "GSTIN Coverage":  d.gstin_coverage_pct as number,
    "Match Rate":      d.match_rate_pct as number,
  }));

  return (
    <AppShell title="Department Coverage" subtitle="See how each Karnataka department contributes data to the unified business registry">

      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
          {[1,2,3,4].map((i) => <div key={i} className="skeleton" style={{ height: 220, borderRadius: "var(--r-lg)" }} />)}
        </div>
      ) : (
        <>
          {/* Dept cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, marginBottom: 16 }}>
            {depts.map((d) => {
              const m = DEPT_META[d.code as string] ?? { text: "var(--ink-3)", bg: "var(--surface-2)", border: "var(--edge)" };
              const matchRate = d.match_rate_pct as number;
              const reviewRate = d.review_rate_pct as number;
              return (
                <div key={d.code as string} style={{
                  background: "var(--surface)", borderRadius: "var(--r-lg)",
                  border: "1px solid var(--edge)", padding: 22,
                  borderTop: `4px solid ${m.text}`,
                  boxShadow: "var(--shadow-sm)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: m.bg, border: `1px solid ${m.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, color: m.text, fontFamily: "'Poppins', serif" }}>
                      {(d.code as string).charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: "var(--ink)", fontFamily: "'Poppins', serif" }}>{d.code as string}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{DEPT_FULL[d.code as string] ?? d.name as string}</div>
                    </div>
                    <div style={{ marginLeft: "auto", textAlign: "right" }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: m.text, letterSpacing: "-0.02em", fontFamily: "'Poppins', serif" }}>{(d.total_records as number).toLocaleString()}</div>
                      <div style={{ fontSize: 10, color: "var(--ink-3)", fontWeight: 600 }}>Total Records</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[
                      { label: "Match Rate",    value: `${matchRate}%`,              color: matchRate >= 60 ? "var(--active)" : "var(--dormant)", max: matchRate },
                      { label: "Review Rate",   value: `${reviewRate}%`,             color: reviewRate >= 30 ? "var(--closed)" : "var(--dormant)", max: reviewRate },
                      { label: "PAN Coverage",  value: `${d.pan_coverage_pct}%`,     color: m.text, max: d.pan_coverage_pct as number },
                      { label: "GSTIN Coverage",value: `${d.gstin_coverage_pct}%`,   color: m.text, max: d.gstin_coverage_pct as number },
                    ].map((metric) => (
                      <div key={metric.label}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "'Poppins', sans-serif" }}>
                          <span style={{ color: "var(--ink-3)" }}>{metric.label}</span>
                          <span style={{ fontWeight: 700, color: metric.color }}>{metric.value}</span>
                        </div>
                        <MetricBar value={metric.max} color={metric.color} />
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                    <div style={{ flex: 1, background: "var(--active-lt)", borderRadius: 7, padding: "8px 10px", border: "1px solid rgba(26,107,74,0.22)", textAlign: "center" }}>
                      <div style={{ fontSize: 15, fontWeight: 900, color: "var(--active)", fontFamily: "'Poppins', serif" }}>{(d.linked_records as number).toLocaleString()}</div>
                      <div style={{ fontSize: 10, color: "var(--active)", fontWeight: 600 }}>Linked</div>
                    </div>
                    <div style={{ flex: 1, background: "var(--closed-lt)", borderRadius: 7, padding: "8px 10px", border: "1px solid rgba(127,29,29,0.22)", textAlign: "center" }}>
                      <div style={{ fontSize: 15, fontWeight: 900, color: "var(--closed)", fontFamily: "'Poppins', serif" }}>{(d.unlinked_records as number).toLocaleString()}</div>
                      <div style={{ fontSize: 10, color: "var(--closed)", fontWeight: 600 }}>Unlinked</div>
                    </div>
                    <div style={{ flex: 1, background: "rgba(13,27,53,0.07)", borderRadius: 7, padding: "8px 10px", border: "1px solid rgba(13,27,53,0.18)", textAlign: "center" }}>
                      <div style={{ fontSize: 15, fontWeight: 900, color: "var(--navy)", fontFamily: "'Poppins', serif" }}>{(d.review_cases as number).toLocaleString()}</div>
                      <div style={{ fontSize: 10, color: "var(--navy)", fontWeight: 600 }}>Review Cases</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Charts row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--edge)", padding: 20, boxShadow: "var(--shadow-sm)" }}>
              <div className="chart-header" style={{ marginBottom: 14 }}>
                <div>
                  <div className="chart-title">Records — Linked vs Unlinked</div>
                  <div className="chart-subtitle">Stacked by source department</div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  {[{ c: "#1A6B4A", l: "Linked" }, { c: "#B91C1C", l: "Unlinked" }].map((x) => (
                    <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 600, color: "var(--ink-3)" }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: x.c }} />{x.l}
                    </div>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={matchRateData} barSize={28}>
                  <CartesianGrid strokeDasharray="1 6" stroke="#E6E0D4" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: "#8A95A8", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10.5, fill: "#8A95A8" }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip content={<Tip />} />
                  <Bar dataKey="matched"   stackId="a" fill="#1A6B4A" name="Linked"   radius={[0,0,0,0]} />
                  <Bar dataKey="unmatched" stackId="a" fill="#B91C1C" name="Unlinked" radius={[4,4,0,0]} opacity={0.65} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--edge)", padding: 20, boxShadow: "var(--shadow-sm)" }}>
              <div className="chart-header" style={{ marginBottom: 8 }}>
                <div>
                  <div className="chart-title">Data Quality Radar</div>
                  <div className="chart-subtitle">PAN · GSTIN · Match rate by dept</div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  {[{ c: "#0D1B35", l: "PAN" }, { c: "#B8840C", l: "GSTIN" }, { c: "#1A6B4A", l: "Match" }].map((x) => (
                    <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9.5, fontWeight: 600, color: "var(--ink-3)" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: x.c }} />{x.l}
                    </div>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={210}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="var(--edge)" />
                  <PolarAngleAxis dataKey="dept" tick={{ fontSize: 11, fill: "var(--ink-3)" }} />
                  {["PAN Coverage", "GSTIN Coverage", "Match Rate"].map((key, i) => {
                    const colors = ["#0D1B35", "#B8840C", "#1A6B4A"];
                    return (
                      <Radar key={key} name={key} dataKey={key}
                        stroke={colors[i]} fill={colors[i]} fillOpacity={0.12}
                      />
                    );
                  })}
                  <Tooltip content={<Tip />} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Summary table */}
          <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--edge)", overflow: "hidden", marginTop: 14, boxShadow: "var(--shadow-sm)" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--edge)", fontFamily: "'Poppins', serif", fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>
              Coverage Summary Table
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  {["Department", "Total Records", "Linked", "Match Rate", "Review Rate", "PAN %", "GSTIN %", "Last Ingested"].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {depts.map((d) => {
                  const m = DEPT_META[d.code as string] ?? { text: "var(--ink-3)", bg: "var(--surface-2)", border: "var(--edge)" };
                  const mr = d.match_rate_pct as number;
                  return (
                    <tr key={d.code as string}>
                      <td>
                        <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: m.bg, color: m.text, border: `1px solid ${m.border}` }}>
                          {d.code as string}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: "var(--ink)" }}>{(d.total_records as number).toLocaleString()}</td>
                      <td style={{ color: "var(--active)", fontWeight: 600 }}>{(d.linked_records as number).toLocaleString()}</td>
                      <td>
                        <span style={{ fontWeight: 800, color: mr >= 60 ? "var(--active)" : "var(--dormant)" }}>{mr}%</span>
                      </td>
                      <td style={{ color: "var(--navy)", fontWeight: 600 }}>{d.review_rate_pct as number}%</td>
                      <td style={{ color: "var(--ink-2)" }}>{d.pan_coverage_pct as number}%</td>
                      <td style={{ color: "var(--ink-2)" }}>{d.gstin_coverage_pct as number}%</td>
                      <td style={{ color: "var(--ink-3)", fontSize: 11 }}>
                        {d.last_ingested_at ? new Date(d.last_ingested_at as string).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppShell>
  );
}
