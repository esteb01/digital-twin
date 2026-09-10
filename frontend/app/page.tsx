'use client';

import { useState } from 'react';
import CompanionBot from '@/components/companion-bot';
import Twin from '@/components/twin';

export default function Home() {
  const [busy, setBusy] = useState(false);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,_#163044_0%,_#07090d_42%,_#05070a_100%)] font-[family-name:var(--font-sans)] text-[#c5d0dc]">
      <CompanionBot attentive={busy} />
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-3 py-3 md:px-5 md:py-4">
        <Twin onBusy={setBusy} />
      </div>
    </main>
  );
}
