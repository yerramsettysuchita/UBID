"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { listDistricts, getDistrictDetail, exportDistrictsCSV } from "@/lib/api";
import { AppShell } from "@/components/AppShell";

function RiskBadge({ score }: { score: number }) {
  const color = score >= 70 ? "var(--closed)" : score >= 40 ? "var(--dormant)" : "var(--active)";
  const bg    = score >= 70 ? "var(--closed-lt)" : score >= 40 ? "var(--dormant-lt)" : "var(--active-lt)";
  const border = score >= 70 ? "rgba(127,29,29,0.25)" : score >= 40 ? "rgba(146,64,14,0.25)" : "rgba(26,107,74,0.25)";
  const label = score >= 70 ? "High" : score >= 40 ? "Medium" : "Low";
  return (
    <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 5, background: bg, color, border: `1px solid ${border}` }}>
      {label} Risk
    </span>
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

export default function DistrictAnalyticsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"total" | "dormant_rate_pct" | "risk_score">("total");

  const { data, isLoading } = useQuery({
    queryKey: ["districts"],
    queryFn: () => listDistricts().then((r) => r.data),
  });

  const { data: detail } = useQuery({
    queryKey: ["district-detail", selected],
    queryFn: () => getDistrictDetail(selected!).then((r) => r.data),
    enabled: !!selected,
  });

  function handleExport() {
    exportDistrictsCSV().then((res) => {
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "districts_summary.csv";
      a.click();
    });
  }

  const districts: Record<string, unknown>[] = data?.districts ?? [];
  const sorted = [...districts].sort((a, b) => (b[sortBy] as number) - (a[sortBy] as number));

  const chartData = sorted.slice(0, 10).map((d) => ({
    name: d.district as string,
    active: d.active as number,
    dormant: d.dormant as number,
    review: d.review_needed as number,
  }));

  return (
    <AppShell title="District Analytics" subtitle="Compare business density, dormancy rates and review backlogs across Karnataka districts">

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: "var(--ink-3)", fontFamily: "'Poppins', sans-serif" }}>
          <strong style={{ color: "var(--ink)", fontFamily: "'Poppins', serif", fontSize: 16 }}>{data?.total_districts ?? 0}</strong> districts found
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 6 }}>
          {([["total", "By Total"], ["dormant_rate_pct", "By Dormancy"], ["risk_score", "By Risk"]] as [string, string][]).map(([v, l]) => (
            <button key={v} onClick={() => setSortBy(v as typeof sortBy)} style={{
              padding: "6px 12px", borderRadius: "var(--r-md)", fontWeight: 600, fontSize: 12,
              border: "1.5px solid", fontFamily: "'Poppins', sans-serif", cursor: "pointer",
              borderColor: sortBy === v ? "var(--navy)" : "var(--edge)",
              background: sortBy === v ? "var(--navy)" : "var(--surface)",
              color: sortBy === v ? "#fff" : "var(--ink-3)",
              transition: "all 0.12s",
            }}>{l}</button>
          ))}
        </div>
        <button onClick={handleExport} style={{
          padding: "6px 14px", border: "1.5px solid var(--edge)", borderRadius: "var(--r-md)",
          background: "var(--surface)", color: "var(--navy)", fontWeight: 600, fontSize: 12,
          cursor: "pointer", fontFamily: "'Poppins', sans-serif",
        }}>
          ↓ Export CSV
        </button>
      </div>

      {/* Stacked bar chart */}
      <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--edge)", padding: 20, marginBottom: 16, boxShadow: "var(--shadow-sm)" }}>
        <div className="chart-header" style={{ marginBottom: 14 }}>
          <div>
            <div className="chart-title">Top 10 Districts — Business Composition</div>
            <div className="chart-subtitle">Active · Dormant · Review Needed</div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {[{ c: "#1A6B4A", l: "Active" }, { c: "#92400E", l: "Dormant" }, { c: "#0D1B35", l: "Review" }].map((x) => (
              <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 600, color: "var(--ink-3)" }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: x.c }} />{x.l}
              </div>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barSize={18}>
            <CartesianGrid strokeDasharray="1 6" stroke="#E6E0D4" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 9.5, fill: "#8A95A8", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} />
            <Tooltip content={<Tip />} />
            <Bar dataKey="active"  stackId="a" fill="#1A6B4A" name="Active"  radius={[0,0,0,0]} />
            <Bar dataKey="dormant" stackId="a" fill="#92400E" name="Dormant" radius={[0,0,0,0]} />
            <Bar dataKey="review"  stackId="a" fill="#0D1B35" name="Review"  radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Districts grid + detail panel */}
      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 380px" : "1fr", gap: 14 }}>
        {/* Districts table */}
        <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--edge)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
          {isLoading ? (
            <div style={{ padding: 40, color: "var(--ink-3)", textAlign: "center" }}>Loading districts…</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  {["District", "Total", "Active %", "Dormant %", "Review", "Risk"].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((d) => {
                  const isActive = selected === d.district;
                  return (
                    <tr
                      key={d.district as string}
                      onClick={() => setSelected(isActive ? null : d.district as string)}
                      style={{
                        cursor: "pointer",
                        background: isActive ? "var(--gold-lt)" : "transparent",
                        transition: "background 0.1s",
                      }}
                    >
                      <td style={{ fontWeight: isActive ? 700 : 600, color: isActive ? "var(--gold-dk)" : "var(--ink)", fontSize: 13 }}>
                        {d.district as string}
                      </td>
                      <td style={{ color: "var(--ink-2)", fontSize: 13, fontWeight: 700 }}>{(d.total as number).toLocaleString()}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ flex: 1, height: 4, background: "var(--edge)", borderRadius: 2, overflow: "hidden", minWidth: 40 }}>
                            <div style={{ height: "100%", width: `${d.active_rate_pct}%`, background: "var(--active)", borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--active)", width: 36 }}>{d.active_rate_pct as number}%</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ flex: 1, height: 4, background: "var(--edge)", borderRadius: 2, overflow: "hidden", minWidth: 40 }}>
                            <div style={{ height: "100%", width: `${d.dormant_rate_pct}%`, background: "var(--dormant)", borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--dormant)", width: 36 }}>{d.dormant_rate_pct as number}%</span>
                        </div>
                      </td>
                      <td style={{ color: "var(--navy)", fontWeight: 700, fontSize: 13 }}>{d.review_needed as number}</td>
                      <td><RiskBadge score={d.risk_score as number} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail panel */}
        {selected && detail && (
          <div style={{
            background: "var(--surface)", borderRadius: "var(--r-lg)",
            border: "1px solid var(--edge)", borderLeft: "4px solid var(--gold)",
            padding: 20, position: "sticky", top: 16, maxHeight: "80vh", overflowY: "auto",
            boxShadow: "var(--shadow-md)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: "'Poppins', serif", fontWeight: 800, fontSize: 15, color: "var(--ink)" }}>{selected}</div>
              <button onClick={() => setSelected(null)} style={{ border: "none", background: "none", color: "var(--ink-3)", cursor: "pointer", fontSize: 18 }}>×</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
              {[
                { label: "Total",        value: detail.total_businesses },
                { label: "Active %",     value: `${detail.active_rate_pct}%` },
                { label: "Dormant %",    value: `${detail.dormant_rate_pct}%` },
                { label: "Review Cases", value: detail.pending_review_cases },
              ].map((stat) => (
                <div key={stat.label} style={{ background: "var(--surface-2)", borderRadius: 8, padding: "10px 12px", border: "1px solid var(--edge)", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "var(--ink)", fontFamily: "'Poppins', serif" }}>{stat.value}</div>
                  <div style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2, fontFamily: "'Poppins', sans-serif" }}>{stat.label}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-2)", marginBottom: 8, fontFamily: "'Poppins', serif" }}>Department Split</div>
              {Object.entries(detail.dept_split ?? {}).map(([d, c]) => (
                <div key={d} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: "1px solid var(--surface-2)" }}>
                  <span style={{ color: "var(--ink-2)", fontFamily: "'Poppins', sans-serif" }}>{d}</span>
                  <span style={{ fontWeight: 700, color: "var(--ink)", fontFamily: "'Poppins', serif" }}>{c as number} records</span>
                </div>
              ))}
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-2)", marginBottom: 8, fontFamily: "'Poppins', serif" }}>Top Pincodes</div>
              {(detail.pincodes as Record<string, unknown>[]).slice(0, 8).map((p) => (
                <div key={p.pincode as string} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: "1px solid var(--surface-2)" }}>
                  <code style={{ color: "var(--gold-dk)", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>{p.pincode as string}</code>
                  <span style={{ color: "var(--ink-3)", fontFamily: "'Poppins', sans-serif" }}>{p.count as number} businesses</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
