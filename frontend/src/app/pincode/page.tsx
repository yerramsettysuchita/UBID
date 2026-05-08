"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getPincodeSummary, queryPincodeBusinesses } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { AppShell } from "@/components/AppShell";
import { KpiCard } from "@/components/ui/Card";

const QUICK_PINS = ["560058", "560029", "570012", "560001", "560010", "572120"];

export default function PincodePage() {
  const [input, setInput]     = useState("");
  const [pincode, setPincode] = useState("");
  const [dept, setDept]       = useState("");
  const [status, setStatus]   = useState("");
  const [queried, setQueried] = useState(false);

  const { data: summary, isLoading: sl } = useQuery({
    queryKey: ["pincode-summary", pincode],
    queryFn: () => getPincodeSummary(pincode).then((r) => r.data),
    enabled: !!pincode,
  });

  const { data: biz, isLoading: bl } = useQuery({
    queryKey: ["pincode-biz", pincode, dept, status],
    queryFn: () => queryPincodeBusinesses({ pincode, department: dept || undefined, status: status || undefined }).then((r) => r.data),
    enabled: queried && !!pincode,
  });

  function lookup(e: React.FormEvent) { e.preventDefault(); setPincode(input); setQueried(false); }

  return (
    <AppShell title="Pincode Intelligence" subtitle="Explore business activity and dormancy signals across Karnataka pincodes">

      {/* Lookup bar */}
      <form onSubmit={lookup} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          className="input-field"
          style={{ maxWidth: 200, fontFamily: "'JetBrains Mono', monospace", fontSize: 15, letterSpacing: "0.06em" }}
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="560058"
          maxLength={6}
        />
        <button type="submit" disabled={input.length !== 6} style={{
          background: "var(--navy)", color: "#fff", border: "none", borderRadius: "var(--r-md)",
          padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer",
          opacity: input.length !== 6 ? 0.5 : 1,
          boxShadow: "0 4px 12px rgba(13,27,53,0.25)", fontFamily: "'Poppins', sans-serif",
          transition: "all 0.15s",
        }}>Look up</button>
      </form>

      {/* Quick pins */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "'Poppins', sans-serif" }}>Quick:</span>
        {QUICK_PINS.map((pc) => (
          <button key={pc} onClick={() => { setInput(pc); setPincode(pc); setQueried(false); }} style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: "4px 10px", borderRadius: "var(--r-sm)",
            border: `1.5px solid ${pincode === pc ? "var(--gold)" : "var(--edge)"}`,
            background: pincode === pc ? "var(--gold-lt)" : "var(--surface)",
            color: pincode === pc ? "var(--gold-dk)" : "var(--ink-3)",
            cursor: "pointer", fontWeight: 600, transition: "all 0.1s",
          }}>{pc}</button>
        ))}
      </div>

      {!pincode && (
        <div style={{ textAlign: "center", padding: "80px 0", color: "var(--ink-3)" }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.18, color: "var(--ink)" }}>◎</div>
          <div style={{ fontSize: 16, fontFamily: "'Poppins', serif", fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>Enter a pincode to explore</div>
          <div style={{ fontSize: 13 }}>Cross-department data from Shops, Factories, KSPCB &amp; BESCOM</div>
        </div>
      )}

      {pincode && sl && (
        <div style={{ color: "var(--ink-3)", textAlign: "center", padding: 32 }}>Loading…</div>
      )}

      {pincode && summary && (
        <>
          {/* KPI cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 16 }}>
            <KpiCard label="Total Businesses"  value={summary.total_businesses}     icon="⊞" accent="indigo" />
            <KpiCard label="Active"            value={summary.active_count}          icon="⊕" accent="green"  />
            <KpiCard label="Dormant"           value={summary.dormant_count}         icon="◧" accent="amber"  />
            <KpiCard label="Closed"            value={summary.closed_count}          icon="⊟" accent="red"    />
            <KpiCard label="Review Needed"     value={summary.review_needed_count}   icon="◈" accent="gold"   />
          </div>

          <div style={{
            background: "var(--surface)", borderRadius: "var(--r-lg)",
            border: "1px solid var(--edge)", padding: "14px 20px",
            marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between",
            boxShadow: "var(--shadow-sm)",
          }}>
            <div>
              <span style={{ fontWeight: 800, fontSize: 20, color: "var(--ink)", fontFamily: "'JetBrains Mono', monospace" }}>{summary.pincode}</span>
              <span style={{ fontSize: 14, color: "var(--ink-3)", marginLeft: 12, fontFamily: "'Poppins', sans-serif" }}>{summary.district}</span>
            </div>
            {summary.last_inspection_date && (
              <div style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "'Poppins', sans-serif" }}>
                Last inspection: <strong style={{ color: "var(--ink-2)" }}>{summary.last_inspection_date}</strong>
              </div>
            )}
          </div>

          {/* Advanced query */}
          <div style={{
            background: "var(--surface)", borderRadius: "var(--r-lg)",
            border: "1px solid var(--edge)", padding: 18, marginBottom: 16,
            boxShadow: "var(--shadow-sm)",
          }}>
            <div style={{ fontFamily: "'Poppins', serif", fontWeight: 700, fontSize: 13, color: "var(--ink)", marginBottom: 12 }}>
              Advanced Cross-Department Query
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select value={dept} onChange={(e) => setDept(e.target.value)} style={{ border: "1.5px solid var(--edge)", borderRadius: "var(--r-md)", padding: "8px 12px", fontSize: 13, outline: "none", background: "var(--surface)", color: "var(--ink-2)" }}>
                <option value="">All Departments</option>
                <option value="SHOPS">Shops &amp; Establishments</option>
                <option value="FACTORIES">Factories</option>
                <option value="KSPCB">KSPCB</option>
                <option value="BESCOM">BESCOM</option>
              </select>
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ border: "1.5px solid var(--edge)", borderRadius: "var(--r-md)", padding: "8px 12px", fontSize: 13, outline: "none", background: "var(--surface)", color: "var(--ink-2)" }}>
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="DORMANT">Dormant</option>
                <option value="CLOSED">Closed</option>
              </select>
              <button onClick={() => setQueried(true)} style={{
                background: "var(--navy)", color: "#fff", border: "none", borderRadius: "var(--r-md)",
                padding: "8px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer",
                boxShadow: "0 2px 8px rgba(13,27,53,0.22)", fontFamily: "'Poppins', sans-serif",
              }}>
                Run Query
              </button>
            </div>
          </div>

          {/* Query results */}
          {queried && (
            <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--edge)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--edge)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "'Poppins', serif", fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>Query Results</span>
                {biz && <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{biz.total} businesses</span>}
              </div>
              {bl ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--ink-3)" }}>Querying…</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>Business</th><th>UBID</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {biz?.results?.map((b: Record<string, unknown>) => (
                      <tr key={b.ubid as string}>
                        <td>
                          <Link href={`/business/${b.ubid}`} style={{ fontWeight: 600, color: "var(--navy)", fontSize: 13, fontFamily: "'Poppins', sans-serif" }}>
                            {b.canonical_name as string}
                          </Link>
                        </td>
                        <td>
                          <code style={{ fontSize: 10.5, color: "var(--gold-dk)", background: "var(--gold-lt)", padding: "2px 6px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace", border: "1px solid rgba(184,132,12,0.20)" }}>
                            {b.ubid as string}
                          </code>
                        </td>
                        <td><StatusBadge status={b.status as string} size="sm" /></td>
                      </tr>
                    ))}
                    {biz?.results?.length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ textAlign: "center", color: "var(--ink-3)" }}>
                          No businesses match this query.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
