"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { searchBusinesses } from "@/lib/api";
import { useDebounce } from "@/lib/useDebounce";
import { StatusBadge } from "@/components/StatusBadge";
import { AppShell } from "@/components/AppShell";

const DEPT_META: Record<string, { label: string; color: string; bg: string }> = {
  SHOPS:       { label: "S&E",        color: "#1E40AF", bg: "#EFF6FF" },
  FACTORIES:   { label: "Factory",    color: "#92400E", bg: "#FEF3E2" },
  KSPCB:       { label: "KSPCB",      color: "#065F46", bg: "#ECFDF5" },
  BESCOM:      { label: "BESCOM",     color: "#5B21B6", bg: "#F5F3FF" },
  BBMP:        { label: "BBMP",       color: "#1D4ED8", bg: "#DBEAFE" },
  PROF_TAX:    { label: "Prof Tax",   color: "#7C3AED", bg: "#EDE9FE" },
  HESCOM:      { label: "HESCOM",     color: "#B45309", bg: "#FEF3C7" },
  LABOUR:      { label: "Labour",     color: "#DC2626", bg: "#FEE2E2" },
  FOOD_SAFETY: { label: "FSSAI",      color: "#059669", bg: "#D1FAE5" },
  MSME:        { label: "MSME",       color: "#0E7490", bg: "#CFFAFE" },
};

const STATUS_OPTIONS = [
  { value: "",               label: "All Statuses" },
  { value: "ACTIVE",         label: "Active" },
  { value: "DORMANT",        label: "Dormant" },
  { value: "CLOSED",         label: "Closed" },
  { value: "REVIEW_NEEDED",  label: "Needs Review" },
];

const DEPT_OPTIONS = [
  { value: "",           label: "All Departments" },
  { value: "SHOPS",      label: "Shops & Establishments" },
  { value: "FACTORIES",  label: "Factories & Boilers" },
  { value: "KSPCB",      label: "Pollution Control Board" },
  { value: "BESCOM",     label: "Electricity (BESCOM)" },
];

function ConfBar({ pct, color }: { pct: number; color: string }) {
  const label = pct >= 90 ? "PAN/GSTIN" : pct >= 85 ? "Auto-linked" : pct >= 70 ? "Fuzzy match" : "Low";
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
        <div style={{ flex: 1, height: 4, background: "var(--surface-2)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.6s ease" }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color, width: 34, textAlign: "right" }}>{pct}%</span>
      </div>
      <div style={{ fontSize: 9.5, color: "var(--ink-3)", textAlign: "right", fontFamily: "'Poppins', sans-serif" }}>{label}</div>
    </div>
  );
}

