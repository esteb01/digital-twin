'use client';

import { kindLabel, type FacetNode } from '@/lib/graph-data';

type NodePanelProps = {
  node: FacetNode;
  onAsk?: (prompt: string) => void;
  onClose: () => void;
};

export default function NodePanel({ node, onAsk, onClose }: NodePanelProps) {
  const kind = kindLabel(node.group);

  return (
    <aside className="node-panel" aria-label={node.name}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          {kind && <p className="node-panel-kicker">{kind}</p>}
          <h2 className="node-panel-title">{node.name}</h2>
        </div>
        <button type="button" onClick={onClose} className="node-panel-close">
          Close
        </button>
      </div>
      <p className="node-panel-summary">{node.summary}</p>
      {node.facts.length > 0 && (
        <ul className="node-panel-facts">
          {node.facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      )}
      {node.links && node.links.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {node.links.map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="node-panel-link">
              {link.label}
            </a>
          ))}
        </div>
      )}
      {node.askPrompt && onAsk && (
        <button type="button" onClick={() => onAsk(node.askPrompt!)} className="node-panel-ask">
          Ask the twin
        </button>
      )}
    </aside>
  );
}
