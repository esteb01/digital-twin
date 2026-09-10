'use client';

import type { FacetNode } from '@/lib/graph-data';

type NodePanelProps = {
  node: FacetNode;
  onAsk?: (prompt: string) => void;
  onClose: () => void;
};

export default function NodePanel({ node, onAsk, onClose }: NodePanelProps) {
  return (
    <aside className="node-panel" aria-label={node.name}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.14em] text-[#67e8f9]">
            {node.pending ? 'NOT PUBLIC YET' : node.group.toUpperCase()}
          </p>
          <h2 className="mt-1 text-xl text-[#e8eef4]">{node.name}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-sm border border-[#2d3a4a] px-2 py-1 text-xs text-[#93a4b8] hover:text-[#e8eef4]"
        >
          Close
        </button>
      </div>
      <p className="text-sm leading-relaxed text-[#c5d0dc]">{node.summary}</p>
      <ul className="mt-3 space-y-2 text-sm text-[#93a4b8]">
        {node.facts.map((fact) => (
          <li key={fact} className="border-l border-[#2d3a4a] pl-3">
            {fact}
          </li>
        ))}
      </ul>
      {node.links && node.links.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {node.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="rounded-sm border border-[#2d3a4a] px-2 py-1 text-xs text-[#67e8f9] hover:border-[#67e8f9]/50"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
      {node.askPrompt && onAsk && (
        <button
          type="button"
          onClick={() => onAsk(node.askPrompt!)}
          className="mt-4 w-full rounded-sm bg-[#163044] px-3 py-2 text-sm text-[#67e8f9] hover:bg-[#1d4d6b]"
        >
          Ask the twin
        </button>
      )}
    </aside>
  );
}
