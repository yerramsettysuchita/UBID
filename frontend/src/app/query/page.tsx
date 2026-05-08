"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { crossDeptQuery, getQueryPresets } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { AppShell } from "@/components/AppShell";

const DEPT_META: Record<string, { text: string; bg: string; border: string }> = {
  SHOPS:     { text: "var(--navy)",    bg: "rgba(13,27,53,0.07)",  border: "rgba(13,27,53,0.20)"   },
  FACTORIES: { text: "var(--dormant)", bg: "var(--dormant-lt)",    border: "rgba(146,64,14,0.22)"  },
  KSPCB:     { text: "var(--active)",  bg: "var(--active-lt)",     border: "rgba(26,107,74,0.22)"  },
  BESCOM:    { text: "var(--gold-dk)", bg: "var(--gold-lt)",       border: "rgba(184,132,12,0.22)" },
};
const DEPTS = ["SHOPS", "FACTORIES", "KSPCB", "BESCOM"];

interface QueryParams {
  pincode?: string;
  district?: string;
  status?: string;
  must_have_dept: string[];
  must_not_dept: string[];
  no_event_since_days?: number;
  has_event_since_days?: number;
  event_dept?: string;
  min_dept_count: number;
  missing_pan?: boolean;
  missing_gstin?: boolean;
  has_open_review?: boolean;
}

const DEFAULT_PARAMS: QueryParams = {
  must_have_dept: [],
  must_not_dept: [],
  min_dept_count: 1,
};

const labelStyle: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)",
  display: "block", marginBottom: 5,
  textTransform: "uppercase", letterSpacing: "0.07em",
  fontFamily: "'Poppins', sans-serif",
};

