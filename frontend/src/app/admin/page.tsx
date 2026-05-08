"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  triggerERRun, getERRuns, getERMetrics, getERCandidates,
  listAdminUsers, listAdminDepartments, listAuditLogs,
  getERModelStats, retrainERModel,
  getSystemStatus, triggerIngestion, getERModelEvaluation,
} from "@/lib/api";
import { AppShell } from "@/components/AppShell";

const ROLE_META: Record<string, { color: string; bg: string }> = {
  ADMIN:      { color: "var(--active)",  bg: "var(--active-lt)" },
  SUPERVISOR: { color: "var(--dormant)", bg: "var(--dormant-lt)" },
  REVIEWER:   { color: "#6D28D9",        bg: "#EDE9FE" },
  OFFICER:    { color: "#1E40AF",        bg: "#EFF6FF" },
  AUDITOR:    { color: "var(--ink-3)",   bg: "var(--surface-2)" },
};

function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
      <div>
        <div style={{
          fontFamily: "'Poppins', serif",
          fontWeight: 700, fontSize: 15, color: "var(--ink)",
          letterSpacing: "-0.01em",
        }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      {action}
    </div>
  );
}

function StatChip({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      background: "var(--surface-2)", border: "1px solid var(--edge)",
      borderRadius: "var(--r-md)", padding: "11px 14px", textAlign: "center",
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{
        fontSize: 20, fontWeight: 800, color,
        fontFamily: "'Poppins', serif", letterSpacing: "-0.02em",
      }}>{value}</div>
      <div style={{
        fontSize: 10, color: "var(--ink-3)", fontWeight: 600,
        marginTop: 3, textTransform: "uppercase", letterSpacing: "0.06em",
      }}>{label}</div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--surface)", borderRadius: "var(--r-lg)",
      border: "1px solid var(--edge)", padding: 22,
      boxShadow: "var(--shadow-sm)",
    }}>
      {children}
    </div>
  );
}

function Alert({ msg }: { msg: string }) {
  const isError = msg.startsWith("Error");
  return (
    <div style={{
      background: isError ? "var(--closed-lt)" : "var(--active-lt)",
      border: `1px solid ${isError ? "rgba(127,29,29,0.22)" : "rgba(26,107,74,0.22)"}`,
      borderRadius: "var(--r-md)", padding: "10px 14px",
      fontSize: 13, color: isError ? "var(--closed)" : "var(--active)",
      marginBottom: 14, fontFamily: "'Poppins', sans-serif",
    }}>
      {isError ? "⚠ " : "✓ "}{msg}
    </div>
  );
}

