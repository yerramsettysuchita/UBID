"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { RelationshipGraph, GraphNode, GraphEdge } from "@/components/RelationshipGraph";
import { getBusinessGraph, getBusinessHierarchy, getNearbyBusinesses } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";

const EDGE_TYPE_META: Record<string, { bg: string; color: string; label: string }> = {
  LINKED_RECORD:  { bg: "rgba(13,27,53,0.07)",  color: "var(--navy)",    label: "Linked Record"  },
  SHARED_PAN:     { bg: "var(--closed-lt)",      color: "var(--closed)",  label: "Shared PAN"     },
  SHARED_GSTIN:   { bg: "var(--dormant-lt)",     color: "var(--dormant)", label: "Shared GSTIN"   },
  SAME_CLUSTER:   { bg: "var(--gold-lt)",        color: "var(--gold-dk)", label: "Same Cluster"   },
  SHARED_ADDRESS: { bg: "var(--active-lt)",      color: "var(--active)",  label: "Shared Address" },
  HAS_REVIEW:     { bg: "var(--closed-lt)",      color: "var(--closed)",  label: "Under Review"   },
};

const SEV_META: Record<string, { bg: string; color: string; border: string }> = {
  CRITICAL: { bg: "var(--closed-lt)",  color: "var(--closed)",  border: "rgba(127,29,29,0.30)"  },
  HIGH:     { bg: "var(--dormant-lt)", color: "var(--dormant)", border: "rgba(146,64,14,0.30)"  },
  MEDIUM:   { bg: "var(--gold-lt)",    color: "var(--gold-dk)", border: "rgba(184,132,12,0.30)" },
  LOW:      { bg: "var(--active-lt)",  color: "var(--active)",  border: "rgba(26,107,74,0.25)"  },
};

const BRANCH_SIGNAL_LABELS: Record<string, string> = {
  same_pan:       "Same PAN",
  same_gstin:     "Same GSTIN",
  shared_address: "Shared Address",
  pan_overlap:    "PAN overlap",
};

function SuspiciousBadge({ severity }: { severity: string }) {
  const c = SEV_META[severity] ?? SEV_META.LOW;
  return (
    <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 5, background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontFamily: "'Poppins', sans-serif" }}>
      {severity}
    </span>
  );
}

