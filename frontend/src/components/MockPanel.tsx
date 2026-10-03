import { useQueryClient } from '@tanstack/react-query';
import { useState, useSyncExternalStore } from 'react';
import { resetMockData } from '../api/mock/server';
import { getMockMode, MOCK_MODES, setMockMode, subscribeMockMode, type MockMode } from '../api/mock/settings';
import { cx } from '../lib/cx';

const HINT: Record<MockMode, string> = {
  normal: 'Seeded data, ~300ms latency',
  slow: '2–3s latency: see loading states',
  error: 'Requests fail; sync jobs fail',
  empty: 'A brand-new account',
};

/** Dev-only: flip the mock API between normal / slow / error / empty to review every UI state. */
export function MockPanel() {
  const qc = useQueryClient();
  const mode = useSyncExternalStore(subscribeMockMode, getMockMode);
  const [open, setOpen] = useState(false);

  function choose(next: MockMode) {
    setMockMode(next);
    void qc.resetQueries();
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 text-xs">
      {open ? (
        <div className="w-64 rounded-xl bg-ink p-3 text-paper shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold">Mock API</span>
            <button onClick={() => setOpen(false)} className="text-paper/60 hover:text-paper" aria-label="Close mock panel">
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {MOCK_MODES.map((m) => (
              <button
                key={m}
                onClick={() => choose(m)}
                className={cx('rounded-md px-2 py-1.5 capitalize', m === mode ? 'bg-accent text-ink' : 'bg-paper/10 hover:bg-paper/20')}
              >
                {m}
              </button>
            ))}
          </div>
          <p className="mt-2 text-paper/60">{HINT[mode]}</p>
          <button
            onClick={() => {
              resetMockData();
              void qc.resetQueries();
            }}
            className="mt-2 underline decoration-paper/30 underline-offset-2 hover:decoration-paper"
          >
            Reset mock data
          </button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="rounded-full bg-ink/85 px-3 py-1.5 text-paper shadow-lg hover:bg-ink">
          mock · {mode}
        </button>
      )}
    </div>
  );
}