export default function SearchPage() {
  const [draft, setDraft]       = useState("");
  const [query, setQuery]       = useState("");
  const [status, setStatus]     = useState("");
  const [page, setPage]         = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const [department,    setDepartment]    = useState("");
  const [districtDraft, setDistrictDraft] = useState("");
  const [pincodeDraft,  setPincodeDraft]  = useState("");
  const [confMinDraft,  setConfMinDraft]  = useState("");
  const [confMaxDraft,  setConfMaxDraft]  = useState("");
  const [hasPan,        setHasPan]        = useState<boolean | null>(null);
  const [hasGstin,      setHasGstin]      = useState<boolean | null>(null);
  const [hasReview,     setHasReview]     = useState<boolean | null>(null);

  const district = useDebounce(districtDraft, 500);
  const pincode  = useDebounce(pincodeDraft, 500);
  const confMin  = useDebounce(confMinDraft, 500);
  const confMax  = useDebounce(confMaxDraft, 500);

  const activeFilters = [department, district, pincode, confMin, confMax,
    hasPan !== null, hasGstin !== null, hasReview !== null].filter(Boolean).length;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["search", query, status, page, department, district, pincode, confMin, confMax, hasPan, hasGstin, hasReview],
    queryFn: () => searchBusinesses({
      q:              query      || undefined,
      status:         status     || undefined,
      page,
      department:     department || undefined,
      district:       district   || undefined,
      pincode:        pincode    || undefined,
      confidence_min: confMin    ? parseFloat(confMin) / 100 : undefined,
      confidence_max: confMax    ? parseFloat(confMax) / 100 : undefined,
      has_pan:        hasPan     !== null ? hasPan    : undefined,
      has_gstin:      hasGstin   !== null ? hasGstin  : undefined,
      has_review:     hasReview  !== null ? hasReview : undefined,
    }).then((r) => r.data),
  });

  function submit(e: React.FormEvent) { e.preventDefault(); setQuery(draft); setPage(1); }

  function clearFilters() {
    setDepartment(""); setDistrictDraft(""); setPincodeDraft(""); setConfMinDraft(""); setConfMaxDraft("");
    setHasPan(null); setHasGstin(null); setHasReview(null); setPage(1);
  }

  const btnStyle = (active: boolean, color = "var(--navy)"): React.CSSProperties => ({
    padding: "5px 12px", borderRadius: 6, fontSize: 11.5, fontWeight: 600,
    cursor: "pointer", transition: "all 0.12s",
    border: `1.5px solid ${active ? color : "var(--edge)"}`,
    background: active ? color : "var(--surface)",
    color: active ? "#fff" : "var(--ink-3)",
  });

  return (
    <AppShell
      title="Business Search"
      subtitle="Find any registered business across all Karnataka government departments"

    >
      {/* Search bar */}
      <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--edge)", padding: "16px 18px", marginBottom: 12, boxShadow: "var(--shadow-sm)" }}>
        <form onSubmit={submit} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {/* Text input */}
          <div style={{ flex: 1, minWidth: 280, position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)", fontSize: 14, pointerEvents: "none" }}>⊛</span>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Business name, UBID, PAN or GSTIN…"
              className="input-field"
              style={{ paddingLeft: 34, fontSize: 13.5 }}
            />
          </div>

          {/* Status dropdown */}
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={{
            border: "1.5px solid var(--edge)", borderRadius: "var(--r-md)",
            padding: "10px 12px", fontSize: 13, color: "var(--ink-2)",
            background: "var(--surface)", outline: "none", cursor: "pointer",
            boxShadow: "var(--shadow-xs)",
          }}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* Filters toggle */}
          <button type="button" onClick={() => setShowFilters((v) => !v)} style={{
            padding: "10px 14px", borderRadius: "var(--r-md)", fontSize: 13, cursor: "pointer",
            border: "1.5px solid",
            borderColor: showFilters || activeFilters > 0 ? "var(--gold)" : "var(--edge)",
            background: showFilters || activeFilters > 0 ? "var(--gold-lt)" : "var(--surface)",
            color: showFilters || activeFilters > 0 ? "var(--gold-dk)" : "var(--ink-3)",
            fontWeight: 600, position: "relative",
            boxShadow: "var(--shadow-xs)",
          }}>
            ⊟ Filters{activeFilters > 0 && (
              <span style={{
                position: "absolute", top: -6, right: -6,
                width: 17, height: 17, borderRadius: "50%",
                background: "var(--gold)", color: "#fff", fontSize: 9, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{activeFilters}</span>
            )}
          </button>

          <button type="submit" style={{
            padding: "10px 22px", background: "var(--navy)", color: "#fff",
            border: "none", borderRadius: "var(--r-md)", fontWeight: 600, fontSize: 13,
            cursor: "pointer", boxShadow: "0 4px 12px rgba(13,27,53,0.25)",
            letterSpacing: "0.01em",
          }}>
            Search
          </button>
        </form>

        {/* Advanced filters panel */}
        {showFilters && (
          <div style={{
            marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--edge)",
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px 20px",
          }}>
            {/* Department */}
            <div>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>Department</label>
              <select value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1); }} style={{ width: "100%", border: "1.5px solid var(--edge)", borderRadius: "var(--r-sm)", padding: "8px 10px", fontSize: 12, color: "var(--ink-2)", background: "var(--surface)", outline: "none" }}>
                {DEPT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Pincode */}
            <div>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>Pincode</label>
              <input
                value={pincodeDraft}
                onChange={(e) => setPincodeDraft(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="e.g. 560058"
                maxLength={6}
                style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid var(--edge)", borderRadius: "var(--r-sm)", padding: "8px 10px", fontSize: 12, color: "var(--ink-2)", background: "var(--surface)", outline: "none", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em" }}
              />
            </div>

            {/* District */}
            <div>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>District</label>
              <input value={districtDraft} onChange={(e) => setDistrictDraft(e.target.value)} placeholder="e.g. Bengaluru Urban" style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid var(--edge)", borderRadius: "var(--r-sm)", padding: "8px 10px", fontSize: 12, color: "var(--ink-2)", background: "var(--surface)", outline: "none" }} />
            </div>

            {/* Confidence range */}
            <div>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>Confidence %</label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input type="number" min={0} max={100} value={confMinDraft} onChange={(e) => setConfMinDraft(e.target.value)} placeholder="Min" style={{ width: "45%", border: "1.5px solid var(--edge)", borderRadius: "var(--r-sm)", padding: "8px 10px", fontSize: 12, outline: "none", background: "var(--surface)" }} />
                <span style={{ color: "var(--edge-2)", fontSize: 11 }}>—</span>
                <input type="number" min={0} max={100} value={confMaxDraft} onChange={(e) => setConfMaxDraft(e.target.value)} placeholder="Max" style={{ width: "45%", border: "1.5px solid var(--edge)", borderRadius: "var(--r-sm)", padding: "8px 10px", fontSize: 12, outline: "none", background: "var(--surface)" }} />
              </div>
            </div>

            {/* Toggles */}
            <div>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>PAN Status</label>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" style={btnStyle(hasPan === true)} onClick={() => { setHasPan(hasPan === true ? null : true); setPage(1); }}>Has PAN</button>
                <button type="button" style={btnStyle(hasPan === false, "var(--closed)")} onClick={() => { setHasPan(hasPan === false ? null : false); setPage(1); }}>No PAN</button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>GSTIN Status</label>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" style={btnStyle(hasGstin === true)} onClick={() => { setHasGstin(hasGstin === true ? null : true); setPage(1); }}>Has GSTIN</button>
                <button type="button" style={btnStyle(hasGstin === false, "var(--closed)")} onClick={() => { setHasGstin(hasGstin === false ? null : false); setPage(1); }}>No GSTIN</button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>Review Status</label>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" style={btnStyle(hasReview === true, "var(--dormant)")} onClick={() => { setHasReview(hasReview === true ? null : true); setPage(1); }}>Has Review</button>
              </div>
            </div>

            {activeFilters > 0 && (
              <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
                <button type="button" onClick={clearFilters} style={{ fontSize: 12, color: "var(--closed)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                  ✕ Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results header */}
      {data && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "0 2px" }}>
          <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
            <strong style={{ color: "var(--ink)", fontFamily: "'Poppins', sans-serif", fontSize: 16, fontWeight: 800 }}>{data.total.toLocaleString()}</strong>
            {" "}result{data.total !== 1 ? "s" : ""} found
            {query && <> for <span style={{ color: "var(--gold-dk)", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>"{query}"</span></>}
            {activeFilters > 0 && <span style={{ color: "var(--gold)", fontWeight: 600 }}> · {activeFilters} filter{activeFilters > 1 ? "s" : ""}</span>}
          </div>
          {isFetching && (
            <span style={{ fontSize: 11, color: "var(--gold-dk)", background: "var(--gold-lt)", padding: "2px 10px", borderRadius: 20, fontWeight: 600, border: "1px solid rgba(184,132,12,0.25)" }}>
              Updating…
            </span>
          )}
        </div>
      )}

      {/* Results table */}
      <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--edge)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Business Name</th>
              <th>UBID</th>
              <th>Status</th>
              <th>Location</th>
              <th>Departments</th>
              <th style={{ textAlign: "right" }}>AI Confidence</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(7)].map((_, i) => (
                <tr key={i}>
                  {[70, 55, 40, 50, 55, 30].map((w, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 12, width: `${w}%` }} /></td>
                  ))}
                </tr>
              ))
            ) : data?.results?.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div style={{ textAlign: "center", padding: "52px 0", color: "var(--ink-3)" }}>
                    <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>⊛</div>
                    <div style={{ fontSize: 14, fontFamily: "'Poppins', sans-serif", fontWeight: 600, color: "var(--ink-2)" }}>No businesses found</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Try different keywords or adjust filters</div>
                  </div>
                </td>
              </tr>
            ) : (
              data?.results?.map((b: Record<string, unknown>) => {
                const conf = Math.round(((b.confidence_score as number) ?? 0) * 100);
                const confColor = conf >= 85 ? "var(--active)" : conf >= 70 ? "var(--dormant)" : "var(--closed)";
                return (
                  <tr key={b.ubid as string} className="fade-in">
                    <td>
                      <Link href={`/business/${b.ubid}`} style={{ fontWeight: 600, color: "var(--navy)", fontSize: 13, fontFamily: "'Poppins', sans-serif" }}>
                        {b.canonical_name as string}
                      </Link>
                    </td>
                    <td>
                      <code style={{ fontSize: 10.5, color: "var(--gold-dk)", background: "var(--gold-lt)", padding: "2px 7px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace", border: "1px solid rgba(184,132,12,0.20)" }}>
                        {(b.ubid as string)?.slice(0, 22)}
                      </code>
                    </td>
                    <td><StatusBadge status={b.status as string} size="sm" /></td>
                    <td style={{ fontSize: 12, color: "var(--ink-3)" }}>
                      {b.district as string}{!!(b.primary_pincode) && ` · ${b.primary_pincode}`}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {((b.department_coverage as string[]) || []).map((d) => {
                          const m = DEPT_META[d];
                          return m ? (
                            <span key={d} style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: m.bg, color: m.color, border: `1px solid ${m.color}25`, letterSpacing: "0.03em" }}>{m.label}</span>
                          ) : null;
                        })}
                      </div>
                    </td>
                    <td style={{ width: 120 }}>
                      <ConfBar pct={conf} color={confColor} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.total > 20 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 18 }}>
          {[
            { label: "← Prev",          disabled: page === 1,              onClick: () => setPage(page - 1) },
            { label: `${page} of ${Math.ceil(data.total / 20)}`, disabled: true, onClick: () => {} },
            { label: "Next →",          disabled: page * 20 >= data.total, onClick: () => setPage(page + 1) },
          ].map((btn) => (
            <button key={btn.label} disabled={btn.disabled} onClick={btn.onClick} style={{
              border: "1.5px solid var(--edge)", borderRadius: "var(--r-md)",
              padding: "7px 16px", background: btn.disabled ? "var(--surface-2)" : "var(--surface)",
              fontSize: 12, fontWeight: 500, color: btn.disabled ? "var(--ink-3)" : "var(--ink-2)",
              cursor: btn.disabled ? "not-allowed" : "pointer",
              boxShadow: btn.disabled ? "none" : "var(--shadow-xs)",
              fontFamily: "'Poppins', sans-serif",
            }}>{btn.label}</button>
          ))}
        </div>
      )}
    </AppShell>
  );
}