function NodeDetailPanel({ node, edges }: { node: GraphNode; edges: GraphEdge[] }) {
  const connEdges = edges.filter((e) => e.source === node.id || e.target === node.id);
  const nodeIconBg = node.is_subject ? "var(--navy)" : node.type === "SOURCE_RECORD" ? "var(--dormant)" : "var(--closed)";
  return (
    <div style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: nodeIconBg, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 14, fontFamily: "'Poppins', serif" }}>
          {node.type === "BUSINESS" ? "B" : node.type === "SOURCE_RECORD" ? node.dept?.charAt(0) ?? "S" : "R"}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 12, color: "var(--ink)", fontFamily: "'Poppins', sans-serif" }}>{node.label}</div>
          <div style={{ fontSize: 10, color: "var(--ink-3)" }}>{node.type.replace(/_/g, " ")}</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 12 }}>
        {node.status && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--ink-3)" }}>Status</span>
            <StatusBadge status={node.status} size="sm" />
          </div>
        )}
        {node.confidence !== undefined && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--ink-3)" }}>Confidence</span>
            <strong style={{ color: "var(--navy)", fontFamily: "'Poppins', serif" }}>{Math.round(node.confidence * 100)}%</strong>
          </div>
        )}
        {node.dept && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--ink-3)" }}>Department</span>
            <strong style={{ color: "var(--ink-2)" }}>{node.dept}</strong>
          </div>
        )}
        {node.pincode && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--ink-3)" }}>Pincode</span>
            <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--gold-dk)" }}>{node.pincode}</code>
          </div>
        )}
        {node.pan && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--ink-3)" }}>PAN</span>
            <code style={{ fontSize: 10, color: "var(--gold-dk)", fontFamily: "'JetBrains Mono', monospace" }}>{node.pan}</code>
          </div>
        )}
        {node.reg_num && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--ink-3)" }}>Reg No.</span>
            <code style={{ fontSize: 10, color: "var(--ink-2)", fontFamily: "'JetBrains Mono', monospace" }}>{node.reg_num}</code>
          </div>
        )}
        {node.owner && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--ink-3)" }}>Owner</span>
            <span style={{ color: "var(--ink-2)", textAlign: "right", maxWidth: 130 }}>{node.owner}</span>
          </div>
        )}
        {node.address && (
          <div>
            <div style={{ color: "var(--ink-3)", marginBottom: 3 }}>Address</div>
            <div style={{ color: "var(--ink-2)", fontSize: 11, lineHeight: 1.4 }}>{node.address.slice(0, 80)}{node.address.length > 80 ? "…" : ""}</div>
          </div>
        )}
      </div>

      {connEdges.length > 0 && (
        <div style={{ marginTop: 14, borderTop: "1px solid var(--edge)", paddingTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-2)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Poppins', sans-serif" }}>Connections ({connEdges.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {connEdges.slice(0, 5).map((e, i) => {
              const cfg = EDGE_TYPE_META[e.type];
              return (
                <div key={i} style={{ fontSize: 11, padding: "5px 8px", borderRadius: 6, background: cfg?.bg ?? "var(--surface-2)", color: cfg?.color ?? "var(--ink-2)", border: `1px solid ${cfg?.bg ?? "var(--edge)"}` }}>
                  <span style={{ fontWeight: 700 }}>{cfg?.label ?? e.type}</span>
                  <div style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>{e.why_it_matters.slice(0, 80)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {node.type === "BUSINESS" && !node.is_subject && (
        <Link href={`/business/${node.id.replace("biz-", "")}`} style={{ display: "block", marginTop: 12, padding: "7px 0", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#fff", background: "var(--navy)", borderRadius: "var(--r-md)", fontFamily: "'Poppins', sans-serif" }}>
          Open Business Profile →
        </Link>
      )}
    </div>
  );
}

function EdgeDetailPanel({ edge }: { edge: GraphEdge }) {
  const cfg = EDGE_TYPE_META[edge.type];
  return (
    <div style={{ padding: "14px 16px" }}>
      <div style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 6, background: cfg?.bg ?? "var(--surface-2)", color: cfg?.color ?? "var(--ink-2)", fontFamily: "'Poppins', sans-serif" }}>
          {cfg?.label ?? edge.type}
        </span>
      </div>
      <div style={{ fontFamily: "'Poppins', serif", fontSize: 13, color: "var(--ink)", fontWeight: 600, marginBottom: 10 }}>{edge.label}</div>
      <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.6, marginBottom: 12 }}>{edge.why_it_matters}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ background: "var(--surface-2)", borderRadius: 7, padding: "8px 10px", border: "1px solid var(--edge)", textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "var(--ink-3)", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'Poppins', sans-serif" }}>STRENGTH</div>
          <div style={{ fontSize: 17, fontWeight: 900, color: "var(--navy)", fontFamily: "'Poppins', serif" }}>{Math.round(edge.strength * 100)}%</div>
        </div>
        <div style={{ background: "var(--surface-2)", borderRadius: 7, padding: "8px 10px", border: "1px solid var(--edge)", textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "var(--ink-3)", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'Poppins', sans-serif" }}>SOURCE</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: edge.deterministic ? "var(--active)" : "var(--dormant)", fontFamily: "'Poppins', serif" }}>
            {edge.deterministic ? "Deterministic" : "Inferred"}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GraphPage() {
  const params = useParams<{ ubid: string }>();
  const ubid = params?.ubid ?? "";

  const [activeTab, setActiveTab] = useState<"graph" | "hierarchy" | "nearby">("graph");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [filterType, setFilterType] = useState<string>("ALL");

  const { data: graphData, isLoading } = useQuery({
    queryKey: ["business-graph", ubid],
    queryFn: () => getBusinessGraph(ubid).then((r) => r.data),
    enabled: !!ubid,
  });

  const { data: hierarchyData } = useQuery({
    queryKey: ["business-hierarchy", ubid],
    queryFn: () => getBusinessHierarchy(ubid).then((r) => r.data),
    enabled: !!ubid && activeTab === "hierarchy",
  });

  const { data: nearbyData } = useQuery({
    queryKey: ["business-nearby", ubid],
    queryFn: () => getNearbyBusinesses(ubid).then((r) => r.data),
    enabled: !!ubid && activeTab === "nearby",
  });

  const allEdgeTypes = Array.from(new Set<string>(((graphData?.edges as GraphEdge[] | undefined) ?? []).map((e) => e.type)));

  const visibleEdges: GraphEdge[] = filterType === "ALL"
    ? (graphData?.edges ?? [])
    : (graphData?.edges ?? []).filter((e: GraphEdge) => e.type === filterType);

  const allNodes: GraphNode[] = (graphData?.nodes as GraphNode[] | undefined) ?? [];
  const subjectIds: string[] = allNodes.filter((n) => n.is_subject).map((n) => n.id);
  const edgeNodeIds: string[] = visibleEdges.flatMap((e) => [e.source, e.target]);
  const visibleNodeIds = new Set<string>([...subjectIds, ...edgeNodeIds]);
  const visibleNodes: GraphNode[] = allNodes.filter((n: GraphNode) => visibleNodeIds.has(n.id));

  const suspiciousSignals = graphData?.suspicious_signals ?? [];
  const subject = graphData?.subject;

  return (
    <AppShell
      title="Relationship Intelligence"
      subtitle={subject ? `${subject.name} · ${subject.ubid}` : "Graph-based entity investigation"}
    >
      {/* Header actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <Link href={`/business/${ubid}`} style={{ fontSize: 12, color: "var(--navy)", fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>
          ← Business Profile
        </Link>
        {subject && (
          <>
            <span style={{ color: "var(--edge-2)" }}>|</span>
            <StatusBadge status={subject.status} size="sm" />
            {subject.pincode && <span style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "'Poppins', sans-serif" }}>{subject.pincode} · {subject.district}</span>}
          </>
        )}
        <div style={{ flex: 1 }} />
        {suspiciousSignals.length > 0 && (
          <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "var(--closed-lt)", color: "var(--closed)", border: "1px solid rgba(127,29,29,0.25)", fontWeight: 700 }}>
            ⚠ {suspiciousSignals.length} signal{suspiciousSignals.length > 1 ? "s" : ""} detected
          </span>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 3, marginBottom: 14, background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: 4, width: "fit-content", border: "1px solid var(--edge)" }}>
        {([["graph", "Relationship Graph"], ["hierarchy", "Branch Hierarchy"], ["nearby", "Nearby Entities"]] as [string, string][]).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as typeof activeTab)}
            style={{
              padding: "7px 16px", borderRadius: "var(--r-sm)", fontSize: 12, fontWeight: 600,
              border: "none", cursor: "pointer", fontFamily: "'Poppins', sans-serif",
              background: activeTab === tab ? "var(--surface)" : "transparent",
              color: activeTab === tab ? "var(--navy)" : "var(--ink-3)",
              boxShadow: activeTab === tab ? "var(--shadow-xs)" : "none",
              transition: "all 0.12s",
            }}
          >{label}</button>
        ))}
      </div>

      {/* Graph tab */}
      {activeTab === "graph" && (
        <div>
          {allEdgeTypes.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>Show:</span>
              {(["ALL", ...allEdgeTypes] as string[]).map((t) => {
                const cfg = EDGE_TYPE_META[t];
                const isActive = filterType === t;
                return (
                  <button key={t} onClick={() => setFilterType(t)} style={{
                    padding: "4px 10px", borderRadius: "var(--r-sm)", fontSize: 11, cursor: "pointer",
                    fontWeight: 600, border: "1.5px solid", fontFamily: "'Poppins', sans-serif",
                    borderColor: isActive ? (cfg?.color ?? "var(--navy)") : "var(--edge)",
                    background: isActive ? (cfg?.bg ?? "rgba(13,27,53,0.07)") : "var(--surface)",
                    color: isActive ? (cfg?.color ?? "var(--navy)") : "var(--ink-3)",
                    transition: "all 0.1s",
                  }}>{cfg?.label ?? t}</button>
                );
              })}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: selectedNode || selectedEdge ? "1fr 300px" : "1fr", gap: 14 }}>
            <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--edge)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
              {isLoading ? (
                <div style={{ height: 440, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", fontSize: 13 }}>
                  Loading relationship graph…
                </div>
              ) : (
                <RelationshipGraph
                  nodes={visibleNodes}
                  edges={visibleEdges}
                  height={440}
                  onNodeSelect={setSelectedNode}
                  onEdgeSelect={setSelectedEdge}
                />
              )}
            </div>

            {(selectedNode || selectedEdge) && (
              <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--edge)", borderLeft: "4px solid var(--gold)", overflow: "hidden", boxShadow: "var(--shadow-md)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid var(--edge)" }}>
                  <span style={{ fontFamily: "'Poppins', serif", fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>
                    {selectedNode ? "Node Details" : "Edge Details"}
                  </span>
                  <button onClick={() => { setSelectedNode(null); setSelectedEdge(null); }} style={{ border: "none", background: "none", color: "var(--ink-3)", cursor: "pointer", fontSize: 16 }}>×</button>
                </div>
                {selectedNode && <NodeDetailPanel node={selectedNode} edges={visibleEdges} />}
                {selectedEdge && !selectedNode && <EdgeDetailPanel edge={selectedEdge} />}
              </div>
            )}
          </div>

          {graphData?.summary && (
            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              {[
                { label: "Nodes",       value: graphData.summary.total_nodes },
                { label: "Edges",       value: graphData.summary.total_edges },
                { label: "Departments", value: ((graphData.summary.dept_coverage as string[] | undefined) ?? []).join(", ") || "—" },
              ].map((s) => (
                <div key={s.label} style={{ background: "var(--surface)", borderRadius: "var(--r-sm)", padding: "6px 12px", border: "1px solid var(--edge)", fontSize: 12, fontFamily: "'Poppins', sans-serif" }}>
                  <span style={{ color: "var(--ink-3)" }}>{s.label}: </span>
                  <strong style={{ color: "var(--ink)", fontFamily: "'Poppins', serif" }}>{s.value}</strong>
                </div>
              ))}
            </div>
          )}

          {suspiciousSignals.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontFamily: "'Poppins', serif", fontWeight: 700, fontSize: 13, color: "var(--ink)", marginBottom: 10 }}>Investigation Signals</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(suspiciousSignals as Record<string, unknown>[]).map((sig) => {
                  const sev = sig.severity as string;
                  const c = SEV_META[sev] ?? SEV_META.LOW;
                  return (
                    <div key={sig.id as string} style={{ background: c.bg, borderRadius: "var(--r-md)", border: `1px solid ${c.border}`, padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <SuspiciousBadge severity={sev} />
                        <span style={{ fontFamily: "'Poppins', serif", fontSize: 13, fontWeight: 700, color: c.color }}>{sig.title as string}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6, lineHeight: 1.5 }}>{sig.description as string}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-3)" }}>→ {sig.recommended_action as string}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hierarchy tab */}
      {activeTab === "hierarchy" && (
        <div>
          {!hierarchyData ? (
            <div style={{ padding: 40, color: "var(--ink-3)", textAlign: "center" }}>Loading hierarchy…</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--edge)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--edge)", fontFamily: "'Poppins', serif", fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>
                  Department Establishments ({(hierarchyData.establishments as unknown[]).length})
                </div>
                <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  {(hierarchyData.establishments as Record<string, unknown>[]).map((est) => (
                    <div key={est.dept as string} style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)", border: "1px solid var(--edge)", overflow: "hidden" }}>
                      <div style={{ padding: "8px 12px", background: "rgba(13,27,53,0.08)", borderBottom: "1px solid var(--edge)", fontWeight: 700, fontSize: 12, color: "var(--navy)", fontFamily: "'Poppins', sans-serif" }}>
                        {est.dept as string} ({(est.records as unknown[]).length} record{(est.records as unknown[]).length > 1 ? "s" : ""})
                      </div>
                      {(est.records as Record<string, unknown>[]).map((rec, i) => (
                        <div key={i} style={{ padding: "8px 12px", borderBottom: "1px solid var(--edge)", fontSize: 11, fontFamily: "'Poppins', sans-serif" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                            <code style={{ color: "var(--gold-dk)", fontFamily: "'JetBrains Mono', monospace" }}>{(rec.registration_number as string) ?? "—"}</code>
                            <span style={{ color: rec.registration_status === "ACTIVE" ? "var(--active)" : "var(--dormant)", fontWeight: 600 }}>{rec.registration_status as string}</span>
                          </div>
                          {!!(rec.owner_name) && <div style={{ color: "var(--ink-3)" }}>Owner: {rec.owner_name as string}</div>}
                          {!!(rec.pincode) && <div style={{ color: "var(--ink-3)", fontFamily: "'JetBrains Mono', monospace" }}>{rec.pincode as string}</div>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--edge)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--edge)", fontFamily: "'Poppins', serif", fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>
                  Potential Branches / Related Entities
                </div>
                {!(hierarchyData.potential_branches as unknown[]).length ? (
                  <div style={{ padding: 24, color: "var(--ink-3)", fontSize: 12, textAlign: "center" }}>No related branches found.</div>
                ) : (
                  <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    {(hierarchyData.potential_branches as Record<string, unknown>[]).map((br) => {
                      const sig = br.signal as string;
                      const sigLabel = BRANCH_SIGNAL_LABELS[sig] ?? sig;
                      return (
                        <div key={br.ubid as string} style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: "10px 12px", border: "1px solid var(--edge)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                            <span style={{ fontWeight: 700, fontSize: 12, color: "var(--ink)", fontFamily: "'Poppins', sans-serif" }}>{(br.name as string).slice(0, 40)}</span>
                            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "var(--gold-lt)", color: "var(--gold-dk)", fontWeight: 700, fontFamily: "'Poppins', sans-serif", border: "1px solid rgba(184,132,12,0.22)" }}>{sigLabel}</span>
                          </div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <StatusBadge status={br.status as string} size="sm" />
                            {!!(br.pincode) && <span style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "'JetBrains Mono', monospace" }}>{br.pincode as string}</span>}
                            <span style={{ fontSize: 11, color: "var(--navy)", marginLeft: "auto", fontWeight: 700, fontFamily: "'Poppins', serif" }}>{Math.round((br.confidence as number) * 100)}% conf.</span>
                          </div>
                          <Link href={`/business/${br.ubid}`} style={{ display: "block", marginTop: 6, fontSize: 11, color: "var(--navy)", fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>
                            View Profile →
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Nearby tab */}
      {activeTab === "nearby" && (
        <div>
          {!nearbyData ? (
            <div style={{ padding: 40, color: "var(--ink-3)", textAlign: "center" }}>Loading nearby businesses…</div>
          ) : !(nearbyData.nearby as unknown[]).length ? (
            <div style={{ padding: 40, color: "var(--ink-3)", textAlign: "center" }}>No nearby businesses found in same pincode.</div>
          ) : (
            <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--edge)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--edge)", fontFamily: "'Poppins', serif", fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>
                Nearby — same pincode as {subject?.pincode ?? ""}
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    {["Business", "Status", "Confidence", "Departments", "Shared Signals"].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(nearbyData.nearby as Record<string, unknown>[]).map((biz) => {
                    const conf = Math.round((biz.confidence as number) * 100);
                    const confColor = conf >= 85 ? "var(--active)" : conf >= 70 ? "var(--dormant)" : "var(--closed)";
                    return (
                      <tr key={biz.ubid as string}>
                        <td>
                          <Link href={`/business/${biz.ubid}`} style={{ fontWeight: 600, color: "var(--navy)", fontSize: 12, fontFamily: "'Poppins', sans-serif" }}>
                            {(biz.name as string).slice(0, 40)}
                          </Link>
                        </td>
                        <td><StatusBadge status={biz.status as string} size="sm" /></td>
                        <td style={{ fontWeight: 800, color: confColor, fontSize: 12, fontFamily: "'Poppins', serif" }}>
                          {conf}%
                        </td>
                        <td style={{ fontSize: 11, color: "var(--ink-3)" }}>{biz.dept_count as number} dept{(biz.dept_count as number) > 1 ? "s" : ""}</td>
                        <td>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {((biz.shared_signals as string[]) || []).map((sig) => (
                              <span key={sig} style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "var(--gold-lt)", color: "var(--gold-dk)", border: "1px solid rgba(184,132,12,0.22)", fontFamily: "'Poppins', sans-serif" }}>
                                {BRANCH_SIGNAL_LABELS[sig] ?? sig}
                              </span>
                            ))}
                            {!(biz.shared_signals as string[]).length && <span style={{ fontSize: 11, color: "var(--ink-3)" }}>—</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
