"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getReviewCase, decideReviewCase, addCaseNote } from "@/lib/api";
import { AppShell } from "@/components/AppShell";

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  P1: { label: "P1 Critical", color: "var(--closed)",  bg: "var(--closed-lt)",  border: "rgba(127,29,29,0.25)" },
  P2: { label: "P2 High",     color: "var(--dormant)", bg: "var(--dormant-lt)", border: "rgba(146,64,14,0.25)" },
  P3: { label: "P3 Normal",   color: "var(--navy)",    bg: "rgba(13,27,53,0.07)", border: "rgba(13,27,53,0.15)" },
  P4: { label: "P4 Low",      color: "var(--ink-3)",   bg: "var(--surface-2)",  border: "var(--edge)" },
};

const STRENGTH_COLOR: Record<string, string> = {
  strong: "var(--active)", moderate: "var(--dormant)", weak: "var(--closed)",
  missing: "var(--ink-3)", mismatch: "var(--closed)", supporting: "var(--navy)", neutral: "var(--ink-3)",
};

function ScoreRow({ label, score }: { label: string; score: number | null }) {
  const pct = score != null ? Math.round(score * 100) : 0;
  const color = pct > 75 ? "var(--active)" : pct > 50 ? "var(--dormant)" : "var(--closed)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 130, fontSize: 12, color: "var(--ink-3)", flexShrink: 0, fontFamily: "'Poppins', sans-serif" }}>{label}</div>
      <div style={{ flex: 1, height: 5, background: "var(--surface-2)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.8s ease" }} />
      </div>
      <div style={{ width: 40, fontSize: 12, fontWeight: 700, color, textAlign: "right", fontFamily: "'Poppins', serif" }}>
        {score != null ? `${pct}%` : "—"}
      </div>
    </div>
  );
}

const FIELDS = [
  { key: "department_code",     label: "Department" },
  { key: "normalized_name",     label: "Business Name" },
  { key: "normalized_address",  label: "Address" },
  { key: "pincode",             label: "Pincode" },
  { key: "pan",                 label: "PAN" },
  { key: "gstin",               label: "GSTIN" },
  { key: "registration_number", label: "Reg. Number" },
  { key: "owner_name",          label: "Owner" },
];

