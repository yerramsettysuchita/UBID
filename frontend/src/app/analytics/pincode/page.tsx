"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  getPincodeIntelligence, getPincodeBusinesses, comparePincodes, exportPincodeCSV,
} from "@/lib/api";
import { AppShell } from "@/components/AppShell";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:        "#1A6B4A",
  DORMANT:       "#92400E",
  CLOSED:        "#B91C1C",
  REVIEW_NEEDED: "#0D1B35",
};

const DEPT_META: Record<string, { text: string; bg: string; barColor: string }> = {
  SHOPS:     { text: "var(--navy)",    bg: "rgba(13,27,53,0.07)",  barColor: "#0D1B35" },
  FACTORIES: { text: "var(--dormant)", bg: "var(--dormant-lt)",    barColor: "#92400E" },
  KSPCB:     { text: "var(--active)",  bg: "var(--active-lt)",     barColor: "#1A6B4A" },
  BESCOM:    { text: "var(--gold-dk)", bg: "var(--gold-lt)",       barColor: "#B8840C" },
};

function Tip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--edge)", borderRadius: 8, padding: "8px 12px", fontSize: 12, boxShadow: "var(--shadow-md)" }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: "var(--ink)", fontFamily: "'Poppins', serif" }}>{label}</div>
      {payload.map((p) => <div key={p.name} style={{ color: "var(--ink-2)" }}>{p.name}: <strong style={{ color: "var(--ink)" }}>{p.value}</strong></div>)}
    </div>
  );
}

