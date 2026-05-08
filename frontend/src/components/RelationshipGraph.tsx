"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface GraphNode {
  id: string;
  type: "BUSINESS" | "SOURCE_RECORD" | "REVIEW_CASE";
  label: string;
  status?: string;
  dept?: string;
  confidence?: number;
  pan?: string;
  gstin?: string;
  pincode?: string;
  district?: string;
  address?: string;
  owner?: string;
  reg_num?: string;
  reg_status?: string;
  priority?: string;
  pan_match?: boolean;
  gstin_match?: boolean;
  color?: string;
  is_subject?: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  label: string;
  strength: number;
  deterministic: boolean;
  why_it_matters: string;
}

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeSelect?: (node: GraphNode | null) => void;
  onEdgeSelect?: (edge: GraphEdge | null) => void;
  height?: number;
}

// Hex equivalents of CSS design tokens (SVG fill/stroke can't use CSS vars)
const NODE_COLORS: Record<string, string> = {
  BUSINESS: "#0D1B35",      // --navy
  SOURCE_RECORD: "#B8840C", // --gold
  REVIEW_CASE: "#7F1D1D",  // --closed
};
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#1A6B4A",        // --active
  DORMANT: "#92400E",       // --dormant
  CLOSED: "#B91C1C",        // --closed (slightly brighter for SVG)
  REVIEW_NEEDED: "#0D1B35", // --navy
  PENDING: "#B8840C",       // --gold
};
const EDGE_COLORS: Record<string, string> = {
  LINKED_RECORD: "#0D1B35", // --navy
  SHARED_PAN: "#7F1D1D",   // --closed
  SHARED_GSTIN: "#92400E", // --dormant
  SAME_CLUSTER: "#B8840C", // --gold
  SHARED_ADDRESS: "#1A6B4A", // --active
  HAS_REVIEW: "#7F1D1D",   // --closed
};

const W = 720;
const H_DEFAULT = 440;
const REPULSION = 5000;
const SPRING_LEN = 130;
const SPRING_K = 0.06;
const GRAVITY = 0.04;
const DAMP = 0.82;
const ITERS = 180;

function buildInitialPositions(nodes: GraphNode[], cx: number, cy: number): SimNode[] {
  return nodes.map((n, i) => {
    if (n.is_subject) return { ...n, x: cx, y: cy, vx: 0, vy: 0 };
    const angle = (i / Math.max(nodes.length - 1, 1)) * Math.PI * 2;
    const r = 130 + Math.random() * 60;
    return { ...n, x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, vx: 0, vy: 0 };
  });
}

function simulate(simNodes: SimNode[], edges: GraphEdge[], cx: number, cy: number, height: number): SimNode[] {
  const nodes = simNodes.map((n) => ({ ...n }));
  for (let iter = 0; iter < ITERS; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const f = REPULSION / (dist * dist);
        const fx = (dx / dist) * f;
        const fy = (dy / dist) * f;
        nodes[i].vx += fx; nodes[i].vy += fy;
        nodes[j].vx -= fx; nodes[j].vy -= fy;
      }
    }
    const idxMap: Record<string, number> = {};
    nodes.forEach((n, i) => { idxMap[n.id] = i; });
    for (const e of edges) {
      const si = idxMap[e.source]; const ti = idxMap[e.target];
      if (si === undefined || ti === undefined) continue;
      const dx = nodes[ti].x - nodes[si].x;
      const dy = nodes[ti].y - nodes[si].y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const f = (dist - SPRING_LEN) * SPRING_K * e.strength;
      const fx = (dx / dist) * f; const fy = (dy / dist) * f;
      nodes[si].vx += fx; nodes[si].vy += fy;
      nodes[ti].vx -= fx; nodes[ti].vy -= fy;
    }
    for (const n of nodes) {
      if (n.is_subject) { n.vx = 0; n.vy = 0; continue; }
      n.vx += (cx - n.x) * GRAVITY;
      n.vy += (cy - n.y) * GRAVITY;
      n.vx *= DAMP; n.vy *= DAMP;
      n.x += n.vx; n.y += n.vy;
      n.x = Math.max(44, Math.min(W - 44, n.x));
      n.y = Math.max(44, Math.min(height - 44, n.y));
    }
  }
  return nodes;
}

