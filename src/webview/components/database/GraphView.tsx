import React, { useEffect, useRef, useState, useCallback } from "react";
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, SimulationNodeDatum, SimulationLinkDatum } from "d3-force";
import { GraphViewProps, GraphLink } from "../../types/GraphTypes";

// ── Node / link types for d3 ──────────────────────────────────────

interface GraphNode extends SimulationNodeDatum {
  id: string;        // relativePath
  title: string;
}

interface GraphEdge extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

// ── Constants ─────────────────────────────────────────────────────

const NODE_RX = 8;         // rounded rect corner radius
const NODE_H = 32;
const NODE_PAD_X = 14;
const FONT_SIZE = 12;
const ARROW_SIZE = 6;

// ── Component ─────────────────────────────────────────────────────

export function GraphView({ entries, links, communicator }: GraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  // ── Build simulation ────────────────────────────────────────────
  useEffect(() => {
    const nodeMap = new Map<string, GraphNode>();
    entries.forEach((e) => {
      nodeMap.set(e.relativePath, { id: e.relativePath, title: e.title });
    });

    const validEdges: GraphEdge[] = links
      .filter((l) => nodeMap.has(l.source) && nodeMap.has(l.target))
      .map((l) => ({ source: l.source, target: l.target }));

    const simNodes = Array.from(nodeMap.values());

    const sim = forceSimulation<GraphNode>(simNodes)
      .force("link", forceLink<GraphNode, GraphEdge>(validEdges).id((d) => d.id).distance(140))
      .force("charge", forceManyBody().strength(-300))
      .force("center", forceCenter(0, 0))
      .force("collide", forceCollide<GraphNode>(60));

    sim.on("tick", () => {
      setNodes([...simNodes]);
      setEdges([...validEdges]);
    });

    // Warm up quickly
    sim.alpha(1).restart();

    return () => { sim.stop(); };
  }, [entries, links]);

  // ── Node width helper (approximate) ─────────────────────────────
  function nodeWidth(title: string): number {
    return Math.max(60, title.length * (FONT_SIZE * 0.6) + NODE_PAD_X * 2);
  }

  // ── Pan / zoom handlers ─────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    setTransform((t) => ({ ...t, scale: Math.max(0.2, Math.min(3, t.scale * factor)) }));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  }, [transform]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    setTransform((t) => ({ ...t, x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y }));
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  // ── Render ──────────────────────────────────────────────────────
  return (
    <svg
      ref={svgRef}
      className="graph-view-svg"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <defs>
        <marker
          id="arrow"
          viewBox={`0 0 ${ARROW_SIZE * 2} ${ARROW_SIZE * 2}`}
          refX={ARROW_SIZE * 2}
          refY={ARROW_SIZE}
          markerWidth={ARROW_SIZE}
          markerHeight={ARROW_SIZE}
          orient="auto"
        >
          <path
            d={`M0,0 L${ARROW_SIZE * 2},${ARROW_SIZE} L0,${ARROW_SIZE * 2} Z`}
            fill="var(--muted)"
          />
        </marker>
      </defs>

      <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
        {/* Edges */}
        {edges.map((edge, i) => {
          const s = edge.source as GraphNode;
          const t = edge.target as GraphNode;
          if (!s.x || !s.y || !t.x || !t.y) return null;
          return (
            <line
              key={`e-${i}`}
              x1={s.x}
              y1={s.y}
              x2={t.x}
              y2={t.y}
              className="graph-edge"
              markerEnd="url(#arrow)"
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          if (node.x == null || node.y == null) return null;
          const w = nodeWidth(node.title);
          return (
            <g
              key={node.id}
              className="graph-node"
              transform={`translate(${node.x - w / 2}, ${node.y - NODE_H / 2})`}
              onClick={() => communicator.sendOpenEntry(node.id)}
              style={{ cursor: "pointer" }}
            >
              <rect
                width={w}
                height={NODE_H}
                rx={NODE_RX}
                ry={NODE_RX}
                className="graph-node-rect"
              />
              <text
                x={w / 2}
                y={NODE_H / 2}
                textAnchor="middle"
                dominantBaseline="central"
                className="graph-node-text"
                fontSize={FONT_SIZE}
              >
                {node.title}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
