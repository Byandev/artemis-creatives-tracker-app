import type { Creative } from '@/lib/creatives';

/**
 * Tiny in-memory hub shared by the lists and the detail screen:
 * - the last copy of each creative seen, so the detail screen can render instantly while it refreshes;
 * - change notifications, so a status set or review left on one screen updates every list.
 */
const known = new Map<number, Creative>();
const listeners = new Set<(creative: Creative) => void>();

export function rememberCreatives(creatives: Creative[]) {
  for (const creative of creatives) known.set(creative.id, creative);
}

export function knownCreative(id: number): Creative | undefined {
  return known.get(id);
}

/** Call after a mutation returns the fresh creative. */
export function publishCreative(creative: Creative) {
  known.set(creative.id, creative);
  listeners.forEach((listener) => listener(creative));
}

export function subscribeToCreatives(listener: (creative: Creative) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function forgetCreatives() {
  known.clear();
}
