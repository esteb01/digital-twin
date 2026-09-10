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
          nodeRelSize={6}
          nodeVal="val"
          nodeColor={(node: GraphNode) =>
            node.id === selectedId ? '#e8eef4' : (node as FacetNode).color
          }
          linkColor={() => 'rgba(103, 232, 249, 0.28)'}
          linkWidth={0.6}
          linkOpacity={0.7}
          nodeThreeObject={(node: GraphNode) => {
            const sprite = new SpriteText(String(node.name ?? ''));
            sprite.color = node.id === selectedId ? '#e8eef4' : ((node as FacetNode).color || '#c5d0dc');
            sprite.textHeight = node.id === 'you' ? 7 : 5;
            sprite.fontFace = 'IBM Plex Sans, sans-serif';
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
