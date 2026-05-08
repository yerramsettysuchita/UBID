"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getReviewQueue, bulkDecideCases, runPrioritization, assignCase, listReviewers } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { AppShell } from "@/components/AppShell";
import { KpiCard } from "@/components/ui/Card";

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  P1: { label: "P1 Critical", color: "#991B1B", bg: "#FEE2E2",   border: "rgba(153,27,27,0.25)" },
  P2: { label: "P2 High",     color: "#92400E", bg: "#FEF3E2",   border: "rgba(146,64,14,0.25)" },
  P3: { label: "P3 Normal",   color: "#1E40AF", bg: "#EFF6FF",   border: "rgba(30,64,175,0.20)" },
  P4: { label: "P4 Low",      color: "var(--ink-3)", bg: "var(--surface-2)", border: "var(--edge)" },
};

function PriorityBadge({ level }: { level: string }) {
  const cfg = PRIORITY_CONFIG[level] ?? PRIORITY_CONFIG["P3"];
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      letterSpacing: "0.04em", textTransform: "uppercase",
      fontFamily: "'Poppins', sans-serif",
    }}>
      {cfg.label}
    </span>
  );
}

function SLAChip({ hoursLeft, breach }: { hoursLeft: number | null; breach: boolean }) {
  if (hoursLeft === null) return null;
  const color = breach ? "var(--closed)" : hoursLeft < 4 ? "var(--dormant)" : "var(--ink-3)";
  const bg    = breach ? "var(--closed-lt)" : hoursLeft < 4 ? "var(--dormant-lt)" : "var(--surface-2)";
  const label = breach
    ? "SLA BREACHED"
    : hoursLeft < 24 ? `${hoursLeft.toFixed(1)} h left` : `${(hoursLeft / 24).toFixed(1)} d left`;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
      background: bg, color, border: `1px solid ${breach ? "rgba(127,29,29,0.25)" : "var(--edge)"}`,
      fontFamily: "'Poppins', sans-serif",
    }}>
      {breach ? "⚠ " : "⏱ "}{label}
    </span>
  );
}