function EvidencePanel({ evidence }: { evidence: Record<string, unknown> }) {
  const fields = (evidence.fields ?? []) as Array<Record<string, unknown>>;
  return (
    <div style={{
      background: "var(--surface)", borderRadius: "var(--r-lg)",
      border: "1px solid var(--edge)", padding: 20, marginBottom: 14,
      boxShadow: "var(--shadow-sm)",
    }}>
      <div style={{ fontFamily: "'Poppins', serif", fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 4 }}>
        AI Evidence Explanation
      </div>
      <div style={{
        fontSize: 13, color: "var(--ink-2)", marginBottom: 16, lineHeight: 1.7,
        background: "var(--surface-2)", borderRadius: "var(--r-md)",
        padding: "11px 14px", borderLeft: "3px solid var(--gold)",
        
      }}>
        {evidence.summary as string}{" "}
        <em style={{ color: "var(--ink-3)" }}>{evidence.recommendation as string}</em>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {fields.map((f) => {
          const strength = f.strength as string;
          const color    = STRENGTH_COLOR[strength] ?? "var(--ink-3)";
          const score    = f.score as number;
          return (
            <div key={f.field as string} style={{
              border: "1px solid var(--edge)", borderRadius: "var(--r-md)",
              padding: "10px 14px", background: "var(--surface-2)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", fontFamily: "'Poppins', sans-serif" }}>{f.label as string}</span>
                  <span style={{
                    fontSize: 9.5, fontWeight: 700, padding: "1px 7px", borderRadius: 4,
                    background: `${color}18`, color,
                    textTransform: "uppercase", letterSpacing: "0.05em",
                  }}>{strength}</span>
                  <span style={{ fontSize: 10.5, color: "var(--ink-3)" }}>{f.method as string}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: "'Poppins', serif" }}>
                  {Math.round(score * 100)}%
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>
                  <span style={{ color: "var(--ink-3)", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>A: </span>
                  {(f.value_a as string) ?? "—"}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>
                  <span style={{ color: "var(--ink-3)", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>B: </span>
                  {(f.value_b as string) ?? "—"}
                </div>
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{f.why as string}</div>
            </div>
          );
        })}
      </div>
      {(evidence.improvements as string[])?.length > 0 && (
        <div style={{
          marginTop: 14, background: "var(--gold-lt)",
          border: "1px solid rgba(184,132,12,0.25)", borderRadius: "var(--r-md)", padding: "10px 14px",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gold-dk)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            What would improve confidence:
          </div>
          {(evidence.improvements as string[]).map((imp, i) => (
            <div key={i} style={{ fontSize: 12, color: "var(--dormant)", marginBottom: 2 }}>· {imp}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReviewCasePage() {
  const { caseId } = useParams() as { caseId: string };
  const router = useRouter();
  const qc     = useQueryClient();
  const [reason, setReason]         = useState("");
  const [done, setDone]             = useState<string | null>(null);
  const [showEvidence, setShowEvidence] = useState(true);
  const [noteText, setNoteText]     = useState("");
  const [activeTab, setActiveTab]   = useState<"decision" | "comments" | "history">("decision");

  const { data, isLoading } = useQuery({
    queryKey: ["review-case", caseId],
    queryFn: () => getReviewCase(caseId).then((r) => r.data),
  });

  const decide = useMutation({
    mutationFn: (decision: string) => decideReviewCase(caseId, { decision, reason }),
    onSuccess: (res) => {
      setDone(res.data.message + " ✓ Decision added to ML training dataset — model will improve on next retrain.");
      qc.invalidateQueries({ queryKey: ["review-queue"] });
      setTimeout(() => router.push("/review"), 3000);
    },
  });

  const addNote = useMutation({
    mutationFn: () => addCaseNote(caseId, noteText),
    onSuccess: () => {
      setNoteText("");
      qc.invalidateQueries({ queryKey: ["review-case", caseId] });
    },
  });

  if (isLoading) return (
    <AppShell>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[100, 200, 280].map((h, i) => <div key={i} className="skeleton" style={{ height: h, borderRadius: "var(--r-lg)" }} />)}
      </div>
    </AppShell>
  );

  if (!data) return (
    <AppShell>
      <div style={{ padding: 60, textAlign: "center", color: "var(--ink-3)" }}>Case not found.</div>
    </AppShell>
  );

  const ra       = data.record_a ?? {};
  const rb       = data.record_b ?? {};
  const conf     = Math.round(data.confidence_score * 100);
  const confColor = conf < 60 ? "var(--closed)" : conf < 75 ? "var(--dormant)" : "var(--active)";
  const evidence  = data.evidence as Record<string, unknown> | null;
  const priCfg    = PRIORITY_CONFIG[data.priority_level] ?? PRIORITY_CONFIG["P3"];
  const comments: Record<string, unknown>[] = data.comments        ?? [];
  const history:  Record<string, unknown>[] = data.decision_history ?? [];

  return (
    <AppShell title="Review Case" subtitle="Compare both records side by side and decide whether they belong to the same business">

      {/* Header card */}
      <div style={{
        background: "var(--surface)", borderRadius: "var(--r-lg)",
        border: "1px solid var(--edge)", padding: "18px 22px",
        marginBottom: 14, boxShadow: "var(--shadow-sm)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          {/* Confidence score */}
          <div style={{ textAlign: "center", minWidth: 80 }}>
            <div style={{
              fontSize: 38, fontWeight: 800, color: confColor, lineHeight: 1,
              fontFamily: "'Poppins', serif",
            }}>{conf}%</div>
            <div style={{ fontSize: 9.5, color: "var(--ink-3)", fontWeight: 700, letterSpacing: "0.1em", marginTop: 4 }}>CONFIDENCE</div>
          </div>

          {/* Score bars */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, minWidth: 200 }}>
            <ScoreRow label="Name similarity" score={data.name_score} />
            <ScoreRow label="Address overlap" score={data.address_score} />
          </div>

          {/* Identifier chips + controls */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <div style={{ display: "flex", gap: 8 }}>
              {[{ l: "PAN", m: data.pan_match }, { l: "GSTIN", m: data.gstin_match }].map((p) => (
                <div key={p.l} style={{
                  textAlign: "center", padding: "8px 14px", borderRadius: "var(--r-md)",
                  background: p.m ? "var(--active-lt)" : "var(--surface-2)",
                  border: `1px solid ${p.m ? "rgba(26,107,74,0.25)" : "var(--edge)"}`,
                }}>
                  <div style={{ fontSize: 15, marginBottom: 2, color: p.m ? "var(--active)" : "var(--ink-3)" }}>
                    {p.m ? "✓" : "✗"}
                  </div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: p.m ? "var(--active)" : "var(--ink-3)", letterSpacing: "0.04em" }}>
                    {p.l}
                  </div>
                </div>
              ))}
              {evidence && (
                <button onClick={() => setShowEvidence(!showEvidence)} style={{
                  padding: "8px 14px", borderRadius: "var(--r-md)",
                  border: "1.5px solid",
                  borderColor: showEvidence ? "var(--gold)" : "var(--edge)",
                  background: showEvidence ? "var(--gold-lt)" : "var(--surface)",
                  color: showEvidence ? "var(--gold-dk)" : "var(--ink-3)",
                  fontWeight: 600, fontSize: 12, cursor: "pointer",
                  transition: "all 0.12s",
                  fontFamily: "'Poppins', sans-serif",
                }}>
                  {showEvidence ? "Hide" : "Show"} AI Evidence
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
              <span style={{
                fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
                background: priCfg.bg, color: priCfg.color,
                border: `1px solid ${priCfg.border}`,
                fontFamily: "'Poppins', sans-serif", letterSpacing: "0.04em",
              }}>{priCfg.label}</span>
              {data.sla_breach && (
                <span style={{
                  fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
                  background: "var(--closed-lt)", color: "var(--closed)",
                  border: "1px solid rgba(127,29,29,0.25)",
                }}>⚠ SLA Breached</span>
              )}
              {data.assigned_to && (
                <span style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "'Poppins', sans-serif" }}>
                  Assigned: <strong style={{ color: "var(--ink-2)" }}>{data.assigned_to}</strong>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI Evidence */}
      {evidence && showEvidence && <EvidencePanel evidence={evidence} />}

      {/* Side-by-side record comparison */}
      <div style={{
        background: "var(--surface)", borderRadius: "var(--r-lg)",
        border: "1px solid var(--edge)", overflow: "hidden",
        marginBottom: 14, boxShadow: "var(--shadow-sm)",
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 64px 1fr" }}>
          {/* Headers */}
          <div style={{
            padding: "12px 20px", background: "rgba(13,27,53,0.06)",
            borderBottom: "1px solid var(--edge)",
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--navy)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Record A</div>
            <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 13, marginTop: 2 }}>{ra.department_code}</div>
          </div>
          <div style={{
            padding: "12px 0", background: "var(--surface-2)",
            borderBottom: "1px solid var(--edge)", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: "var(--ink-3)", letterSpacing: "0.05em" }}>VS</span>
          </div>
          <div style={{
            padding: "12px 20px", background: "rgba(184,132,12,0.06)",
            borderBottom: "1px solid var(--edge)",
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--gold-dk)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Record B</div>
            <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 13, marginTop: 2 }}>{rb.department_code}</div>
          </div>

          {/* Field rows */}
          {FIELDS.map((f, i) => {
            const va  = ra[f.key] as string | null;
            const vb  = rb[f.key] as string | null;
            const match  = va && vb && va === vb;
            const rowBg  = match ? "rgba(26,107,74,0.03)" : i % 2 === 0 ? "var(--surface)" : "var(--surface-2)";
            const isMono = ["pan", "gstin", "registration_number", "pincode"].includes(f.key);
            return [
              <div key={`a${i}`} style={{ padding: "10px 20px", borderBottom: "1px solid var(--edge)", background: rowBg }}>
                <div style={{ fontSize: 9.5, color: "var(--ink-3)", fontWeight: 700, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{f.label}</div>
                <div style={{ fontSize: 13, color: "var(--ink)", fontFamily: isMono ? "'JetBrains Mono', monospace" : "'Poppins', sans-serif" }}>{va ?? "—"}</div>
              </div>,
              <div key={`s${i}`} style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                borderBottom: "1px solid var(--edge)",
                background: match ? "rgba(26,107,74,0.05)" : rowBg,
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: match ? "var(--active)" : "var(--edge-2)" }}>
                  {match ? "=" : "≠"}
                </span>
              </div>,
              <div key={`b${i}`} style={{ padding: "10px 20px", borderBottom: "1px solid var(--edge)", background: rowBg }}>
                <div style={{ fontSize: 9.5, color: "var(--ink-3)", fontWeight: 700, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{f.label}</div>
                <div style={{ fontSize: 13, color: "var(--ink)", fontFamily: isMono ? "'JetBrains Mono', monospace" : "'Poppins', sans-serif" }}>{vb ?? "—"}</div>
              </div>,
            ];
          })}
        </div>
      </div>

      {/* Bottom tabs */}
      <div style={{
        display: "flex", gap: 0, marginBottom: 14,
        background: "var(--surface)", borderRadius: "var(--r-lg)",
        border: "1px solid var(--edge)", padding: 4,
        boxShadow: "var(--shadow-xs)",
      }}>
        {([
          ["decision", "Decision"],
          ["comments", `Comments (${comments.length})`],
          ["history",  `History (${history.length})`],
        ] as [string, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id as typeof activeTab)} style={{
            flex: 1, padding: "8px 12px", border: "none", borderRadius: 9, cursor: "pointer",
            fontWeight: 600, fontSize: 13, transition: "all 0.15s",
            background: activeTab === id ? "var(--navy)" : "transparent",
            color: activeTab === id ? "#fff" : "var(--ink-3)",
            boxShadow: activeTab === id ? "0 2px 8px rgba(13,27,53,0.22)" : "none",
            fontFamily: "'Poppins', sans-serif",
          }}>{label}</button>
        ))}
      </div>

      {/* Decision tab */}
      {activeTab === "decision" && (
        done ? (
          <div style={{
            background: "var(--surface)", borderRadius: "var(--r-lg)",
            border: "1px solid rgba(26,107,74,0.25)", padding: 32, textAlign: "center",
            boxShadow: "var(--shadow-sm)",
          }}>
            <div style={{ fontSize: 40, marginBottom: 14, color: "var(--active)" }}>✓</div>
            <div style={{
              fontSize: 15, fontWeight: 700, color: "var(--ink)",
              fontFamily: "'Poppins', serif",
            }}>{done}</div>
            <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 6 }}>Returning to queue…</div>
          </div>
        ) : (
          <div style={{
            background: "var(--surface)", borderRadius: "var(--r-lg)",
            border: "1px solid var(--edge)", padding: 22, boxShadow: "var(--shadow-sm)",
          }}>
            <div style={{ fontFamily: "'Poppins', serif", fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 12 }}>
              Your Decision
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain your reasoning (required before submitting)…"
              rows={3}
              className="input-field"
              style={{ resize: "vertical", marginBottom: 16, fontFamily: "'Poppins', sans-serif" }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {[
                { label: "✓ Approve Merge",  decision: "APPROVED_MERGE", color: "var(--active)",  border: "rgba(26,107,74,0.30)" },
                { label: "✗ Reject Merge",   decision: "REJECTED_MERGE", color: "var(--closed)",  border: "rgba(127,29,29,0.30)" },
                { label: "⚑ Escalate",        decision: "ESCALATED",      color: "var(--dormant)", border: "rgba(146,64,14,0.30)" },
              ].map((btn) => {
                const disabled = !reason.trim() || decide.isPending;
                return (
                  <button
                    key={btn.decision}
                    disabled={disabled}
                    onClick={() => decide.mutate(btn.decision)}
                    style={{
                      padding: "12px 0", border: `1.5px solid ${disabled ? "var(--edge)" : btn.border}`,
                      borderRadius: "var(--r-md)", cursor: "pointer",
                      background: disabled ? "var(--surface-2)" : `${btn.color}18`,
                      color: disabled ? "var(--ink-3)" : btn.color,
                      fontWeight: 700, fontSize: 13,
                      fontFamily: "'Poppins', sans-serif", letterSpacing: "0.02em",
                      transition: "all 0.12s",
                    }}
                  >{btn.label}</button>
                );
              })}
            </div>
            {!reason.trim() && (
              <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 10, textAlign: "center" }}>
                Enter a reason above to unlock decision buttons.
              </p>
            )}
          </div>
        )
      )}

      {/* Comments tab */}
      {activeTab === "comments" && (
        <div style={{
          background: "var(--surface)", borderRadius: "var(--r-lg)",
          border: "1px solid var(--edge)", padding: 22, boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{ fontFamily: "'Poppins', serif", fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 16 }}>
            Notes & Comments
          </div>
          {comments.length === 0 ? (
            <div style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 20 }}>No comments yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
              {comments.map((c) => (
                <div key={c.id as string} style={{
                  background: "var(--surface-2)", borderRadius: "var(--r-md)",
                  padding: "10px 14px", border: "1px solid var(--edge)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--navy)", fontFamily: "'Poppins', sans-serif" }}>{c.author as string}</span>
                    <span style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "'JetBrains Mono', monospace" }}>
                      {new Date(c.created_at as string).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--ink-2)", fontFamily: "'Poppins', sans-serif" }}>{c.comment as string}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note…"
              rows={2}
              className="input-field"
              style={{ resize: "none", flex: 1, fontFamily: "'Poppins', sans-serif" }}
            />
            <button
              disabled={!noteText.trim() || addNote.isPending}
              onClick={() => addNote.mutate()}
              style={{
                padding: "0 22px", border: "none", borderRadius: "var(--r-md)", cursor: "pointer",
                background: !noteText.trim() ? "var(--surface-2)" : "var(--navy)",
                color: !noteText.trim() ? "var(--ink-3)" : "#fff",
                fontWeight: 700, fontSize: 13,
                fontFamily: "'Poppins', sans-serif",
                boxShadow: !noteText.trim() ? "none" : "0 2px 8px rgba(13,27,53,0.22)",
                transition: "all 0.12s",
              }}
            >Add</button>
          </div>
        </div>
      )}

      {/* History tab */}
      {activeTab === "history" && (
        <div style={{
          background: "var(--surface)", borderRadius: "var(--r-lg)",
          border: "1px solid var(--edge)", padding: 22, boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{ fontFamily: "'Poppins', serif", fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 16 }}>
            Decision History
          </div>
          {history.length === 0 ? (
            <div style={{ color: "var(--ink-3)", fontSize: 13 }}>No decisions recorded yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {history.map((d, i) => {
                const dec      = d.decision as string;
                const decColor = dec === "APPROVED_MERGE" ? "var(--active)" : dec === "REJECTED_MERGE" ? "var(--closed)" : "var(--dormant)";
                return (
                  <div key={i} style={{
                    background: "var(--surface-2)", borderRadius: "var(--r-md)",
                    padding: "12px 16px", border: `1px solid var(--edge)`,
                    borderLeft: `3px solid ${decColor}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{
                        fontSize: 12, fontWeight: 700, color: decColor,
                        fontFamily: "'Poppins', serif",
                      }}>{dec.replace(/_/g, " ")}</span>
                      <span style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "'JetBrains Mono', monospace" }}>
                        {new Date(d.decided_at as string).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 4, fontFamily: "'Poppins', sans-serif" }}>
                      <strong style={{ color: "var(--ink)" }}>Reviewer:</strong> {d.reviewer as string}
                    </div>
                    {!!(d.reason) && (
                      <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{d.reason as string}</div>
                    )}
                    {!!(d.resulting_ubid) && (
                      <div style={{ marginTop: 6, fontSize: 11.5 }}>
                        <span style={{ color: "var(--ink-3)" }}>UBID: </span>
                        <code style={{
                          fontSize: 10.5, background: "var(--gold-lt)",
                          padding: "1px 7px", borderRadius: 4, color: "var(--gold-dk)",
                          fontFamily: "'JetBrains Mono', monospace",
                          border: "1px solid rgba(184,132,12,0.18)",
                        }}>{d.resulting_ubid as string}</code>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
