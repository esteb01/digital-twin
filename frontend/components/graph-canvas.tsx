'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph3D, { type ForceGraphMethods, type NodeObject } from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';
import { graphPayload, type FacetNode } from '@/lib/graph-data';

type GraphCanvasProps = {
  selectedId?: string;
  onSelect: (node: FacetNode) => void;
};

type GraphNode = NodeObject<FacetNode>;

export default function GraphCanvas({ selectedId, onSelect }: GraphCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods<FacetNode> | undefined>(undefined);
  const fittedRef = useRef(false);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const data = useMemo(() => graphPayload(), []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const sync = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const charge = fg.d3Force('charge');
    if (charge && typeof charge.strength === 'function') {
      charge.strength(-160);
    }
    const link = fg.d3Force('link');
    if (link && typeof link.distance === 'function') {
      link.distance(72);
    }
  }, []);

  useEffect(() => {
    fgRef.current?.refresh();
  }, [selectedId]);

  return (
    <div ref={wrapRef} className="graph-canvas">
      {size.width > 0 && (
        <ForceGraph3D<FacetNode>
          ref={fgRef}
          width={size.width}
          height={size.height}
          graphData={data}
          backgroundColor="#07090d"
          showNavInfo={false}
          enableNodeDrag
          nodeLabel="name"
          nodeRelSize={7}
          nodeOpacity={0.95}
          nodeResolution={24}
          nodeVal={(node: GraphNode) => {
            const base = Number((node as FacetNode).val ?? 10);
            return node.id === selectedId ? base * 1.55 : base;
          }}
          nodeColor={(node: GraphNode) =>
            node.id === selectedId ? '#f8fafc' : (node as FacetNode).color
          }
          linkColor={() => 'rgba(103, 232, 249, 0.38)'}
          linkWidth={(link) => {
            const src = typeof link.source === 'object' ? (link.source as GraphNode).id : link.source;
            const tgt = typeof link.target === 'object' ? (link.target as GraphNode).id : link.target;
            return src === selectedId || tgt === selectedId ? 1.6 : 0.7;
          }}
          linkOpacity={0.85}
          nodeThreeObject={(node: GraphNode) => {
            const selected = node.id === selectedId;
            const base = Number((node as FacetNode).val ?? 10);
            const val = selected ? base * 1.55 : base;
            const radius = 7 * Math.cbrt(val);
            const sprite = new SpriteText(String(node.name ?? ''));
            sprite.color = selected ? '#f8fafc' : '#e8eef4';
            sprite.textHeight = selected ? 7 : node.id === 'you' ? 6.5 : 5.5;
            sprite.fontFace = 'IBM Plex Sans, sans-serif';
            sprite.fontWeight = selected ? '600' : '500';
            sprite.strokeWidth = 1.6;
            sprite.strokeColor = '#07090d';
            sprite.backgroundColor = selected ? 'rgba(22, 48, 68, 0.92)' : 'rgba(7, 9, 13, 0.78)';
            sprite.padding = 1.6;
            sprite.borderRadius = 2;
            sprite.center.set(0.5, 1);
            sprite.position.y = -(radius + 1.8);
            return sprite;
          }}
          nodeThreeObjectExtend
          onEngineStop={() => {
            if (fittedRef.current) return;
            fittedRef.current = true;
            fgRef.current?.zoomToFit(400, 90);
          }}
          onNodeClick={(node: GraphNode) => {
            const facet = node as FacetNode;
            onSelect(facet);
            if (node.x == null || node.y == null || node.z == null) return;
            fgRef.current?.cameraPosition(
              { x: node.x, y: node.y, z: node.z + 140 },
              { x: node.x, y: node.y, z: node.z },
              900,
            );
          }}
        />
      )}
    </div>
  );
}