function ConfBar({ label, value }: { label: string; value: number | null }) {
  const pct = value != null ? Math.round(value * 100) : 0;
  const color = pct > 75 ? "var(--active)" : pct > 50 ? "var(--dormant)" : "var(--closed)";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4, color: "var(--ink-3)" }}>
        <span>{label}</span>
        <strong style={{ color, fontFamily: "'Poppins', serif" }}>{value != null ? `${pct}%` : "—"}</strong>
      </div>
      <div style={{ height: 4, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

export default function ReviewQueuePage() {
  const { user } = useAuthStore();
  const canPrioritize = user?.role === "SUPERVISOR" || user?.role === "ADMIN";
  const canAssign     = user?.role === "SUPERVISOR" || user?.role === "ADMIN";
  const qc = useQueryClient();

  const [filter, setFilter]           = useState("PENDING");
  const [assigningCase, setAssigningCase] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [bulkReason, setBulkReason]   = useState("");
  const [bulkMsg, setBulkMsg]         = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["review-queue", filter, priorityFilter],
    queryFn: () => getReviewQueue({ status: filter, priority: priorityFilter || undefined }).then((r) => r.data),
  });

  const prioritize = useMutation({
    mutationFn: () => runPrioritization(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["review-queue"] }),
  });

  const bulkDecide = useMutation({
    mutationFn: (decision: string) =>
      bulkDecideCases({ case_ids: Array.from(selected), decision, reason: bulkReason }),
    onSuccess: (res) => {
      setBulkMsg(`Processed ${res.data.processed} · skipped ${res.data.skipped}`);
      setSelected(new Set()); setBulkReason("");
      qc.invalidateQueries({ queryKey: ["review-queue"] });
      setTimeout(() => setBulkMsg(null), 4000);
    },
  });

  const { data: reviewersList } = useQuery({
    queryKey: ["reviewers-list"],
    queryFn: () => listReviewers().then((r) => r.data),
    enabled: canAssign,
  });

  const doAssign = useMutation({
    mutationFn: ({ caseId, reviewerId }: { caseId: string; reviewerId: string }) =>
      assignCase(caseId, reviewerId),
    onSuccess: () => { setAssigningCase(null); qc.invalidateQueries({ queryKey: ["review-queue"] }); },
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const cases: Record<string, unknown>[] = data?.results ?? [];
  const slaBreaches = cases.filter((c) => c.sla_breach).length;

  const STATUS_TABS = [
    { v: "PENDING",   l: "Pending" },
    { v: "ESCALATED", l: "Escalated" },
    { v: "APPROVED",  l: "Approved" },
    { v: "REJECTED",  l: "Rejected" },
  ];

  return (
    <AppShell title="Review Queue" subtitle="Uncertain business matches waiting for a human decision">

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        <KpiCard label="Pending Review" value={data?.pending_count ?? 0}   icon="◧" accent="indigo" delta="Awaiting decision" />
        <KpiCard label="Escalated"      value={data?.escalated_count ?? 0} icon="◈" accent="amber"  delta="Supervisor needed" />
        <KpiCard label="SLA Breaches"   value={slaBreaches}                icon="⊡" accent="red"   delta="Past deadline" />
        <KpiCard label="Total in Queue" value={data?.total ?? 0}           icon="⊞" accent="green"  delta="All statuses" />
      </div>

      {/* Toolbar */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--edge)", borderRadius: "var(--r-lg)",
        padding: "12px 16px", marginBottom: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
        boxShadow: "var(--shadow-xs)",
      }}>
        {/* Status tabs */}
        <div style={{ display: "flex", gap: 3, background: "var(--surface-2)", borderRadius: 8, padding: 3 }}>
          {STATUS_TABS.map(({ v, l }) => (
            <button key={v} onClick={() => { setFilter(v); setSelected(new Set()); }} style={{
              padding: "5px 14px", borderRadius: 6, fontWeight: 600, fontSize: 12,
              border: "none", cursor: "pointer", transition: "all 0.12s",
              fontFamily: "'Poppins', sans-serif", letterSpacing: "0.01em",
              background: filter === v ? "var(--navy)" : "transparent",
              color: filter === v ? "#fff" : "var(--ink-3)",
              boxShadow: filter === v ? "0 1px 4px rgba(13,27,53,0.25)" : "none",
            }}>{l}</button>
          ))}
        </div>

        {/* Priority filter */}
        <div style={{ display: "flex", gap: 3, marginLeft: 6 }}>
          {([null, "P1","P2","P3","P4"] as (string|null)[]).map((p) => {
            const cfg = p ? PRIORITY_CONFIG[p] : null;
            const active = priorityFilter === p;
            return (
              <button key={p ?? "all"} onClick={() => setPriorityFilter(p)} style={{
                padding: "5px 10px", borderRadius: 6, fontWeight: 600, fontSize: 11,
                border: `1px solid ${active ? (cfg?.border ?? "rgba(184,132,12,0.35)") : "var(--edge)"}`,
                background: active ? (cfg?.bg ?? "var(--gold-lt)") : "var(--surface)",
                color: active ? (cfg?.color ?? "var(--gold-dk)") : "var(--ink-3)",
                cursor: "pointer", transition: "all 0.12s",
                fontFamily: "'Poppins', sans-serif",
              }}>{p ?? "All"}</button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        {filter === "PENDING" && canPrioritize && (
          <button
            onClick={() => prioritize.mutate()}
            disabled={prioritize.isPending}
            style={{
              padding: "7px 16px", borderRadius: "var(--r-md)", fontSize: 12, fontWeight: 700,
              border: "1.5px solid var(--gold)", background: "var(--gold-lt)", color: "var(--gold-dk)",
              cursor: prioritize.isPending ? "not-allowed" : "pointer",
              fontFamily: "'Poppins', sans-serif", letterSpacing: "0.02em",
              opacity: prioritize.isPending ? 0.6 : 1,
            }}
          >
            {prioritize.isPending ? "Computing…" : "↻ Recompute Priorities"}
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div style={{
          background: "var(--navy)", borderRadius: "var(--r-lg)", padding: "12px 18px",
          marginBottom: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
          border: "1px solid rgba(184,132,12,0.20)",
          boxShadow: "0 4px 16px rgba(13,27,53,0.25)",
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)", fontFamily: "'Poppins', serif" }}>
            {selected.size} case{selected.size > 1 ? "s" : ""} selected
          </span>
          <input
            value={bulkReason}
            onChange={(e) => setBulkReason(e.target.value)}
            placeholder="Reason for bulk action…"
            style={{
              flex: 1, minWidth: 200, padding: "7px 12px", borderRadius: "var(--r-md)",
              border: "1px solid rgba(184,132,12,0.30)",
              background: "rgba(255,255,255,0.06)", color: "#F0E8D8",
              fontSize: 12, outline: "none", fontFamily: "'Poppins', sans-serif",
            }}
          />
          {[
            { label: "Approve All",  decision: "APPROVED_MERGE", color: "var(--active)",  bg: "rgba(26,107,74,0.25)" },
            { label: "Reject All",   decision: "REJECTED_MERGE", color: "var(--closed)",  bg: "rgba(127,29,29,0.25)" },
            { label: "Escalate All", decision: "ESCALATED",      color: "var(--dormant)", bg: "rgba(146,64,14,0.25)" },
          ].map((btn) => (
            <button
              key={btn.decision}
              disabled={!bulkReason.trim() || bulkDecide.isPending}
              onClick={() => bulkDecide.mutate(btn.decision)}
              style={{
                padding: "7px 14px", border: `1px solid ${btn.color}40`,
                borderRadius: "var(--r-md)",
                background: !bulkReason.trim() ? "rgba(255,255,255,0.05)" : btn.bg,
                color: !bulkReason.trim() ? "rgba(200,185,156,0.30)" : btn.color,
                fontWeight: 700, fontSize: 12, cursor: "pointer",
                fontFamily: "'Poppins', sans-serif",
                transition: "all 0.12s",
              }}
            >{btn.label}</button>
          ))}
          <button onClick={() => setSelected(new Set())} style={{
            padding: "6px 12px", border: "1px solid rgba(200,185,156,0.20)",
            borderRadius: "var(--r-md)", background: "transparent",
            color: "rgba(200,185,156,0.50)", fontSize: 12, cursor: "pointer",
            fontFamily: "'Poppins', sans-serif",
          }}>✕ Clear</button>
        </div>
      )}

      {/* Bulk success message */}
      {bulkMsg && (
        <div style={{
          background: "var(--active-lt)", border: "1px solid rgba(26,107,74,0.25)",
          borderRadius: "var(--r-md)", padding: "10px 16px",
          fontSize: 13, color: "var(--active)", marginBottom: 12,
          display: "flex", alignItems: "center", gap: 8,
          fontFamily: "'Poppins', sans-serif",
        }}>
          ✓ {bulkMsg}
        </div>
      )}

      {/* Select all row */}
      {filter === "PENDING" && cases.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, paddingLeft: 4 }}>
          <input type="checkbox"
            checked={selected.size === cases.length && cases.length > 0}
            onChange={() => selected.size === cases.length ? setSelected(new Set()) : setSelected(new Set(cases.map((c) => c.case_id as string)))}
            style={{ width: 14, height: 14, cursor: "pointer", accentColor: "var(--navy)" }}
          />
          <span style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "'Poppins', sans-serif" }}>
            {selected.size === cases.length && cases.length > 0 ? "Deselect all" : `Select all ${cases.length}`}
          </span>
        </div>
      )}

      {/* Cases list */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 150, borderRadius: "var(--r-lg)" }} />)}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {cases.map((c) => {
            const ra = c.record_a as Record<string, unknown>;
            const rb = c.record_b as Record<string, unknown>;
            const conf = Math.round((c.confidence_score as number) * 100);
            const confColor = conf < 60 ? "var(--closed)" : conf < 75 ? "var(--dormant)" : "var(--active)";
            const isSelected = selected.has(c.case_id as string);
            const breach = c.sla_breach as boolean;

            return (
              <div key={c.case_id as string} style={{
                background: "var(--surface)",
                borderRadius: "var(--r-lg)",
                border: `1px solid ${breach ? "rgba(127,29,29,0.35)" : isSelected ? "rgba(184,132,12,0.40)" : "var(--edge)"}`,
                padding: "16px 20px",
                display: "flex", gap: 16, alignItems: "flex-start",
                boxShadow: breach
                  ? "0 0 0 2px rgba(127,29,29,0.08), var(--shadow-sm)"
                  : isSelected
                  ? "0 0 0 2px rgba(184,132,12,0.12), var(--shadow-sm)"
                  : "var(--shadow-sm)",
                transition: "box-shadow 0.15s, border-color 0.15s",
              }}>
                {/* Checkbox */}
                {filter === "PENDING" && (
                  <input type="checkbox" checked={isSelected}
                    onChange={() => toggleSelect(c.case_id as string)}
                    style={{ width: 15, height: 15, marginTop: 5, cursor: "pointer", flexShrink: 0, accentColor: "var(--gold)" }}
                  />
                )}

                {/* Confidence circle */}
                <div style={{
                  width: 58, height: 58, borderRadius: 12, flexShrink: 0,
                  border: `2px solid ${confColor}`,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  background: `${confColor === "var(--active)" ? "var(--active-lt)" : confColor === "var(--dormant)" ? "var(--dormant-lt)" : "var(--closed-lt)"}`,
                }}>
                  <div style={{
                    fontSize: 17, fontWeight: 800, color: confColor, lineHeight: 1,
                    fontFamily: "'Poppins', serif",
                  }}>{conf}%</div>
                  <div style={{ fontSize: 8.5, color: confColor, fontWeight: 700, marginTop: 2, letterSpacing: "0.06em" }}>CONF</div>
                </div>

                {/* Main body */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Tags */}
                  <div style={{ display: "flex", gap: 5, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <PriorityBadge level={c.priority_level as string} />
                    <SLAChip hoursLeft={c.sla_hours_left as number | null} breach={breach} />
                    {(c.assigned_to as string) && (
                      <span style={{
                        fontSize: 10, color: "var(--navy)", background: "rgba(13,27,53,0.07)",
                        padding: "2px 8px", borderRadius: 5,
                        border: "1px solid rgba(13,27,53,0.15)", fontWeight: 600,
                        fontFamily: "'Poppins', sans-serif",
                      }}>
                        Assigned: {c.assigned_to as string}
                      </span>
                    )}
                  </div>

                  {/* Score bars */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px", marginBottom: 10 }}>
                    <ConfBar label="Name similarity"  value={c.name_score as number} />
                    <ConfBar label="Address overlap"  value={c.address_score as number} />
                  </div>

                  {/* Record pair */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[ra, rb].map((rec, ri) => (
                      <div key={ri} style={{
                        borderRadius: "var(--r-md)", border: "1px solid var(--edge)",
                        padding: "8px 12px", background: "var(--surface-2)",
                        borderLeft: `3px solid ${ri === 0 ? "var(--navy)" : "var(--gold)"}`,
                      }}>
                        <div style={{
                          fontSize: 9.5, fontWeight: 700, color: "var(--ink-3)", marginBottom: 3,
                          textTransform: "uppercase", letterSpacing: "0.06em",
                          fontFamily: "'Poppins', sans-serif",
                        }}>
                          {ri === 0 ? "Record A" : "Record B"} · {rec?.department_code as string}
                        </div>
                        <div style={{
                          fontWeight: 700, fontSize: 12.5, color: "var(--ink)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          fontFamily: "'Poppins', sans-serif",
                        }}>
                          {rec?.normalized_name as string}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 3, fontFamily: "'JetBrains Mono', monospace" }}>
                          {rec?.registration_number as string} · {rec?.pincode as string}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Identifier pills */}
                  <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
                    {[
                      { label: "PAN",   matched: c.pan_match as boolean },
                      { label: "GSTIN", matched: c.gstin_match as boolean },
                    ].map((pill) => (
                      <span key={pill.label} style={{
                        fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
                        background: pill.matched ? "var(--active-lt)" : "var(--surface-2)",
                        color: pill.matched ? "var(--active)" : "var(--ink-3)",
                        border: `1px solid ${pill.matched ? "rgba(26,107,74,0.25)" : "var(--edge)"}`,
                        fontFamily: "'Poppins', sans-serif",
                      }}>
                        {pill.matched ? "✓" : "✗"} {pill.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* CTA column */}
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 6, alignSelf: "center" }}>
                  <Link href={`/review/${c.case_id}`} style={{
                    padding: "9px 20px", borderRadius: "var(--r-md)",
                    background: "var(--navy)", color: "#fff",
                    fontWeight: 700, fontSize: 13, display: "block", textAlign: "center",
                    boxShadow: "0 4px 12px rgba(13,27,53,0.25)",
                    fontFamily: "'Poppins', sans-serif", letterSpacing: "0.01em",
                    transition: "background 0.12s",
                  }}>
                    Review →
                  </Link>
                  {canAssign && filter === "PENDING" && (
                    assigningCase === (c.case_id as string) ? (
                      <select
                        autoFocus
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) doAssign.mutate({ caseId: c.case_id as string, reviewerId: e.target.value });
                        }}
                        onBlur={() => setAssigningCase(null)}
                        style={{
                          padding: "6px 10px", borderRadius: "var(--r-md)",
                          border: "1.5px solid var(--gold)", fontSize: 11.5,
                          color: "var(--ink)", cursor: "pointer",
                          fontFamily: "'Poppins', sans-serif",
                          background: "var(--surface)",
                        }}
                      >
                        <option value="" disabled>Assign to…</option>
                        {((reviewersList as Record<string, unknown>[]) ?? []).map((r) => (
                          <option key={r.id as string} value={r.id as string}>{r.full_name as string}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => setAssigningCase(c.case_id as string)}
                        style={{
                          padding: "6px 12px", borderRadius: "var(--r-md)",
                          border: "1px solid var(--edge)", background: "var(--surface-2)",
                          color: "var(--ink-3)", fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                          fontFamily: "'Poppins', sans-serif",
                        }}
                      >
                        Assign
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}

          {cases.length === 0 && (
            <div style={{ textAlign: "center", padding: "64px 0", color: "var(--ink-3)" }}>
              <div style={{ fontSize: 40, marginBottom: 14, opacity: 0.25 }}>◧</div>
              <div style={{ fontSize: 15, fontFamily: "'Poppins', serif", color: "var(--ink-2)", fontWeight: 600 }}>Queue is empty</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>No {filter.toLowerCase()} cases at this time.</div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
