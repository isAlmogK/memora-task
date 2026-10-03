/** Dev-only switch for exercising loading / error / empty states against the mock API. */
export type MockMode = 'normal' | 'slow' | 'error' | 'empty';
export const MOCK_MODES: MockMode[] = ['normal', 'slow', 'error', 'empty'];

const KEY = 'stacks.mockMode';
const listeners = new Set<() => void>();

export function getMockMode(): MockMode {
  const stored = localStorage.getItem(KEY);
  return MOCK_MODES.includes(stored as MockMode) ? (stored as MockMode) : 'normal';
}

export function setMockMode(mode: MockMode): void {
  localStorage.setItem(KEY, mode);
  listeners.forEach((l) => l());
}

export function subscribeMockMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
