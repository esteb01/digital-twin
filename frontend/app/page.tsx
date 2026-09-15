'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import CompanionBot from '@/components/companion-bot';
import NodePanel from '@/components/node-panel';
import Twin from '@/components/twin';
import { FACET_NODES, type FacetNode } from '@/lib/graph-data';

const GraphCanvas = dynamic(() => import('@/components/graph-canvas'), {
  ssr: false,
  loading: () => (
    <div className="graph-canvas graph-canvas-loading" role="status">
      Loading hub…
    </div>
  ),
});

export default function Home() {
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<FacetNode | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | undefined>();

  const askFromNode = (prompt: string) => {
    setChatOpen(true);
    setPendingPrompt(prompt);
  };

  return (
    <main className="graph-shell font-[family-name:var(--font-sans)] text-[#c5d0dc]">
      <GraphCanvas selectedId={selected?.id} onSelect={setSelected} />

      <header className="graph-chrome">
        <div>
          <div className="flex items-center gap-2">
            <CompanionBot attentive={busy} variant="static" />
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-lg tracking-[0.08em] text-[#e8eef4] md:text-2xl">
                Esteban Ruiz
              </h1>
              <p className="text-xs text-[#93a4b8] md:text-sm">Drag to orbit · click a node</p>
            </div>
            <button
              type="button"
              onClick={() => setChatOpen((open) => !open)}
              className="ml-2 rounded-sm border border-[#2d3a4a] bg-[#151b24] px-3 py-1.5 text-sm text-[#67e8f9] hover:border-[#67e8f9]/50"
            >
              {chatOpen ? 'Hide chat' : 'Ask me'}
            </button>
          </div>
          <div className="mt-2 flex max-w-[36rem] flex-wrap gap-1.5">
            {FACET_NODES.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => setSelected(node)}
                className={`rounded-sm border px-2 py-1 text-xs ${
                  selected?.id === node.id
                    ? 'border-[#67e8f9] text-[#e8eef4]'
                    : 'border-[#2d3a4a] text-[#93a4b8] hover:text-[#e8eef4]'
                }`}
              >
                {node.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      {selected && (
        <NodePanel
          node={selected}
          onAsk={selected.askPrompt ? askFromNode : undefined}
          onClose={() => setSelected(null)}
        />
      )}

      {chatOpen && (
        <section className="chat-drawer" aria-label="Career digital twin chat">
          <Twin
            compact
            onBusy={setBusy}
            pendingPrompt={pendingPrompt}
            onPromptConsumed={() => setPendingPrompt(undefined)}
          />
        </section>
      )}
    </main>
  );
}