export default function AdminPage() {
  const qc = useQueryClient();
  const [erMsg, setErMsg]           = useState<string | null>(null);
  const [retrainMsg, setRetrainMsg] = useState<string | null>(null);
  const [ingestMsg, setIngestMsg]   = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<string>("er");

  const { data: runs } = useQuery({
    queryKey: ["er-runs"],
    queryFn: () => getERRuns({ page: 1, page_size: 5 }).then((r) => r.data),
    refetchInterval: 5000,
  });

  const { data: erMetrics } = useQuery({
    queryKey: ["er-metrics"],
    queryFn: () => getERMetrics().then((r) => r.data),
  });

  const { data: modelStats, refetch: refetchModel } = useQuery({
    queryKey: ["er-model-stats"],
    queryFn: () => getERModelStats().then((r) => r.data),
  });

  const retrain = useMutation({
    mutationFn: () => retrainERModel(),
    onSuccess: (res) => {
      setRetrainMsg(`Model retrained: F1=${res.data.f1_score} | Precision=${res.data.precision} | Recall=${res.data.recall} | ${res.data.training_samples} samples (${res.data.reviewer_labels} from reviewers)`);
      refetchModel();
      qc.invalidateQueries({ queryKey: ["er-metrics"] });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Retrain failed.";
      setRetrainMsg(`Error: ${msg}`);
    },
  });

  const { data: systemStatus } = useQuery({
    queryKey: ["system-status"],
    queryFn: () => getSystemStatus().then((r) => r.data),
    enabled: activePanel === "system",
    refetchInterval: activePanel === "system" ? 5000 : false,
  });

  const doIngest = useMutation({
    mutationFn: () => triggerIngestion(),
    onSuccess: () => setIngestMsg("Ingestion job triggered. Check scheduler status."),
    onError: () => setIngestMsg("Error triggering ingestion."),
  });

  const { data: evalData } = useQuery({
    queryKey: ["er-evaluation"],
    queryFn: () => getERModelEvaluation().then((r) => r.data),
    enabled: activePanel === "evaluation",
  });

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listAdminUsers().then((r) => r.data),
    enabled: activePanel === "users",
  });

  const { data: departments } = useQuery({
    queryKey: ["admin-departments"],
    queryFn: () => listAdminDepartments().then((r) => r.data),
    enabled: activePanel === "departments",
  });

  const { data: auditLogs } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => listAuditLogs(1).then((r) => r.data),
    enabled: activePanel === "audit",
  });

  const { data: candidates } = useQuery({
    queryKey: ["er-candidates-admin"],
    queryFn: () => getERCandidates({ page_size: 10, decision: "REVIEW_NEEDED" }).then((r) => r.data),
    enabled: activePanel === "candidates",
  });

  const triggerER = useMutation({
    mutationFn: () => triggerERRun(),
    onSuccess: (res) => {
      const m = res.data.metrics;
      setErMsg(`Run complete: ${m.auto_matched} auto-matched · ${m.review_needed} review cases · ${m.clusters_created} clusters · ${m.ubids_assigned} UBIDs`);
      qc.invalidateQueries({ queryKey: ["er-runs"] });
      qc.invalidateQueries({ queryKey: ["er-metrics"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Run failed.";
      setErMsg(`Error: ${msg}`);
    },
  });

  const PANELS = [
    { id: "er",          label: "ER Engine",    icon: "⊕" },
    { id: "ml",          label: "ML Model",     icon: "⊛" },
    { id: "evaluation",  label: "Evaluation",   icon: "◈" },
    { id: "metrics",     label: "Accuracy",     icon: "⬡" },
    { id: "system",      label: "System",       icon: "⊙" },
    { id: "candidates",  label: "Candidates",   icon: "◎" },
    { id: "users",       label: "Users",        icon: "⊞" },
    { id: "departments", label: "Departments",  icon: "⊟" },
    { id: "audit",       label: "Audit Log",    icon: "◧" },
  ];

  const latestRun = runs?.results?.[0] as Record<string, unknown> | undefined;

  return (
    <AppShell title="Administration" subtitle="Control the AI engine, manage users and monitor all system activity">

      {/* Panel switcher */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--edge)",
        borderRadius: "var(--r-lg)", padding: "10px 12px",
        marginBottom: 16, display: "flex", gap: 4, flexWrap: "wrap",
        boxShadow: "var(--shadow-xs)",
      }}>
        {PANELS.map((p) => (
          <button key={p.id} onClick={() => setActivePanel(p.id)} style={{
            padding: "7px 14px", borderRadius: "var(--r-md)", fontSize: 12.5,
            fontWeight: 600, cursor: "pointer", border: "none",
            background: activePanel === p.id ? "var(--navy)" : "transparent",
            color: activePanel === p.id ? "#fff" : "var(--ink-3)",
            boxShadow: activePanel === p.id ? "0 2px 8px rgba(13,27,53,0.22)" : "none",
            fontFamily: "'Poppins', sans-serif", transition: "all 0.12s",
            letterSpacing: "0.01em",
          }}>
            <span style={{ marginRight: 6, fontSize: 12 }}>{p.icon}</span>{p.label}
          </button>
        ))}
      </div>

      {/* ── ER Engine ── */}
      {activePanel === "er" && (
        <Panel>
          <SectionHeader
            title="Entity Resolution Engine"
            subtitle="Probabilistic matching using PAN exact match, Jaro-Winkler name similarity and Union-Find clustering"
            action={
              <button
                onClick={() => { setErMsg(null); triggerER.mutate(); }}
                disabled={triggerER.isPending}
                style={{
                  padding: "10px 22px", border: "none", borderRadius: "var(--r-md)",
                  background: triggerER.isPending ? "var(--ink-3)" : "var(--navy)",
                  color: "#fff", fontWeight: 700, fontSize: 13,
                  cursor: triggerER.isPending ? "not-allowed" : "pointer",
                  boxShadow: triggerER.isPending ? "none" : "0 4px 14px rgba(13,27,53,0.30)",
                  fontFamily: "'Poppins', sans-serif", letterSpacing: "0.01em",
                  transition: "all 0.15s",
                }}
              >
                {triggerER.isPending ? "⏳ Running…" : "▶ Run ER Pipeline"}
              </button>
            }
          />

          {erMsg && <Alert msg={erMsg} />}

          {latestRun && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10, marginBottom: 18 }}>
              <StatChip label="Records"     value={(latestRun.total_records as number)?.toLocaleString()}   color="var(--ink-2)" />
              <StatChip label="Pairs"       value={(latestRun.pairs_generated as number)?.toLocaleString()} color="var(--ink-3)" />
              <StatChip label="Auto-linked" value={(latestRun.auto_matched as number)?.toLocaleString()}    color="var(--active)" />
              <StatChip label="Review"      value={(latestRun.review_needed as number)?.toLocaleString()}   color="var(--dormant)" />
              <StatChip label="Clusters"    value={(latestRun.clusters_created as number)?.toLocaleString()} color="#6D28D9" />
              <StatChip label="UBIDs"       value={(latestRun.ubids_assigned as number)?.toLocaleString()}  color="var(--gold)" />
            </div>
          )}

          {(runs?.results?.length ?? 0) > 0 && (
            <div style={{ border: "1px solid var(--edge)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 80px 80px 80px 80px 80px 110px",
                gap: 12, padding: "9px 16px",
                background: "var(--surface-2)", fontSize: 10.5,
                fontWeight: 700, color: "var(--ink-3)",
                textTransform: "uppercase", letterSpacing: "0.07em",
                fontFamily: "'Poppins', sans-serif",
              }}>
                <div>Run Key</div><div style={{textAlign:"center"}}>Records</div>
                <div style={{textAlign:"center"}}>Pairs</div><div style={{textAlign:"center"}}>Auto</div>
                <div style={{textAlign:"center"}}>Review</div><div style={{textAlign:"center"}}>Clusters</div>
                <div style={{textAlign:"center"}}>Status</div>
              </div>
              {runs?.results?.map((r: Record<string, unknown>) => {
                const st = r.status as string;
                const stColor = st === "COMPLETED" ? "var(--active)" : st === "FAILED" ? "var(--closed)" : "var(--dormant)";
                const stBg    = st === "COMPLETED" ? "var(--active-lt)" : st === "FAILED" ? "var(--closed-lt)" : "var(--dormant-lt)";
                return (
                  <div key={r.run_id as string} style={{
                    display: "grid", gridTemplateColumns: "1fr 80px 80px 80px 80px 80px 110px",
                    gap: 12, padding: "11px 16px", borderBottom: "1px solid var(--edge)",
                    alignItems: "center", fontSize: 12,
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                        {r.run_key as string}
                      </div>
                      <div style={{ color: "var(--ink-3)", marginTop: 1, fontSize: 11 }}>
                        {r.completed_at ? new Date(r.completed_at as string).toLocaleString() : "Running…"}
                      </div>
                    </div>
                    <div style={{textAlign:"center", color:"var(--ink-2)"}}>{r.total_records as number}</div>
                    <div style={{textAlign:"center", color:"var(--ink-2)"}}>{r.pairs_generated as number}</div>
                    <div style={{textAlign:"center", color:"var(--active)", fontWeight:700}}>{r.auto_matched as number}</div>
                    <div style={{textAlign:"center", color:"var(--dormant)", fontWeight:700}}>{r.review_needed as number}</div>
                    <div style={{textAlign:"center", color:"#6D28D9", fontWeight:700}}>{r.clusters_created as number}</div>
                    <div style={{textAlign:"center"}}>
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, padding: "2px 9px", borderRadius: 5,
                        background: stBg, color: stColor, border: `1px solid ${stColor}30`,
                      }}>{st}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {/* ── ML Model ── */}
      {activePanel === "ml" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Panel>
            <SectionHeader
              title="Linkage ML Model"
              subtitle={`${modelStats?.model_type ?? "GradientBoosting"} classifier trained on ${modelStats?.trained_on ?? "0"} samples`}
              action={
                <button
                  onClick={() => { setRetrainMsg(null); retrain.mutate(); }}
                  disabled={retrain.isPending}
                  style={{
                    padding: "9px 20px", border: "none", borderRadius: "var(--r-md)",
                    background: retrain.isPending ? "var(--ink-3)" : "var(--navy)",
                    color: "#fff", fontWeight: 700, fontSize: 12,
                    cursor: retrain.isPending ? "not-allowed" : "pointer",
                    fontFamily: "'Poppins', sans-serif",
                    transition: "all 0.12s",
                  }}
                >
                  {retrain.isPending ? "⏳ Retraining…" : "↻ Retrain Model"}
                </button>
              }
            />

            {retrainMsg && <Alert msg={retrainMsg} />}

            {modelStats?.loaded === false ? (
              <div style={{ padding: 20, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
                Model not loaded. Click Retrain to initialize.
              </div>
            ) : modelStats && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
                  <StatChip label="Precision" value={`${Math.round((modelStats.precision ?? 0)*100)}%`} color="var(--active)" />
                  <StatChip label="Recall"    value={`${Math.round((modelStats.recall ?? 0)*100)}%`}    color="var(--navy)" />
                  <StatChip label="F1 Score"  value={`${Math.round((modelStats.f1_score ?? 0)*100)}%`}  color="var(--gold)" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                  <StatChip label="Training Samples"     value={(modelStats.trained_on ?? 0).toLocaleString()}            color="var(--ink-3)" />
                  <StatChip label="Reviewer Labels"      value={modelStats.reviewer_labels ?? 0}                          color="var(--dormant)" />
                  <StatChip label="Positive (Match)"     value={(modelStats.positive_samples ?? 0).toLocaleString()}      color="var(--active)" />
                  <StatChip label="Negative (Non-Match)" value={(modelStats.negative_samples ?? 0).toLocaleString()}      color="var(--closed)" />
                </div>
                <div style={{
                  background: "var(--surface-2)", borderRadius: "var(--r-md)",
                  border: "1px solid var(--edge)", padding: "12px 14px",
                }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: "var(--ink-2)",
                    marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em",
                  }}>How the model works</div>
                  <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.7 }}>
                    A <strong style={{ fontStyle: "normal" }}>{modelStats.model_type ?? "GradientBoosting"}</strong> classifier trained on
                    5 features: name similarity (Jaro-Winkler), address overlap, PAN match, GSTIN match,
                    and pincode match. PAN/GSTIN exact matches use deterministic rules. Reviewer decisions
                    automatically become gold-standard training examples.
                  </div>
                </div>
              </>
            )}
          </Panel>

          <Panel>
            <SectionHeader title="Feature Importances" subtitle="Which signals drive match decisions" />
            {modelStats?.feature_importances ? (
              <>
                <div style={{ marginBottom: 16 }}>
                  {Object.entries(modelStats.feature_importances as Record<string, number>)
                    .sort(([, a], [, b]) => b - a)
                    .map(([feat, imp]) => {
                      const pct = Math.round(imp * 100);
                      const color = feat.includes("pan") ? "var(--closed)"
                        : feat.includes("gstin") ? "var(--dormant)"
                        : feat.includes("name") ? "var(--navy)"
                        : feat.includes("address") ? "var(--active)" : "#6D28D9";
                      return (
                        <div key={feat} style={{ marginBottom: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                            <span style={{ color: "var(--ink-2)", fontWeight: 600 }}>
                              {feat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                            </span>
                            <span style={{ fontWeight: 700, color, fontFamily: "'Poppins', serif" }}>{pct}%</span>
                          </div>
                          <div style={{ height: 7, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4, transition: "width 0.8s ease" }} />
                          </div>
                        </div>
                      );
                    })}
                </div>

                {modelStats.model_comparison && (
                  <div style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: "12px 14px", border: "1px solid var(--edge)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-2)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      Model Selection Results
                    </div>
                    {(modelStats.model_comparison as Record<string, unknown>[]).map((m) => (
                      <div key={m.name as string} style={{
                        display: "flex", justifyContent: "space-between", fontSize: 12,
                        marginBottom: 5, padding: "5px 9px",
                        background: "var(--surface)", borderRadius: "var(--r-sm)",
                        border: "1px solid var(--edge)",
                      }}>
                        <span style={{ fontWeight: 600, color: "var(--ink-2)" }}>{m.name as string}</span>
                        <span style={{ color: "var(--ink-3)", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                          P={Math.round((m.precision as number) * 100)}%
                          {" "}R={Math.round((m.recall as number) * 100)}%
                          {" "}F1={Math.round((m.f1 as number) * 100)}%
                        </span>
                      </div>
                    ))}
                    <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 6 }}>
                      Both models compared; best F1 selected.
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: "var(--ink-3)", fontSize: 13, padding: 20, textAlign: "center" }}>
                Train the model to see feature importances.
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* ── System Status ── */}
      {activePanel === "system" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Panel>
            <SectionHeader
              title="Ingestion Scheduler"
              subtitle="Automated data ingestion runs every 6 hours to pull new department records"
              action={
                <button onClick={() => { setIngestMsg(null); doIngest.mutate(); }} disabled={doIngest.isPending} style={{
                  padding: "7px 16px", border: "none", borderRadius: "var(--r-md)",
                  background: "var(--active)", color: "#fff", fontWeight: 700, fontSize: 12,
                  cursor: "pointer", fontFamily: "'Poppins', sans-serif",
                }}>
                  {doIngest.isPending ? "Triggering…" : "▶ Trigger Now"}
                </button>
              }
            />
            {ingestMsg && <Alert msg={ingestMsg} />}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              <StatChip label="Status" value={systemStatus?.scheduler?.running ? "RUNNING" : "STOPPED"}
                color={systemStatus?.scheduler?.running ? "var(--active)" : "var(--closed)"} />
              <StatChip label="Next Run" value={systemStatus?.scheduler?.next_run ? new Date(systemStatus.scheduler.next_run as string).toLocaleTimeString() : "—"}
                color="var(--navy)" />
            </div>
            {systemStatus?.scheduler?.last_runs && (systemStatus.scheduler.last_runs as Record<string, unknown>[]).length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-2)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Recent Runs
                </div>
                {(systemStatus.scheduler.last_runs as Record<string, unknown>[]).map((run, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between",
                    padding: "7px 11px", background: "var(--surface-2)",
                    borderRadius: "var(--r-sm)", marginBottom: 4,
                    border: "1px solid var(--edge)", fontSize: 11,
                  }}>
                    <span style={{
                      color: (run.status as string) === "SUCCESS" ? "var(--active)" : "var(--closed)",
                      fontWeight: 700,
                    }}>{run.status as string}</span>
                    <span style={{ color: "var(--ink-3)", fontFamily: "'JetBrains Mono', monospace" }}>
                      {(run.duration_s as number).toFixed(1)}s
                    </span>
                    <span style={{ color: "var(--ink-3)" }}>{new Date(run.started_at as string).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel>
            <SectionHeader title="ML Models & Cache" subtitle="Loaded models and cache layer status" />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "ER Linkage Model (GradientBoosting)", data: systemStatus?.er_model },
                { label: "Dormancy Prediction Model", data: systemStatus?.dormancy_model },
              ].map((m) => {
                const loaded = (m.data as Record<string,unknown>)?.loaded;
                return (
                  <div key={m.label} style={{
                    background: "var(--surface-2)", borderRadius: "var(--r-md)",
                    padding: "11px 14px", border: "1px solid var(--edge)",
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 12.5, color: "var(--ink)", marginBottom: 6, fontFamily: "'Poppins', sans-serif" }}>
                      {m.label}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
                        background: loaded ? "var(--active-lt)" : "var(--closed-lt)",
                        color: loaded ? "var(--active)" : "var(--closed)",
                        border: `1px solid ${loaded ? "rgba(26,107,74,0.20)" : "rgba(127,29,29,0.20)"}`,
                      }}>
                        {loaded ? "LOADED" : "NOT LOADED"}
                      </span>
                      {!!(m.data as Record<string,unknown>)?.f1 && (
                        <span style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "'JetBrains Mono', monospace" }}>
                          F1={(((m.data as Record<string,unknown>).f1 as number).toFixed(4))}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              <div style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: "11px 14px", border: "1px solid var(--edge)" }}>
                <div style={{ fontWeight: 700, fontSize: 12.5, color: "var(--ink)", marginBottom: 6, fontFamily: "'Poppins', sans-serif" }}>Redis Cache</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
                    background: (systemStatus?.cache as Record<string,unknown>)?.redis_available ? "var(--active-lt)" : "var(--dormant-lt)",
                    color: (systemStatus?.cache as Record<string,unknown>)?.redis_available ? "var(--active)" : "var(--dormant)",
                    border: `1px solid ${(systemStatus?.cache as Record<string,unknown>)?.redis_available ? "rgba(26,107,74,0.20)" : "rgba(146,64,14,0.20)"}`,
                  }}>
                    {(systemStatus?.cache as Record<string,unknown>)?.redis_available ? "CONNECTED" : "NOT CONNECTED"}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
                    {(systemStatus?.cache as Record<string,unknown>)?.note as string}
                  </span>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* ── Evaluation ── */}
      {activePanel === "evaluation" && (
        <Panel>
          <SectionHeader title="ER Model Evaluation Report" subtitle="Cross-validation, cross-department holdout, calibration, feature ablation" />
          {!evalData?.evaluated ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}>
              Run <code style={{ fontFamily: "'JetBrains Mono', monospace", background: "var(--surface-2)", padding: "1px 6px", borderRadius: 3 }}>
                python scripts/evaluate_er_model.py
              </code> to generate evaluation.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {/* 5-fold CV */}
              <div style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: 16, border: "1px solid var(--edge)" }}>
                <div style={{ fontFamily: "'Poppins', serif", fontWeight: 700, fontSize: 13, color: "var(--ink)", marginBottom: 12 }}>
                  5-Fold Stratified Cross-Validation
                </div>
                {Object.entries(evalData.cross_validation_5fold as Record<string, Record<string,number>>).map(([metric, stats]) => (
                  <div key={metric} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: "var(--ink-2)", fontWeight: 600 }}>{metric.replace("_"," ").toUpperCase()}</span>
                      <span style={{ fontWeight: 700, color: "var(--navy)", fontFamily: "'Poppins', serif" }}>
                        {stats.mean.toFixed(4)} ± {stats.std.toFixed(4)}
                      </span>
                    </div>
                    <div style={{ height: 5, background: "var(--edge)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${stats.mean * 100}%`, background: "var(--navy)", borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Feature ablation */}
              <div style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: 16, border: "1px solid var(--edge)" }}>
                <div style={{ fontFamily: "'Poppins', serif", fontWeight: 700, fontSize: 13, color: "var(--ink)", marginBottom: 8 }}>
                  Feature Ablation Study
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 10 }}>
                  F1 drop when feature removed — higher = more critical
                </div>
                {Object.entries(evalData.feature_ablation as Record<string, Record<string,number>>)
                  .sort(([,a],[,b]) => b.f1_drop - a.f1_drop)
                  .map(([feat, stats]) => {
                    const drop = stats.f1_drop;
                    const color = drop > 0.1 ? "var(--closed)" : drop > 0.01 ? "var(--dormant)" : "var(--ink-3)";
                    return (
                      <div key={feat} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                          <span style={{ color: "var(--ink-2)" }}>{feat.replace(/_/g," ")}</span>
                          <span style={{ fontWeight: 700, color }}>−{(drop * 100).toFixed(2)}% F1</span>
                        </div>
                        <div style={{ height: 5, background: "var(--edge)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.min(drop * 200, 100)}%`, background: color, borderRadius: 3 }} />
                        </div>
                      </div>
                    );
                  })}
              </div>

              {evalData.cross_dept_holdout?.f1 !== undefined && (
                <div style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: 16, border: "1px solid var(--edge)" }}>
                  <div style={{ fontFamily: "'Poppins', serif", fontWeight: 700, fontSize: 13, color: "var(--ink)", marginBottom: 8 }}>
                    Cross-Department Holdout
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 10 }}>
                    Train: SHOPS+FACTORIES → Test: KSPCB+BESCOM
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <StatChip label="F1"  value={(evalData.cross_dept_holdout.f1 as number).toFixed(3)}      color="var(--navy)" />
                    <StatChip label="AUC" value={(evalData.cross_dept_holdout.roc_auc as number).toFixed(3)} color="var(--active)" />
                  </div>
                </div>
              )}

              <div style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: 16, border: "1px solid var(--edge)" }}>
                <div style={{ fontFamily: "'Poppins', serif", fontWeight: 700, fontSize: 13, color: "var(--ink)", marginBottom: 8 }}>
                  Model Calibration
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 8 }}>
                  Predicted probability vs actual rate (diagonal = perfect)
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-2)" }}>{evalData.calibration?.note as string}</div>
                <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {((evalData.calibration?.mean_predicted_value as number[]) ?? []).map((pred, i) => {
                    const actual = (evalData.calibration?.fraction_of_positives as number[])?.[i] ?? 0;
                    const diff   = Math.abs(pred - actual);
                    const color  = diff < 0.05 ? "var(--active)" : diff < 0.15 ? "var(--dormant)" : "var(--closed)";
                    return (
                      <div key={i} style={{
                        background: "var(--surface)", borderRadius: "var(--r-sm)",
                        padding: "4px 8px", border: "1px solid var(--edge)", fontSize: 10,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>
                        <span style={{ color: "var(--ink-3)" }}>{pred.toFixed(2)}→</span>
                        <span style={{ color, fontWeight: 700 }}>{actual.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </Panel>
      )}

      {/* ── Accuracy Metrics ── */}
      {activePanel === "metrics" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Panel>
            <SectionHeader title="ER Accuracy Metrics" subtitle="All-time pair classification breakdown" />
            {erMetrics ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                  <StatChip label="Total Runs"    value={erMetrics.total_runs}                                        color="var(--navy)" />
                  <StatChip label="Total Pairs"   value={(erMetrics.all_time?.total_pairs ?? 0).toLocaleString()}     color="var(--ink-3)" />
                  <StatChip label="Auto-Link Rate" value={`${Math.round((erMetrics.all_time?.auto_link_rate ?? 0) * 100)}%`} color="var(--active)" />
                  <StatChip label="Review Rate"   value={`${Math.round((erMetrics.all_time?.review_rate ?? 0) * 100)}%`}     color="var(--dormant)" />
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-2)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Pair Classification Breakdown
                </div>
                {Object.entries(erMetrics.all_time?.pair_breakdown ?? {}).map(([decision, count]) => {
                  const total = erMetrics.all_time?.total_pairs || 1;
                  const pct   = Math.round(((count as number) / total) * 100);
                  const color = decision === "AUTO_MATCH" ? "var(--active)" : decision === "REVIEW_NEEDED" ? "var(--dormant)" : "var(--closed)";
                  return (
                    <div key={decision} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                        <span style={{ color: "var(--ink-2)" }}>{decision.replace(/_/g, " ")}</span>
                        <span style={{ fontWeight: 700, color }}>
                          {(count as number).toLocaleString()}
                          <span style={{ color: "var(--ink-3)", fontWeight: 400 }}> ({pct}%)</span>
                        </span>
                      </div>
                      <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.8s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </>
            ) : <div style={{ color: "var(--ink-3)", fontSize: 13 }}>Loading metrics…</div>}
          </Panel>

          <Panel>
            <SectionHeader title="ER Configuration" subtitle="Current scoring weights and thresholds" />
            {[
              { label: "Auto-Link Threshold",       value: "≥ 0.85 confidence",                              color: "var(--active)" },
              { label: "Review Threshold",          value: "0.50 – 0.84 confidence",                        color: "var(--dormant)" },
              { label: "PAN Exact Match Weight",    value: "0.45 (raises to 0.90+)",                        color: "var(--navy)" },
              { label: "GSTIN Exact Match Weight",  value: "0.40 (raises to 0.87+)",                        color: "var(--navy)" },
              { label: "Name Similarity (JW)",      value: "0.45 × score",                                  color: "#6D28D9" },
              { label: "Address Token Overlap",     value: "0.25 × overlap",                                color: "#6D28D9" },
              { label: "Pincode Match Bonus",       value: "+0.10",                                          color: "var(--gold)" },
              { label: "Name+Pincode Boost",        value: "+0.10 when name>0.85 & pincode",               color: "var(--gold)" },
              { label: "Blocking Strategy",         value: "PAN | GSTIN | PIN+NAM(4)",                     color: "var(--ink-3)" },
              { label: "Clustering Algorithm",      value: "Union-Find (path-compressed)",                  color: "var(--ink-3)" },
            ].map((cfg) => (
              <div key={cfg.label} style={{
                display: "flex", justifyContent: "space-between",
                padding: "8px 0", borderBottom: "1px solid var(--edge)", fontSize: 12,
              }}>
                <span style={{ color: "var(--ink-2)", fontWeight: 500 }}>{cfg.label}</span>
                <span style={{ fontWeight: 700, color: cfg.color, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                  {cfg.value}
                </span>
              </div>
            ))}
          </Panel>
        </div>
      )}

      {/* ── ER Candidates ── */}
      {activePanel === "candidates" && (
        <Panel>
          <SectionHeader title="ER Candidate Pairs" subtitle="Top review-needed pairs scored by the entity resolution engine" />
          {!candidates ? (
            <div style={{ color: "var(--ink-3)", padding: 20, textAlign: "center" }}>Loading candidates…</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 4 }}>
                Showing top 10 of {(candidates.total as number).toLocaleString()} REVIEW_NEEDED pairs
              </div>
              {(candidates.results as Record<string, unknown>[])?.map((pair) => {
                const conf = Math.round((pair.confidence_score as number) * 100);
                const ra   = pair.record_a as Record<string, unknown>;
                const rb   = pair.record_b as Record<string, unknown>;
                const confColor = conf >= 75 ? "var(--active)" : conf >= 55 ? "var(--dormant)" : "var(--closed)";
                return (
                  <div key={pair.id as string} style={{
                    border: "1px solid var(--edge)", borderRadius: "var(--r-md)",
                    padding: "13px 16px", background: "var(--surface-2)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ display: "flex", gap: 7 }}>
                        <span style={{
                          fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
                          background: "rgba(13,27,53,0.08)", color: "var(--navy)",
                          border: "1px solid rgba(13,27,53,0.14)",
                        }}>{pair.decision as string}</span>
                        <span style={{
                          fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
                          background: "var(--active-lt)", color: "var(--active)",
                          border: "1px solid rgba(26,107,74,0.20)",
                        }}>{pair.blocking_key as string}</span>
                      </div>
                      <span style={{ fontSize: 19, fontWeight: 800, color: confColor, fontFamily: "'Poppins', serif" }}>
                        {conf}%
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {[ra, rb].map((rec, i) => rec && (
                        <div key={i} style={{
                          background: "var(--surface)", borderRadius: "var(--r-sm)",
                          padding: "8px 12px", fontSize: 12,
                          border: `1px solid var(--edge)`,
                          borderLeft: `3px solid ${i === 0 ? "var(--navy)" : "var(--gold)"}`,
                        }}>
                          <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>{rec.normalized_name as string}</div>
                          <div style={{ color: "var(--ink-3)", fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace" }}>
                            {rec.department_code as string} · {rec.pincode as string}
                          </div>
                          {!!(rec.pan) && (
                            <div style={{ color: "var(--gold-dk)", fontSize: 10.5, marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                              PAN: {rec.pan as string}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {(!!(pair.pan_match) || !!(pair.gstin_match)) && (
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        {!!(pair.pan_match) && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 4, background: "var(--active-lt)", color: "var(--active)", border: "1px solid rgba(26,107,74,0.20)" }}>
                            ✓ PAN Match
                          </span>
                        )}
                        {!!(pair.gstin_match) && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 4, background: "var(--active-lt)", color: "var(--active)", border: "1px solid rgba(26,107,74,0.20)" }}>
                            ✓ GSTIN Match
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {/* ── User Management ── */}
      {activePanel === "users" && (
        <div style={{
          background: "var(--surface)", borderRadius: "var(--r-lg)",
          border: "1px solid var(--edge)", overflow: "hidden",
          boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--edge)", background: "var(--surface-2)" }}>
            <SectionHeader title="User Management" subtitle={`${(users as unknown[])?.length ?? 0} active accounts`} />
          </div>
          <table className="data-table">
            <thead><tr>
              <th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Last Login</th>
            </tr></thead>
            <tbody>
              {!users ? (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--ink-3)", padding: 24 }}>Loading…</td></tr>
              ) : (users as Record<string, unknown>[]).map((u) => {
                const rm = ROLE_META[u.role as string] ?? { color: "var(--ink-3)", bg: "var(--surface-2)" };
                return (
                  <tr key={u.id as string}>
                    <td style={{ fontWeight: 600, color: "var(--ink)" }}>{u.full_name as string}</td>
                    <td style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "'JetBrains Mono', monospace" }}>{u.email as string}</td>
                    <td>
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, padding: "2px 9px", borderRadius: 5,
                        background: rm.bg, color: rm.color,
                        border: `1px solid ${rm.color}30`,
                        fontFamily: "'Poppins', sans-serif", letterSpacing: "0.04em",
                      }}>{u.role as string}</span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--ink-3)" }}>{(u.department_code as string) ?? "—"}</td>
                    <td style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "'JetBrains Mono', monospace" }}>
                      {u.last_login_at ? new Date(u.last_login_at as string).toLocaleString() : "Never"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Departments ── */}
      {activePanel === "departments" && (
        <div style={{
          background: "var(--surface)", borderRadius: "var(--r-lg)",
          border: "1px solid var(--edge)", overflow: "hidden",
          boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--edge)", background: "var(--surface-2)" }}>
            <SectionHeader title="Department Configuration" subtitle="Source system adapters and ingestion status" />
          </div>
          <table className="data-table">
            <thead><tr>
              <th>Code</th><th>Name</th><th>Adapter</th><th>Last Ingested</th><th>Records</th>
            </tr></thead>
            <tbody>
              {!departments ? (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--ink-3)", padding: 24 }}>Loading…</td></tr>
              ) : (departments as Record<string, unknown>[]).map((d) => (
                <tr key={d.code as string}>
                  <td>
                    <code style={{
                      fontSize: 11, fontWeight: 700, color: "var(--gold-dk)",
                      background: "var(--gold-lt)", padding: "2px 8px", borderRadius: 4,
                      border: "1px solid rgba(184,132,12,0.18)",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>{d.code as string}</code>
                  </td>
                  <td style={{ fontWeight: 600, color: "var(--ink)" }}>{d.name as string}</td>
                  <td style={{ fontSize: 12, color: "var(--ink-3)" }}>{d.adapter_type as string}</td>
                  <td style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "'JetBrains Mono', monospace" }}>
                    {d.last_ingested_at ? new Date(d.last_ingested_at as string).toLocaleString() : "Never"}
                  </td>
                  <td style={{ fontWeight: 700, color: "var(--navy)", fontFamily: "'Poppins', serif" }}>
                    {(d.record_count as number) > 0 ? (d.record_count as number).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Audit Log ── */}
      {activePanel === "audit" && (
        <div style={{
          background: "var(--surface)", borderRadius: "var(--r-lg)",
          border: "1px solid var(--edge)", overflow: "hidden",
          boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--edge)", background: "var(--surface-2)" }}>
            <SectionHeader title="Audit Log" subtitle="Last 50 system actions and reviewer decisions" />
          </div>
          {!auditLogs ? (
            <div style={{ padding: 24, color: "var(--ink-3)", textAlign: "center" }}>Loading…</div>
          ) : (auditLogs as Record<string, unknown>[]).length === 0 ? (
            <div style={{ padding: 40, color: "var(--ink-3)", textAlign: "center" }}>
              No audit events yet. Actions taken by users will appear here.
            </div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Time</th><th>Action</th><th>Entity Type</th><th>User</th></tr></thead>
              <tbody>
                {(auditLogs as Record<string, unknown>[]).map((log) => (
                  <tr key={log.id as string}>
                    <td style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "'JetBrains Mono', monospace" }}>
                      {new Date(log.created_at as string).toLocaleString()}
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11.5, fontWeight: 700, color: "var(--navy)",
                        background: "rgba(13,27,53,0.07)", padding: "2px 9px",
                        borderRadius: 5, border: "1px solid rgba(13,27,53,0.14)",
                        fontFamily: "'Poppins', sans-serif",
                      }}>{log.action as string}</span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--ink-3)" }}>{(log.entity_type as string) ?? "—"}</td>
                    <td style={{ fontSize: 11, color: "var(--ink-2)", fontFamily: "'JetBrains Mono', monospace" }}>
                      {(log.user_id as string)?.slice(0, 8) ?? "system"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </AppShell>
  );
}
