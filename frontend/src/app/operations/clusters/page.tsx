"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { listClusters, getCluster } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";

const STATUS_META: Record<string, { color: string; bg: string; border: string }> = {
  ACTIVE:   { color: "var(--active)",  bg: "var(--active-lt)",  border: "rgba(26,107,74,0.25)"  },
  MERGED:   { color: "var(--navy)",    bg: "rgba(13,27,53,0.08)", border: "rgba(13,27,53,0.20)" },
  SPLIT:    { color: "var(--dormant)", bg: "var(--dormant-lt)", border: "rgba(146,64,14,0.25)"  },
  INACTIVE: { color: "var(--ink-3)",   bg: "var(--surface-2)",  border: "var(--edge)"           },
};

export default function ClusterManagementPage() {
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["clusters", statusFilter, page],
    queryFn: () => listClusters({ status: statusFilter || undefined, page, page_size: 20 }).then((r) => r.data),
  });

  const { data: detail } = useQuery({
    queryKey: ["cluster-detail", selectedId],
    queryFn: () => getCluster(selectedId!).then((r) => r.data),
    enabled: !!selectedId,
  });

  const clusters = (data?.results as Record<string, unknown>[]) ?? [];

  return (
    <AppShell title="Cluster Management" subtitle="Browse and correct the AI grouped business clusters before they reach the public registry">

      {/* Summary strip */}
      <div style={{
        background: "var(--surface)", borderRadius: "var(--r-lg)",
        border: "1px solid var(--edge)", padding: "14px 20px",
        marginBottom: 14, display: "flex", gap: 16, alignItems: "center",
        boxShadow: "var(--shadow-sm)",
      }}>
        <div style={{ fontFamily: "'Poppins', serif" }}>
          <span style={{ fontWeight: 900, fontSize: 22, color: "var(--ink)" }}>{data?.total ?? "—"}</span>
          <span style={{ fontSize: 13, color: "var(--ink-3)", marginLeft: 6 }}>
            {statusFilter || "total"} clusters
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
          Each cluster = one real-world business linked across departments
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {["ACTIVE", "MERGED", "SPLIT", ""].map((s) => {
          const m = STATUS_META[s] ?? { color: "var(--ink-2)", bg: "var(--surface)", border: "var(--edge)" };
          const isActive = statusFilter === s;
          return (
            <button key={s || "ALL"} onClick={() => { setStatusFilter(s); setPage(1); }} style={{
              padding: "6px 14px", borderRadius: "var(--r-md)", fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: "1.5px solid", fontFamily: "'Poppins', sans-serif",
              borderColor: isActive ? m.border : "var(--edge)",
              background: isActive ? m.bg : "var(--surface)",
              color: isActive ? m.color : "var(--ink-3)",
              transition: "all 0.12s",
            }}>{s || "All Statuses"}</button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selectedId ? "1fr 420px" : "1fr", gap: 14 }}>
        {/* Cluster list */}
        <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--edge)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
          <table className="data-table">
            <thead>
              <tr>
                {["Canonical Name", "UBID", "Status", "Members", "Depts", "Confidence", ""].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((_, j) => (
                      <td key={j}><div className="skeleton" style={{ height: 12, width: j === 0 ? "80%" : "50%" }} /></td>
                    ))}
                  </tr>
                ))
              ) : clusters.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: "40px 0", textAlign: "center", color: "var(--ink-3)" }}>No clusters found.</td></tr>
              ) : clusters.map((c) => {
                const st = c.status as string;
                const m = STATUS_META[st] ?? STATUS_META.INACTIVE;
                const isSelected = selectedId === c.cluster_id;
                const conf = Math.round((c.confidence_score as number) * 100);
                const confColor = conf >= 85 ? "var(--active)" : conf >= 70 ? "var(--dormant)" : "var(--closed)";
                return (
                  <tr key={c.cluster_id as string}
                    onClick={() => setSelectedId(isSelected ? null : c.cluster_id as string)}
                    style={{ cursor: "pointer", background: isSelected ? "var(--gold-lt)" : "transparent", transition: "background 0.1s" }}
                  >
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)" }}>{(c.canonical_name as string)?.slice(0, 35)}</div>
                      {!!(c.district) && <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 1, fontFamily: "'Poppins', sans-serif" }}>{c.district as string} · {c.primary_pincode as string}</div>}
                    </td>
                    <td>
                      <code style={{ fontSize: 10, color: "var(--gold-dk)", background: "var(--gold-lt)", padding: "2px 6px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace", border: "1px solid rgba(184,132,12,0.20)" }}>
                        {(c.ubid as string)?.slice(0, 20)}
                      </code>
                    </td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>{st}</span>
                    </td>
                    <td style={{ fontWeight: 700, color: "var(--ink)", textAlign: "center" }}>{c.member_count as number}</td>
                    <td style={{ textAlign: "center", color: "var(--ink-3)" }}>{c.dept_count as number}</td>
                    <td style={{ fontWeight: 800, color: confColor, fontFamily: "'Poppins', serif" }}>{conf}%</td>
                    <td>
                      <Link href={`/business/${c.ubid}`} onClick={(e) => e.stopPropagation()} style={{ fontSize: 11, color: "var(--navy)", fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>
                        Profile →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {data && (data.total as number) > 20 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: 14, borderTop: "1px solid var(--edge)" }}>
              <button disabled={page === 1} onClick={() => setPage(page - 1)} style={{ border: "1.5px solid var(--edge)", borderRadius: "var(--r-md)", padding: "6px 14px", background: page === 1 ? "var(--surface-2)" : "var(--surface)", fontSize: 12, cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.5 : 1, color: "var(--ink-2)" }}>← Prev</button>
              <span style={{ fontSize: 12, color: "var(--ink-3)", alignSelf: "center" }}>Page {page} of {Math.ceil((data.total as number) / 20)}</span>
              <button disabled={page * 20 >= (data.total as number)} onClick={() => setPage(page + 1)} style={{ border: "1.5px solid var(--edge)", borderRadius: "var(--r-md)", padding: "6px 14px", background: page * 20 >= (data.total as number) ? "var(--surface-2)" : "var(--surface)", fontSize: 12, cursor: page * 20 >= (data.total as number) ? "not-allowed" : "pointer", opacity: page * 20 >= (data.total as number) ? 0.5 : 1, color: "var(--ink-2)" }}>Next →</button>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedId && detail && (
          <div style={{
            background: "var(--surface)", borderRadius: "var(--r-lg)",
            border: "1px solid var(--edge)", borderLeft: "4px solid var(--gold)",
            overflow: "hidden", height: "fit-content",
            boxShadow: "var(--shadow-md)",
          }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--edge)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'Poppins', serif", fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>Cluster Detail</div>
              <button onClick={() => setSelectedId(null)} style={{ border: "none", background: "none", color: "var(--ink-3)", cursor: "pointer", fontSize: 16 }}>×</button>
            </div>

            <div style={{ padding: "14px 16px" }}>
              <div style={{ fontFamily: "'Poppins', serif", fontWeight: 800, fontSize: 15, color: "var(--ink)", marginBottom: 6 }}>{detail.canonical_name as string}</div>
              <code style={{ fontSize: 10, color: "var(--gold-dk)", background: "var(--gold-lt)", padding: "2px 8px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace", border: "1px solid rgba(184,132,12,0.20)" }}>{detail.ubid as string}</code>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
                {[
                  { l: "Status",      v: detail.status as string },
                  { l: "Members",     v: String(detail.member_count) },
                  { l: "Departments", v: String(detail.dept_count) },
                  { l: "Confidence",  v: `${Math.round((detail.confidence_score as number) * 100)}%` },
                  { l: "District",    v: (detail.district as string) ?? "—" },
                  { l: "Pincode",     v: (detail.primary_pincode as string) ?? "—" },
                ].map((s) => (
                  <div key={s.l} style={{ background: "var(--surface-2)", borderRadius: 7, padding: "8px 10px", border: "1px solid var(--edge)" }}>
                    <div style={{ fontSize: 10, color: "var(--ink-3)", fontWeight: 600, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'Poppins', sans-serif" }}>{s.l}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", fontFamily: "'Poppins', serif" }}>{s.v}</div>
                  </div>
                ))}
              </div>

              {(detail.members as unknown[])?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-2)", marginBottom: 8, fontFamily: "'Poppins', serif" }}>Member Records</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {(detail.members as Record<string, unknown>[]).slice(0, 8).map((m, i) => (
                      <div key={i} style={{ background: "var(--surface-2)", borderRadius: 7, padding: "8px 10px", border: "1px solid var(--edge)", fontSize: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: "rgba(13,27,53,0.08)", color: "var(--navy)", fontFamily: "'Poppins', sans-serif" }}>{m.department_code as string}</span>
                          {!!(m.pan) && <code style={{ fontSize: 10, color: "var(--gold-dk)", fontFamily: "'JetBrains Mono', monospace" }}>{m.pan as string}</code>}
                        </div>
                        {!!(m.normalized_name) && <div style={{ marginTop: 4, fontWeight: 600, color: "var(--ink-2)", fontFamily: "'Poppins', sans-serif" }}>{m.normalized_name as string}</div>}
                        {!!(m.pincode) && <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>{m.pincode as string}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                <Link href={`/business/${detail.ubid}`} style={{
                  flex: 1, display: "block", padding: "9px 0", textAlign: "center",
                  background: "var(--navy)", color: "#fff", borderRadius: "var(--r-md)",
                  fontSize: 12, fontWeight: 700, textDecoration: "none",
                  boxShadow: "0 2px 8px rgba(13,27,53,0.22)", fontFamily: "'Poppins', sans-serif",
                }}>
                  Open Business Profile →
                </Link>
                <Link href={`/graph/${detail.ubid}`} style={{
                  flex: 1, display: "block", padding: "9px 0", textAlign: "center",
                  background: "var(--gold-lt)", color: "var(--gold-dk)", borderRadius: "var(--r-md)",
                  fontSize: 12, fontWeight: 700, textDecoration: "none",
                  border: "1.5px solid rgba(184,132,12,0.30)", fontFamily: "'Poppins', sans-serif",
                }}>
                  Investigate Graph →
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
