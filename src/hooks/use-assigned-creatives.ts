import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, creativesApi, type AssignedCreativesParams } from '@/lib/api';
import { rememberCreatives, subscribeToCreatives } from '@/lib/creative-store';
import { stillListed, type Creative } from '@/lib/creatives';
import { useSession } from '@/providers/session';

const PER_PAGE = 20;

type Params = Pick<AssignedCreativesParams, 'search' | 'format' | 'workspace'>;
type ListState = { items: Creative[]; total: number; toReview: number; nextCursor: string | null };
/** `revalidating` = silent background refresh of cached results. */
type Mode = 'loading' | 'refreshing' | 'revalidating' | 'loadingMore' | 'idle';

/**
 * A changed creative replaces its row (ticked once reviewed), or drops out once it is no
 * longer for approval. The counts follow along.
 */
function applyChange<T extends ListState>(state: T, creative: Creative): T {
  const index = state.items.findIndex((item) => item.id === creative.id);
  if (index === -1) return state;
  const wasToReview = state.items[index].my_review === null;
  if (!stillListed(creative)) {
    return {
      ...state,
      items: state.items.filter((item) => item.id !== creative.id),
      total: Math.max(0, state.total - 1),
      toReview: Math.max(0, state.toReview - (wasToReview ? 1 : 0)),
    };
  }
  const items = [...state.items];
  items[index] = creative;
  const nowReviewed = wasToReview && creative.my_review !== null;
  return { ...state, items, toReview: Math.max(0, state.toReview - (nowReviewed ? 1 : 0)) };
}

/**
 * Creatives the signed-in user reviews (for approval, assigned to them), with cursor-based
 * infinite scroll. Reloads from the first page whenever `search`, `format` or `workspace`
 * changes. Results per filter are kept in memory, so switching back to a filter shows them
 * instantly while they refresh in the background. Changes published from anywhere (quick
 * status, detail screen) update the rows in place.
 */
export function useAssignedCreatives({ search, format, workspace }: Params) {
  const { token, signOut } = useSession();
  const key = JSON.stringify([search ?? '', format ?? 'all', workspace ?? '']);

  const cache = useRef(new Map<string, ListState>());
  const [state, setState] = useState<ListState & { key: string | null }>({
    key: null,
    items: [],
    total: 0,
    toReview: 0,
    nextCursor: null,
  });
  const [mode, setMode] = useState<Mode>('loading');
  // Remember which filter the error belongs to, so a stale error never shows for a new filter.
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);

  // Only the latest request may write state, so a slow old response can't overwrite a newer one.
  const requestId = useRef(0);

  const fetchPage = useCallback(
    async (cursor: string | null, nextMode: Exclude<Mode, 'idle'>) => {
      if (!token) return;
      const id = ++requestId.current;
      setMode(nextMode);
      if (nextMode !== 'loadingMore') setFailure(null);

      try {
        const page = await creativesApi.assigned(token, { search, format, workspace, perPage: PER_PAGE, cursor });
        if (id !== requestId.current) return;
        rememberCreatives(page.data);
        setState((previous) => {
          const next: ListState = {
            items: cursor && previous.key === key ? [...previous.items, ...page.data] : page.data,
            total: page.total,
            toReview: page.to_review,
            nextCursor: page.next_cursor,
          };
          cache.current.set(key, next);
          return { key, ...next };
        });
      } catch (err) {
        if (id !== requestId.current) return;
        if (err instanceof ApiError && err.status === 401) {
          // Token was revoked or expired.
          await signOut();
          return;
        }
        setFailure({
          key,
          message:
            err instanceof ApiError && err.status < 500
              ? err.message
              : 'Artemis ran into a problem. Try again in a moment.',
        });
      } finally {
        if (id === requestId.current) setMode('idle');
      }
    },
    [token, signOut, search, format, workspace, key],
  );

  // New filter: show cached results right away (refreshing quietly), or skeletons if none.
  useEffect(() => {
    const cached = cache.current.get(key);
    if (cached) {
      setState({ key, ...cached });
      fetchPage(null, 'revalidating');
    } else {
      fetchPage(null, 'loading');
    }
  }, [fetchPage, key]);

  // Keep the shown list and every cached one in step with changes made elsewhere.
  useEffect(
    () =>
      subscribeToCreatives((creative) => {
        for (const [cacheKey, cached] of cache.current) {
          cache.current.set(cacheKey, applyChange(cached, creative));
        }
        setState((previous) => applyChange(previous, creative));
      }),
    [],
  );

  // `state.key !== key` is true on the very first render after a filter tap, before the effect
  // runs, so the screen switches to skeletons immediately instead of showing stale rows.
  const hasCurrent = state.key === key;
  const error = failure?.key === key ? failure.message : null;
  // A failed first load must end the skeleton so the error can show.
  const isLoading = !error && (!hasCurrent || (mode === 'loading' && state.items.length === 0));

  const refresh = useCallback(() => fetchPage(null, 'refreshing'), [fetchPage]);

  const loadMore = useCallback(() => {
    if (hasCurrent && state.nextCursor && mode === 'idle' && !error) {
      fetchPage(state.nextCursor, 'loadingMore');
    }
  }, [fetchPage, hasCurrent, state.nextCursor, mode, error]);

  return {
    items: hasCurrent ? state.items : [],
    total: hasCurrent ? state.total : 0,
    /** How many of `total` the user hasn't reviewed yet. */
    toReview: hasCurrent ? state.toReview : 0,
    error,
    isLoading,
    /** Pull-to-refresh only; background refreshes of cached results stay silent. */
    isRefreshing: mode === 'refreshing',
    isLoadingMore: mode === 'loadingMore',
    hasMore: hasCurrent && state.nextCursor !== null,
    refresh,
    loadMore,
    retry: () =>
      fetchPage(
        hasCurrent && state.items.length > 0 ? state.nextCursor : null,
        state.items.length > 0 ? 'loadingMore' : 'loading',
      ),
  };
}