export default function PincodeIntelligencePage() {
  const [input, setInput] = useState("");
  const [code, setCode] = useState("");
  const [compareInput, setCompareInput] = useState("");
  const [compareCode, setCompareCode] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["pincode-intel", code],
    queryFn: () => getPincodeIntelligence(code).then((r) => r.data),
    enabled: code.length >= 3,
  });

  const { data: businesses, isLoading: bizLoading } = useQuery({
    queryKey: ["pincode-biz", code, deptFilter, statusFilter],
    queryFn: () => getPincodeBusinesses(code, {
      department: deptFilter || undefined,
      status: statusFilter || undefined,
      page_size: 50,
    }).then((r) => r.data),
    enabled: code.length >= 3,
  });

  const { data: compare } = useQuery({
    queryKey: ["pincode-compare", code, compareCode],
    queryFn: () => comparePincodes(code, compareCode).then((r) => r.data),
    enabled: code.length >= 3 && compareCode.length >= 3,
  });

  function handleExport() {
    exportPincodeCSV(code).then((res) => {
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `pincode_${code}.csv`;
      a.click();
    });
  }

  const statusData = data?.status_split
    ? Object.entries(data.status_split)
        .filter(([, v]) => (v as number) > 0)
        .map(([k, v]) => ({ name: k.replace("_", " "), key: k, val: v as number }))
    : [];

  const deptData = data?.dept_split
    ? Object.entries(data.dept_split).map(([k, v]) => ({ name: k, count: v as number }))
    : [];

  const riskScore = data?.risk_score as number;
  const riskColor = riskScore >= 70 ? "var(--closed)" : riskScore >= 40 ? "var(--dormant)" : "var(--active)";
  const riskLabel = riskScore >= 70 ? "High Risk" : riskScore >= 40 ? "Moderate" : "Low Risk";

  return (
    <AppShell
      title="Pincode Intelligence Center"
      subtitle="Advanced geographic analytics with risk scoring and side by side pincode comparisons"
    >
      {/* Search bar */}
      <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--edge)", padding: 20, marginBottom: 16, boxShadow: "var(--shadow-sm)" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "'Poppins', sans-serif" }}>Search Pincode</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setCode(input.trim())}
                placeholder="e.g. 560001"
                className="input-field"
                style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600, letterSpacing: "0.06em" }}
              />
              <button
                onClick={() => setCode(input.trim())}
                style={{
                  padding: "10px 20px", background: "var(--navy)", color: "#fff",
                  border: "none", borderRadius: "var(--r-md)", fontWeight: 700, fontSize: 13, cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(13,27,53,0.25)", fontFamily: "'Poppins', sans-serif",
                }}
              >Analyse</button>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "'Poppins', sans-serif" }}>Compare With</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={compareInput}
                onChange={(e) => setCompareInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setCompareCode(compareInput.trim())}
                placeholder="Another pincode"
                className="input-field"
                style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600, letterSpacing: "0.06em" }}
              />
              <button
                onClick={() => setCompareCode(compareInput.trim())}
                disabled={!code}
                style={{
                  padding: "10px 20px", background: "var(--dormant)", color: "#fff",
                  border: "none", borderRadius: "var(--r-md)", fontWeight: 700, fontSize: 13,
                  cursor: code ? "pointer" : "not-allowed", opacity: code ? 1 : 0.5,
                  fontFamily: "'Poppins', sans-serif",
                }}
              >Compare</button>
            </div>
          </div>

          {code && (
            <button onClick={handleExport} style={{
              padding: "10px 16px", border: "1.5px solid var(--edge)", borderRadius: "var(--r-md)",
              background: "var(--surface)", color: "var(--navy)", fontWeight: 600, fontSize: 12,
              cursor: "pointer", alignSelf: "flex-end", fontFamily: "'Poppins', sans-serif",
            }}>
              ↓ Export CSV
            </button>
          )}
        </div>
      </div>

      {!code && (
        <div style={{ textAlign: "center", padding: "80px 0", color: "var(--ink-3)" }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.18, color: "var(--ink)" }}>◎</div>
          <div style={{ fontSize: 16, fontFamily: "'Poppins', serif", fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>Enter a pincode above to begin analysis</div>
          <div style={{ fontSize: 13 }}>Get business density, status split, department coverage, risk score, and more</div>
        </div>
      )}

      {code && isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[180, 240, 200].map((h, i) => (
            <div key={i} className="skeleton" style={{ height: h, borderRadius: "var(--r-lg)" }} />
          ))}
        </div>
      )}

      {data && !isLoading && (
        <>
          {/* Hero stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 16, marginBottom: 16 }}>
            <div style={{
              background: "var(--navy)", borderRadius: "var(--r-lg)",
              padding: "24px 28px", minWidth: 200,
              display: "flex", flexDirection: "column", justifyContent: "center", gap: 10,
              border: "1px solid rgba(184,132,12,0.20)",
              boxShadow: "0 4px 16px rgba(13,27,53,0.20)",
            }}>
              <div style={{ fontSize: 11, color: "var(--navy-text)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'Poppins', sans-serif" }}>Pincode</div>
              <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1, color: "#F0E8D8", fontFamily: "'Poppins', serif" }}>{data.pincode}</div>
              <div style={{ fontSize: 13, color: "var(--navy-text)" }}>
                {((data.districts as string[]) ?? []).join(", ") || "Karnataka"}
              </div>
              <div style={{ marginTop: 4, textAlign: "center" }}>
                <div style={{ fontSize: 38, fontWeight: 900, color: riskColor, lineHeight: 1 }}>{riskScore}</div>
                <div style={{ fontSize: 10, fontWeight: 700, marginTop: 3, color: riskColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>{riskLabel}</div>
                <div style={{ fontSize: 10, color: "var(--navy-text)", marginTop: 1 }}>Risk Score</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
              {[
                { label: "Total Businesses", value: (data.total_businesses as number).toLocaleString(), color: "var(--ink)" },
                { label: "Active",           value: `${data.active_rate_pct}%`,                         color: "var(--active)" },
                { label: "Dormant",          value: `${data.dormant_rate_pct}%`,                        color: "var(--dormant)" },
                { label: "Open Review Cases",value: data.pending_review_cases as number,                color: "var(--navy)" },
              ].map((s) => (
                <div key={s.label} style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--edge)", padding: "16px", textAlign: "center", boxShadow: "var(--shadow-sm)" }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: s.color, fontFamily: "'Poppins', serif", letterSpacing: "-0.02em" }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4, fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Charts row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--edge)", padding: 20, boxShadow: "var(--shadow-sm)" }}>
              <div className="chart-header" style={{ marginBottom: 14 }}>
                <div>
                  <div className="chart-title">Status Distribution</div>
                  <div className="chart-subtitle">{data.total_businesses} unified entities</div>
                </div>
              </div>
              {/* Status rail */}
              <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", gap: 2, marginBottom: 14 }}>
                {statusData.map((s) => {
                  const pct = data.total_businesses > 0 ? (s.val / data.total_businesses) * 100 : 0;
                  return (
                    <div key={s.key} style={{ flex: pct, height: "100%", background: STATUS_COLORS[s.key] ?? "#8A95A8", borderRadius: 3, minWidth: pct > 0 ? 3 : 0, position: "relative" }}>
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 60%)", borderRadius: 3 }} />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {statusData.map((s) => {
                  const pct = data.total_businesses > 0 ? Math.round((s.val / data.total_businesses) * 100) : 0;
                  return (
                    <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 9, height: 9, borderRadius: 2, background: STATUS_COLORS[s.key] ?? "#8A95A8", flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "var(--ink-2)", flex: 1 }}>{s.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", fontFamily: "'Poppins', serif" }}>{s.val.toLocaleString()}</span>
                      <span style={{ fontSize: 10, color: "var(--ink-3)", fontWeight: 600, minWidth: 30, textAlign: "right" }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--edge)", padding: 20, boxShadow: "var(--shadow-sm)" }}>
              <div className="chart-header" style={{ marginBottom: 14 }}>
                <div>
                  <div className="chart-title">Department Coverage</div>
                  <div className="chart-subtitle">Source records by department</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={deptData} barSize={28}>
                  <CartesianGrid strokeDasharray="1 6" stroke="#E6E0D4" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#8A95A8", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#8A95A8" }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip content={<Tip />} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Records">
                    {deptData.map((e) => <Cell key={e.name} fill={DEPT_META[e.name]?.barColor ?? "#0D1B35"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top businesses */}
          {(data.top_businesses as Record<string, unknown>[])?.length > 0 && (
            <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--edge)", padding: 20, marginBottom: 16, boxShadow: "var(--shadow-sm)" }}>
              <div style={{ fontFamily: "'Poppins', serif", fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 14 }}>Top Businesses in {data.pincode}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(data.top_businesses as Record<string, unknown>[]).map((b) => {
                  const st = b.status as string;
                  const sc = b.confidence_score as number;
                  const sColor = { ACTIVE: "var(--active)", DORMANT: "var(--dormant)", CLOSED: "var(--closed)", REVIEW_NEEDED: "var(--navy)" }[st] ?? "var(--ink-3)";
                  return (
                    <div key={b.ubid as string} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 14px", background: "var(--surface-2)", borderRadius: "var(--r-md)", border: "1px solid var(--edge)" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", fontFamily: "'Poppins', sans-serif" }}>{b.canonical_name as string}</div>
                        <code style={{ fontSize: 10, color: "var(--gold-dk)", fontFamily: "'JetBrains Mono', monospace" }}>{b.ubid as string}</code>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: `${STATUS_COLORS[st] ?? "#6B7280"}15`, color: sColor }}>{st}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "var(--navy)", fontFamily: "'Poppins', serif" }}>{Math.round(sc * 100)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent events */}
          {(data.recent_events as Record<string, unknown>[])?.length > 0 && (
            <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--edge)", padding: 20, marginBottom: 16, boxShadow: "var(--shadow-sm)" }}>
              <div style={{ fontFamily: "'Poppins', serif", fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 14 }}>Recent Activity in {data.pincode}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(data.recent_events as Record<string, unknown>[]).map((e, i) => {
                  const m = DEPT_META[e.department_code as string];
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: "var(--surface-2)", borderRadius: "var(--r-sm)", border: "1px solid var(--edge)" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: m?.bg ?? "rgba(13,27,53,0.07)", color: m?.text ?? "var(--navy)", fontFamily: "'Poppins', sans-serif" }}>
                        {e.department_code as string}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--ink-2)", flex: 1, fontFamily: "'Poppins', sans-serif" }}>{(e.event_type as string).replace(/_/g, " ")}</span>
                      {!!(e.event_description) && <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{e.event_description as string}</span>}
                      <span style={{ fontSize: 11, color: "var(--ink-3)", flexShrink: 0, fontFamily: "'JetBrains Mono', monospace" }}>{e.event_date as string}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Business table with filters */}
          <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--edge)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--edge)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontFamily: "'Poppins', serif", fontWeight: 700, fontSize: 14, color: "var(--ink)", flex: 1 }}>
                All Businesses in {code} <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 400 }}>({businesses?.total ?? 0} total)</span>
              </div>
              <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} style={{ padding: "6px 10px", border: "1.5px solid var(--edge)", borderRadius: "var(--r-sm)", fontSize: 12, color: "var(--ink-2)", background: "var(--surface)", outline: "none" }}>
                <option value="">All Departments</option>
                {["SHOPS","FACTORIES","KSPCB","BESCOM"].map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: "6px 10px", border: "1.5px solid var(--edge)", borderRadius: "var(--r-sm)", fontSize: 12, color: "var(--ink-2)", background: "var(--surface)", outline: "none" }}>
                <option value="">All Statuses</option>
                {["ACTIVE","DORMANT","CLOSED","REVIEW_NEEDED"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  {["Business Name", "UBID", "Status", "Confidence"].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bizLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(4)].map((_, j) => (
                        <td key={j}><div className="skeleton" style={{ height: 12, width: j === 0 ? "70%" : "50%" }} /></td>
                      ))}
                    </tr>
                  ))
                ) : (
                  (businesses?.results ?? []).map((b: Record<string, unknown>) => {
                    const st = b.status as string;
                    const conf = Math.round((b.confidence_score as number) * 100);
                    const confColor = conf >= 85 ? "var(--active)" : conf >= 70 ? "var(--dormant)" : "var(--closed)";
                    return (
                      <tr key={b.ubid as string}>
                        <td style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)" }}>{b.canonical_name as string}</td>
                        <td>
                          <code style={{ fontSize: 10.5, color: "var(--gold-dk)", background: "var(--gold-lt)", padding: "2px 6px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace", border: "1px solid rgba(184,132,12,0.20)" }}>{b.ubid as string}</code>
                        </td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: `${STATUS_COLORS[st] ?? "#6B7280"}15`, color: STATUS_COLORS[st] ?? "var(--ink-3)" }}>{st}</span>
                        </td>
                        <td style={{ fontWeight: 800, color: confColor, fontSize: 13, fontFamily: "'Poppins', serif" }}>
                          {conf}%
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Comparison panel */}
      {compare && (
        <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--edge)", padding: 20, marginTop: 16, boxShadow: "var(--shadow-sm)" }}>
          <div style={{ fontFamily: "'Poppins', serif", fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 16 }}>
            Pincode Comparison:{" "}
            <span style={{ color: "var(--navy)", fontFamily: "'JetBrains Mono', monospace" }}>{compare.pincode_a?.pincode}</span>
            {" "}vs{" "}
            <span style={{ color: "var(--dormant)", fontFamily: "'JetBrains Mono', monospace" }}>{compare.pincode_b?.pincode}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[compare.pincode_a, compare.pincode_b].map((p: Record<string, unknown>, i: number) => (
              <div key={i} style={{
                background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: 16,
                border: "1px solid var(--edge)",
                borderTop: `4px solid ${i === 0 ? "var(--navy)" : "var(--dormant)"}`,
              }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: i === 0 ? "var(--navy)" : "var(--dormant)", marginBottom: 12, fontFamily: "'JetBrains Mono', monospace" }}>{p?.pincode as string}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { label: "Total",        value: p?.total as number },
                    { label: "Active %",     value: `${p?.active_rate_pct}%` },
                    { label: "Dormant %",    value: `${p?.dormant_rate_pct}%` },
                    { label: "Review Cases", value: p?.pending_review_cases as number },
                  ].map((stat) => (
                    <div key={stat.label} style={{ background: "var(--surface)", borderRadius: 8, padding: "10px 12px", border: "1px solid var(--edge)", textAlign: "center" }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: "var(--ink)", fontFamily: "'Poppins', serif" }}>{stat.value}</div>
                      <div style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2, fontFamily: "'Poppins', sans-serif" }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