function nodeRadius(n: GraphNode): number {
  if (n.is_subject) return 20;
  if (n.type === "BUSINESS") return 14;
  if (n.type === "SOURCE_RECORD") return 11;
  return 10;
}

function nodeColor(n: GraphNode): string {
  if (n.is_subject) return "#0D1B35";          // navy — subject entity is always navy
  if (n.type === "SOURCE_RECORD") return n.color ?? EDGE_COLORS.SHARED_ADDRESS;
  if (n.type === "REVIEW_CASE") return "#7F1D1D"; // closed/deep red
  return STATUS_COLORS[n.status ?? ""] ?? "#0D1B35";
}

export function RelationshipGraph({ nodes, edges, onNodeSelect, onEdgeSelect, height = H_DEFAULT }: Props) {
  const cx = W / 2; const cy = height / 2;
  const [positions, setPositions] = useState<SimNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });

  useEffect(() => {
    if (!nodes.length) { setPositions([]); return; }
    const init = buildInitialPositions(nodes, cx, cy);
    const result = simulate(init, edges, cx, cy, height);
    setPositions(result);
    setSelectedNode(null);
    setSelectedEdge(null);
  }, [nodes, edges, cx, cy, height]);

  const posMap = useMemo(() => {
    const m: Record<string, { x: number; y: number }> = {};
    positions.forEach((n) => { m[n.id] = { x: n.x, y: n.y }; });
    return m;
  }, [positions]);

  function handleNodeClick(node: GraphNode) {
    const next = selectedNode === node.id ? null : node.id;
    setSelectedNode(next);
    setSelectedEdge(null);
    onNodeSelect?.(next ? node : null);
    onEdgeSelect?.(null);
  }

  function handleEdgeClick(edge: GraphEdge) {
    setSelectedEdge(edge);
    setSelectedNode(null);
    onEdgeSelect?.(edge);
    onNodeSelect?.(null);
  }

  function resetView() {
    setZoom(1); setPan({ x: 0, y: 0 });
    setSelectedNode(null); setSelectedEdge(null);
    onNodeSelect?.(null); onEdgeSelect?.(null);
  }

  const connectedEdges = selectedNode
    ? new Set(edges.filter((e) => e.source === selectedNode || e.target === selectedNode).map((e) => `${e.source}-${e.target}`))
    : null;

  if (!nodes.length) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "#8A95A8", fontSize: 13, background: "#F9F5EE", borderRadius: 10 }}>
        No relationship data available.
      </div>
    );
  }

  const transform = `translate(${pan.x}px,${pan.y}px) scale(${zoom})`;

  return (
    <div style={{ position: "relative", width: "100%", height, background: "#F9F5EE", borderRadius: 10, overflow: "hidden", userSelect: "none" }}>
      {/* Controls */}
      <div style={{ position: "absolute", top: 10, right: 10, zIndex: 10, display: "flex", gap: 6 }}>
        {[
          { label: "+", onClick: () => setZoom((z) => Math.min(z + 0.2, 2.5)) },
          { label: "−", onClick: () => setZoom((z) => Math.max(z - 0.2, 0.4)) },
          { label: "⊙", onClick: resetView },
        ].map((b) => (
          <button key={b.label} onClick={b.onClick} style={{
            width: 28, height: 28, borderRadius: 6, border: "1px solid #E6E0D4",
            background: "#fff", color: "#4A5365", fontSize: 14, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700,
          }}>{b.label}</button>
        ))}
      </div>

      {/* Legend */}
      <div style={{ position: "absolute", bottom: 10, left: 10, zIndex: 10, display: "flex", gap: 10, background: "rgba(249,245,238,0.92)", borderRadius: 7, padding: "5px 10px", border: "1px solid #E6E0D4", fontSize: 10 }}>
        {[
          { color: "#0D1B35", label: "Business" },
          { color: "#B8840C", label: "Source Record" },
          { color: "#7F1D1D", label: "Review Case" },
        ].map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: l.color }} />
            <span style={{ color: "#8A95A8" }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* SVG */}
      <svg
        width="100%" height={height}
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ cursor: isDragging.current ? "grabbing" : "grab" }}
        onMouseDown={(e) => {
          isDragging.current = true;
          dragStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
        }}
        onMouseMove={(e) => {
          if (!isDragging.current) return;
          setPan({
            x: dragStart.current.px + (e.clientX - dragStart.current.x),
            y: dragStart.current.py + (e.clientY - dragStart.current.y),
          });
        }}
        onMouseUp={() => { isDragging.current = false; }}
        onMouseLeave={() => { isDragging.current = false; }}
      >
        <g style={{ transform, transformOrigin: `${cx}px ${cy}px`, transition: "transform 0.15s" }}>
          {/* Edges */}
          {edges.map((e, i) => {
            const s = posMap[e.source]; const t = posMap[e.target];
            if (!s || !t) return null;
            const edgeKey = `${e.source}-${e.target}`;
            const isHighlighted = connectedEdges?.has(edgeKey) || selectedEdge === e || hoverEdge === edgeKey;
            const isSelected = selectedEdge === e;
            return (
              <line
                key={i}
                x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                stroke={isSelected ? "#0D1B35" : (EDGE_COLORS[e.type] ?? "#8A95A8")}
                strokeWidth={isSelected ? 2.5 : isHighlighted ? 2 : 1.2}
                strokeOpacity={connectedEdges && !connectedEdges.has(edgeKey) ? 0.15 : isHighlighted ? 0.9 : 0.35}
                strokeDasharray={e.deterministic ? undefined : "5 3"}
                style={{ cursor: "pointer" }}
                onClick={(ev) => { ev.stopPropagation(); handleEdgeClick(e); }}
                onMouseEnter={() => setHoverEdge(edgeKey)}
                onMouseLeave={() => setHoverEdge(null)}
              />
            );
          })}

          {/* Edge labels on hover */}
          {edges.map((e, i) => {
            const s = posMap[e.source]; const t = posMap[e.target];
            if (!s || !t) return null;
            const edgeKey = `${e.source}-${e.target}`;
            if (hoverEdge !== edgeKey && selectedEdge !== e) return null;
            const mx = (s.x + t.x) / 2; const my = (s.y + t.y) / 2;
            return (
              <g key={`lbl-${i}`}>
                <rect x={mx - 40} y={my - 10} width={80} height={16} rx={4} fill="#FFFBF4" stroke="#E6E0D4" />
                <text x={mx} y={my + 2} textAnchor="middle" fontSize={9} fill="#4A5365" fontWeight={600}>{e.type.replace(/_/g, " ")}</text>
              </g>
            );
          })}

          {/* Nodes */}
          {positions.map((n) => {
            const r = nodeRadius(n);
            const fill = nodeColor(n);
            const isSelected = selectedNode === n.id;
            const isDimmed = selectedNode && !isSelected && !connectedEdges?.has(`${n.id}-${selectedNode}`) && !connectedEdges?.has(`${selectedNode}-${n.id}`);
            const short = n.label.length > 16 ? n.label.slice(0, 14) + "…" : n.label;
            return (
              <g key={n.id} style={{ cursor: "pointer" }} onClick={(ev) => { ev.stopPropagation(); handleNodeClick(n); }}>
                {isSelected && (
                  <circle cx={n.x} cy={n.y} r={r + 6} fill="none" stroke="#0D1B35" strokeWidth={2} strokeOpacity={0.25} />
                )}
                {n.is_subject && (
                  <circle cx={n.x} cy={n.y} r={r + 4} fill={fill} fillOpacity={0.12} />
                )}
                <circle
                  cx={n.x} cy={n.y} r={r}
                  fill={fill}
                  fillOpacity={isDimmed ? 0.2 : 0.92}
                  stroke={isSelected ? "#0D1B35" : fill}
                  strokeWidth={isSelected ? 2 : 1.5}
                  strokeOpacity={isDimmed ? 0.3 : 0.6}
                />
                <text
                  x={n.x} y={n.y + r + 13}
                  textAnchor="middle" fontSize={9}
                  fill="#4A5365" fontWeight={n.is_subject ? 700 : 500}
                  fillOpacity={isDimmed ? 0.3 : 1}
                >{short}</text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
