import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, creativesApi, type AssignedCreativesParams } from '@/lib/api';
import type { AssignedCreative } from '@/lib/creatives';
import { useSession } from '@/providers/session';

const PER_PAGE = 20;

type Params = Pick<AssignedCreativesParams, 'search' | 'format' | 'workspace'>;
type ListState = { items: AssignedCreative[]; total: number; nextCursor: string | null };
/** `revalidating` = silent background refresh of cached results. */
type Mode = 'loading' | 'refreshing' | 'revalidating' | 'loadingMore' | 'idle';

/**
 * Creatives waiting on the signed-in user's review, with cursor-based infinite scroll.
 * Reloads from the first page whenever `search`, `format` or `workspace` changes. Results
 * per filter are kept in memory, so switching back to a filter shows them instantly while
 * they refresh in the background.
 */
export function useAssignedCreatives({ search, format, workspace }: Params) {
  const { token, signOut } = useSession();
  const key = JSON.stringify([search ?? '', format ?? 'all', workspace ?? '']);

  const cache = useRef(new Map<string, ListState>());
  const [list, setList] = useState<ListState & { key: string | null }>({
    key: null,
    items: [],
    total: 0,
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
        setList((previous) => {
          const next: ListState = {
            items: cursor && previous.key === key ? [...previous.items, ...page.data] : page.data,
            total: page.total,
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
            err instanceof ApiError && err.status > 0 && err.status < 500
              ? err.message
              : err instanceof ApiError && err.status === 0
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
      setList({ key, ...cached });
      fetchPage(null, 'revalidating');
    } else {
      fetchPage(null, 'loading');
    }
  }, [fetchPage, key]);

  // `list.key !== key` is true on the very first render after a filter tap, before the effect
  // runs, so the screen switches to skeletons immediately instead of showing stale rows.
  const hasCurrent = list.key === key;
  const error = failure?.key === key ? failure.message : null;
  // A failed first load must end the skeleton so the error can show.
  const isLoading = !error && (!hasCurrent || (mode === 'loading' && list.items.length === 0));

  const refresh = useCallback(() => fetchPage(null, 'refreshing'), [fetchPage]);

  const loadMore = useCallback(() => {
    if (hasCurrent && list.nextCursor && mode === 'idle' && !error) {
      fetchPage(list.nextCursor, 'loadingMore');
    }
  }, [fetchPage, hasCurrent, list.nextCursor, mode, error]);

  return {
    items: hasCurrent ? list.items : [],
    total: hasCurrent ? list.total : 0,
    error,
    isLoading,
    /** Pull-to-refresh only; background refreshes of cached results stay silent. */
    isRefreshing: mode === 'refreshing',
    isLoadingMore: mode === 'loadingMore',
    hasMore: hasCurrent && list.nextCursor !== null,
    refresh,
    loadMore,
    retry: () =>
      fetchPage(hasCurrent && list.items.length > 0 ? list.nextCursor : null, list.items.length > 0 ? 'loadingMore' : 'loading'),
  };
}