export default function CrossDeptQueryPage() {
  const [params, setParams] = useState<QueryParams>(DEFAULT_PARAMS);
  const [activeQuery, setActiveQuery] = useState<QueryParams | null>(null);
  const [page, setPage] = useState(1);
  const [presetExpanded, setPresetExpanded] = useState(true);

  const { data: presets } = useQuery({
    queryKey: ["query-presets"],
    queryFn: () => getQueryPresets().then((r) => r.data),
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["cross-dept-query", activeQuery, page],
    queryFn: () => {
      if (!activeQuery) return null;
      const p: Record<string, unknown> = { page, page_size: 25 };
      if (activeQuery.pincode) p.pincode = activeQuery.pincode;
      if (activeQuery.district) p.district = activeQuery.district;
      if (activeQuery.status) p.status = activeQuery.status;
      if (activeQuery.must_have_dept.length) p["must_have_dept"] = activeQuery.must_have_dept;
      if (activeQuery.must_not_dept.length) p["must_not_dept"] = activeQuery.must_not_dept;
      if (activeQuery.no_event_since_days) p.no_event_since_days = activeQuery.no_event_since_days;
      if (activeQuery.has_event_since_days) p.has_event_since_days = activeQuery.has_event_since_days;
      if (activeQuery.event_dept) p.event_dept = activeQuery.event_dept;
      if (activeQuery.min_dept_count > 1) p.min_dept_count = activeQuery.min_dept_count;
      if (activeQuery.missing_pan != null) p.missing_pan = activeQuery.missing_pan;
      if (activeQuery.missing_gstin != null) p.missing_gstin = activeQuery.missing_gstin;
      if (activeQuery.has_open_review != null) p.has_open_review = activeQuery.has_open_review;
      return crossDeptQuery(p).then((r) => r.data);
    },
    enabled: !!activeQuery,
  });

  function runQuery() { setActiveQuery({ ...params }); setPage(1); }

  function applyPreset(preset: Record<string, unknown>) {
    const p = preset.params as Record<string, unknown>;
    setParams({
      ...DEFAULT_PARAMS,
      pincode: p.pincode as string | undefined,
      district: p.district as string | undefined,
      status: p.status as string | undefined,
      must_have_dept: (p.must_have_dept as string[] | undefined) ?? [],
      must_not_dept: (p.must_not_dept as string[] | undefined) ?? [],
      no_event_since_days: p.no_event_since_days as number | undefined,
      has_event_since_days: p.has_event_since_days as number | undefined,
      event_dept: p.event_dept as string | undefined,
      min_dept_count: (p.min_dept_count as number | undefined) ?? 1,
      missing_pan: p.missing_pan as boolean | undefined,
      has_open_review: p.has_open_review as boolean | undefined,
    });
    setPresetExpanded(false);
  }

  function toggleDept(dept: string, list: "must_have_dept" | "must_not_dept") {
    setParams((prev) => ({
      ...prev,
      [list]: prev[list].includes(dept)
        ? prev[list].filter((d) => d !== dept)
        : [...prev[list], dept],
    }));
  }

  const results = (data?.results as Record<string, unknown>[]) ?? [];

  return (
    <AppShell
      title="Intelligence Query"
      subtitle="Query across all Karnataka government departments simultaneously"
    >
      {/* Preset queries */}
      <div style={{
        background: "var(--surface)", borderRadius: "var(--r-lg)",
        border: "1px solid var(--edge)", marginBottom: 14, overflow: "hidden",
        boxShadow: "var(--shadow-sm)",
      }}>
        <button
          onClick={() => setPresetExpanded(!presetExpanded)}
          style={{
            width: "100%", padding: "13px 18px", background: "none", border: "none",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            cursor: "pointer", fontFamily: "'Poppins', serif",
            fontWeight: 700, fontSize: 13.5, color: "var(--ink)",
          }}
        >
          <span>◈ Example Queries from Specification</span>
          <span style={{ color: "var(--ink-3)", fontSize: 11 }}>{presetExpanded ? "▲" : "▼"}</span>
        </button>
        {presetExpanded && (
          <div style={{
            padding: "0 14px 14px",
            display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10,
            borderTop: "1px solid var(--edge)",
            paddingTop: 14,
          }}>
            {(presets?.presets as Record<string, unknown>[] ?? []).map((p) => (
              <div key={p.name as string}
                onClick={() => applyPreset(p)}
                style={{
                  background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: "12px 14px",
                  border: "1px solid var(--edge)", cursor: "pointer", transition: "border-color 0.12s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--gold)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--edge)")}
              >
                <div style={{ fontWeight: 700, fontSize: 12, color: "var(--ink)", marginBottom: 4, fontFamily: "'Poppins', sans-serif" }}>{p.name as string}</div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", lineHeight: 1.5, marginBottom: 6 }}>{p.description as string}</div>
                <div style={{ fontSize: 10.5, color: "var(--gold-dk)", fontFamily: "'Poppins', sans-serif" }}>◉ {p.insight as string}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 14 }}>
        {/* Query builder */}
        <div style={{
          background: "var(--surface)", borderRadius: "var(--r-lg)",
          border: "1px solid var(--edge)", padding: 20, height: "fit-content",
          boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{ fontFamily: "'Poppins', serif", fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: 18 }}>
            Query Builder
          </div>

          {/* Geographic */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Geographic</label>
            <input value={params.pincode ?? ""} onChange={(e) => setParams((p) => ({ ...p, pincode: e.target.value || undefined }))}
              placeholder="Pincode (e.g. 560001)" className="input-field" style={{ marginBottom: 6, fontSize: 12 }} />
            <input value={params.district ?? ""} onChange={(e) => setParams((p) => ({ ...p, district: e.target.value || undefined }))}
              placeholder="District (e.g. Bengaluru Urban)" className="input-field" style={{ fontSize: 12 }} />
          </div>

          {/* Status */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Business Status</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {(["", "ACTIVE", "DORMANT", "CLOSED", "REVIEW_NEEDED"] as const).map((s) => {
                const isActive = params.status === (s || undefined);
                return (
                  <button key={s} onClick={() => setParams((p) => ({ ...p, status: s || undefined }))} style={{
                    padding: "5px 9px", borderRadius: "var(--r-sm)", fontSize: 10.5, fontWeight: 600, cursor: "pointer",
                    border: "1.5px solid", fontFamily: "'Poppins', sans-serif",
                    borderColor: isActive ? "var(--navy)" : "var(--edge)",
                    background: isActive ? "var(--navy)" : "var(--surface)",
                    color: isActive ? "#fff" : "var(--ink-3)",
                    transition: "all 0.1s",
                  }}>{s || "Any"}</button>
                );
              })}
            </div>
          </div>

          {/* Must have dept */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Must Be Registered With</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {DEPTS.map((d) => {
                const m = DEPT_META[d];
                const isActive = params.must_have_dept.includes(d);
                return (
                  <button key={d} onClick={() => toggleDept(d, "must_have_dept")} style={{
                    padding: "5px 9px", borderRadius: "var(--r-sm)", fontSize: 10.5, fontWeight: 700, cursor: "pointer",
                    border: "1.5px solid", fontFamily: "'Poppins', sans-serif",
                    borderColor: isActive ? m.border : "var(--edge)",
                    background: isActive ? m.bg : "var(--surface)",
                    color: isActive ? m.text : "var(--ink-3)",
                    transition: "all 0.1s",
                  }}>{d}</button>
                );
              })}
            </div>
          </div>

          {/* Must NOT have dept */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Absent From Department</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {DEPTS.map((d) => {
                const isActive = params.must_not_dept.includes(d);
                return (
                  <button key={d} onClick={() => toggleDept(d, "must_not_dept")} style={{
                    padding: "5px 9px", borderRadius: "var(--r-sm)", fontSize: 10.5, fontWeight: 700, cursor: "pointer",
                    border: "1.5px solid", fontFamily: "'Poppins', sans-serif",
                    borderColor: isActive ? "rgba(127,29,29,0.40)" : "var(--edge)",
                    background: isActive ? "var(--closed-lt)" : "var(--surface)",
                    color: isActive ? "var(--closed)" : "var(--ink-3)",
                    transition: "all 0.1s",
                  }}>{d}</button>
                );
              })}
            </div>
          </div>

          {/* Event recency */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Activity Signals</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { label: "No event in last", key: "no_event_since_days" as const },
                { label: "Has event in last", key: "has_event_since_days" as const },
              ].map(({ label, key }) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--ink-2)", width: 120, flexShrink: 0, fontFamily: "'Poppins', sans-serif" }}>{label}</span>
                  <input type="number" min={1} placeholder="days"
                    value={params[key] ?? ""}
                    onChange={(e) => setParams((p) => ({ ...p, [key]: e.target.value ? +e.target.value : undefined }))}
                    style={{ width: 64, border: "1.5px solid var(--edge)", borderRadius: "var(--r-sm)", padding: "5px 8px", fontSize: 11, outline: "none", background: "var(--surface)", color: "var(--ink)" }} />
                  <span style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "'Poppins', sans-serif" }}>days</span>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "var(--ink-2)", width: 120, flexShrink: 0, fontFamily: "'Poppins', sans-serif" }}>Event from dept</span>
                <select value={params.event_dept ?? ""}
                  onChange={(e) => setParams((p) => ({ ...p, event_dept: e.target.value || undefined }))}
                  style={{ border: "1.5px solid var(--edge)", borderRadius: "var(--r-sm)", padding: "5px 8px", fontSize: 11, background: "var(--surface)", color: "var(--ink)", outline: "none" }}>
                  <option value="">Any dept</option>
                  {DEPTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Data quality */}
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Data Quality</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {[
                { label: "Missing PAN",   key: "missing_pan" as const },
                { label: "Missing GSTIN", key: "missing_gstin" as const },
                { label: "Open Reviews",  key: "has_open_review" as const },
              ].map(({ label, key }) => {
                const isActive = params[key] === true;
                return (
                  <button key={key}
                    onClick={() => setParams((p) => ({ ...p, [key]: p[key] === true ? undefined : true }))}
                    style={{
                      padding: "5px 9px", borderRadius: "var(--r-sm)", fontSize: 10.5, fontWeight: 600, cursor: "pointer",
                      border: "1.5px solid", fontFamily: "'Poppins', sans-serif",
                      borderColor: isActive ? "rgba(146,64,14,0.40)" : "var(--edge)",
                      background: isActive ? "var(--dormant-lt)" : "var(--surface)",
                      color: isActive ? "var(--dormant)" : "var(--ink-3)",
                      transition: "all 0.1s",
                    }}
                  >{label}</button>
                );
              })}
            </div>
          </div>

          <button onClick={runQuery} style={{
            width: "100%", padding: "11px 0", background: "var(--navy)",
            color: "#fff", border: "none", borderRadius: "var(--r-md)",
            fontWeight: 800, fontSize: 14, cursor: "pointer",
            boxShadow: "0 4px 14px rgba(13,27,53,0.28)",
            fontFamily: "'Poppins', sans-serif", letterSpacing: "0.01em",
            transition: "all 0.15s",
          }}>
            Run Query →
          </button>
          <button onClick={() => { setParams(DEFAULT_PARAMS); setActiveQuery(null); }} style={{
            width: "100%", padding: "8px 0", background: "transparent", color: "var(--ink-3)",
            border: "none", fontSize: 12, cursor: "pointer", marginTop: 6,
            fontFamily: "'Poppins', sans-serif",
          }}>
            Clear all filters
          </button>
        </div>

        {/* Results */}
        <div>
          {!activeQuery ? (
            <div style={{
              background: "var(--surface)", borderRadius: "var(--r-lg)",
              border: "1px solid var(--edge)", padding: "60px 40px",
              textAlign: "center", boxShadow: "var(--shadow-sm)",
            }}>
              <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.18, color: "var(--ink)" }}>⊕</div>
              <div style={{ fontSize: 15, fontFamily: "'Poppins', serif", fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
                Build a query or select a preset above
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
                This engine answers questions like:<br />
                <em style={{ color: "var(--gold-dk)" }}>"Active factories in 560058 with no KSPCB inspection in 18 months"</em>
              </div>
            </div>
          ) : (
            <div>
              {/* Results header */}
              <div style={{
                background: "var(--surface)", borderRadius: "var(--r-lg)",
                border: "1px solid var(--edge)", padding: "12px 18px",
                marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center",
                boxShadow: "var(--shadow-sm)",
              }}>
                <div>
                  <span style={{ fontWeight: 800, fontSize: 20, color: "var(--ink)", fontFamily: "'Poppins', serif" }}>
                    {data?.total ?? "—"}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--ink-3)", marginLeft: 6 }}>businesses match your query</span>
                  {isFetching && (
                    <span style={{ marginLeft: 10, fontSize: 11, color: "var(--gold-dk)", background: "var(--gold-lt)", padding: "2px 8px", borderRadius: 20, border: "1px solid rgba(184,132,12,0.22)" }}>
                      Updating…
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "'Poppins', sans-serif" }}>
                  Page {page} of {Math.ceil((data?.total ?? 0) / 25)}
                </div>
              </div>

              {isLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[1,2,3].map((i) => <div key={i} className="skeleton" style={{ height: 80, borderRadius: "var(--r-md)" }} />)}
                </div>
              ) : results.length === 0 ? (
                <div style={{
                  background: "var(--surface)", borderRadius: "var(--r-lg)",
                  border: "1px solid var(--edge)", padding: "60px 0", textAlign: "center", color: "var(--ink-3)",
                  boxShadow: "var(--shadow-sm)",
                }}>
                  No businesses match all your conditions. Try relaxing some filters.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {results.map((biz) => {
                    const depts = biz.department_coverage as string[];
                    const lastEvents = biz.last_event_by_dept as Record<string, string>;
                    const daysSince = biz.days_since_last_event as number | null;
                    const activityColor = daysSince == null ? "var(--ink-3)"
                      : daysSince > 365 ? "var(--closed)"
                      : daysSince > 180 ? "var(--dormant)"
                      : "var(--active)";
                    return (
                      <div key={biz.ubid as string} style={{
                        background: "var(--surface)", borderRadius: "var(--r-md)",
                        border: "1px solid var(--edge)", padding: "14px 16px",
                        boxShadow: "var(--shadow-xs)",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                              <StatusBadge status={biz.status as string} size="sm" />
                              <Link href={`/business/${biz.ubid}`} style={{ fontWeight: 700, color: "var(--navy)", fontSize: 13, fontFamily: "'Poppins', sans-serif" }}>
                                {biz.canonical_name as string}
                              </Link>
                            </div>
                            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
                              {depts.map((d) => {
                                const m = DEPT_META[d];
                                return m ? (
                                  <span key={d} style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: m.bg, color: m.text, border: `1px solid ${m.border}` }}>{d}</span>
                                ) : null;
                              })}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "'Poppins', sans-serif" }}>
                              {biz.district as string} · {biz.primary_pincode as string}
                              {!!(biz.canonical_pan) && (
                                <> · PAN: <code style={{ color: "var(--gold-dk)", fontFamily: "'JetBrains Mono', monospace" }}>{biz.canonical_pan as string}</code></>
                              )}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            {daysSince !== null && daysSince !== undefined && (
                              <div style={{ fontSize: 13, fontWeight: 800, color: activityColor, fontFamily: "'Poppins', serif" }}>
                                {daysSince}d ago
                              </div>
                            )}
                            <div style={{ fontSize: 10, color: "var(--ink-3)", marginBottom: 6 }}>last activity</div>
                            <div style={{ display: "flex", gap: 4 }}>
                              <Link href={`/business/${biz.ubid}`} style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", background: "var(--navy)", color: "#fff", borderRadius: "var(--r-sm)", textDecoration: "none", fontFamily: "'Poppins', sans-serif" }}>Profile</Link>
                              <Link href={`/graph/${biz.ubid}`} style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", background: "var(--gold-lt)", color: "var(--gold-dk)", borderRadius: "var(--r-sm)", textDecoration: "none", fontFamily: "'Poppins', sans-serif", border: "1px solid rgba(184,132,12,0.22)" }}>Graph</Link>
                            </div>
                          </div>
                        </div>
                        {Object.keys(lastEvents).length > 0 && (
                          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {Object.entries(lastEvents).map(([dept, last]) => (
                              <span key={dept} style={{ fontSize: 10, color: "var(--ink-3)", background: "var(--surface-2)", padding: "2px 6px", borderRadius: 4, border: "1px solid var(--edge)", fontFamily: "'JetBrains Mono', monospace" }}>
                                {dept}: {last ?? "—"}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {data && (data.total as number) > 25 && (
                <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 14 }}>
                  <button disabled={page === 1} onClick={() => setPage(page - 1)} style={{
                    border: "1.5px solid var(--edge)", borderRadius: "var(--r-md)", padding: "7px 16px",
                    background: page === 1 ? "var(--surface-2)" : "var(--surface)", fontSize: 12,
                    cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.5 : 1,
                    color: "var(--ink-2)", fontFamily: "'Poppins', sans-serif",
                  }}>← Prev</button>
                  <span style={{ fontSize: 12, color: "var(--ink-3)", alignSelf: "center", fontFamily: "'Poppins', sans-serif" }}>
                    Page {page} of {Math.ceil((data.total as number) / 25)}
                  </span>
                  <button disabled={page * 25 >= (data.total as number)} onClick={() => setPage(page + 1)} style={{
                    border: "1.5px solid var(--edge)", borderRadius: "var(--r-md)", padding: "7px 16px",
                    background: page * 25 >= (data.total as number) ? "var(--surface-2)" : "var(--surface)", fontSize: 12,
                    cursor: page * 25 >= (data.total as number) ? "not-allowed" : "pointer",
                    opacity: page * 25 >= (data.total as number) ? 0.5 : 1,
                    color: "var(--ink-2)", fontFamily: "'Poppins', sans-serif",
                  }}>Next →</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
