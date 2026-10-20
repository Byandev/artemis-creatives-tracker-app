import { useCallback, useEffect, useState } from 'react';

import { ApiError, creativesApi } from '@/lib/api';
import { knownCreative, publishCreative, subscribeToCreatives } from '@/lib/creative-store';
import type { Creative } from '@/lib/creatives';
import { useSession } from '@/providers/session';

type LoadError = { message: string; notFound: boolean };

/**
 * One creative for the detail screen. Shows the copy the list already has right away, then
 * loads the fresh one; stays in step with changes published from anywhere else.
 */
export function useCreative(id: number) {
  const { token, signOut } = useSession();
  // Both keyed by id, so a stale creative or error never shows after navigating to another one.
  const [loaded, setLoaded] = useState<{ id: number; creative: Creative } | null>(null);
  const [failure, setFailure] = useState<{ id: number; error: LoadError } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  /** Fetches the creative; returns what to store, or null when signed out / nothing to do. */
  const fetchCreative = useCallback(async (): Promise<
    { creative: Creative; error: null } | { creative: null; error: LoadError } | null
  > => {
    if (!token || !Number.isFinite(id)) return null;
    try {
      const { data } = await creativesApi.show(token, id);
      return { creative: data, error: null };
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await signOut();
        return null;
      }
      const notFound = err instanceof ApiError && err.status === 404;
      return {
        creative: null,
        error: {
          notFound,
          message: notFound
            ? 'It may have been deleted, or you no longer have access to it.'
            : err instanceof ApiError && err.status < 500
              ? err.message
              : 'Artemis ran into a problem. Try again in a moment.',
        },
      };
    }
  }, [token, id, signOut]);

  const apply = useCallback(
    (outcome: Awaited<ReturnType<typeof fetchCreative>>) => {
      if (!outcome) return;
      if (outcome.creative) {
        setFailure(null);
        // Publishing (not just setting) also refreshes this creative's row in the lists.
        publishCreative(outcome.creative);
        setLoaded({ id, creative: outcome.creative });
      } else {
        setFailure({ id, error: outcome.error });
      }
    },
    [id],
  );

  const load = useCallback(() => fetchCreative().then(apply), [fetchCreative, apply]);

  useEffect(() => {
    // Ignore a response that lands after leaving (or switching) the creative.
    let active = true;
    fetchCreative().then((outcome) => {
      if (active) apply(outcome);
    });
    return () => {
      active = false;
    };
  }, [fetchCreative, apply]);

  useEffect(
    () =>
      subscribeToCreatives((changed) => {
        if (changed.id === id) setLoaded({ id, creative: changed });
      }),
    [id],
  );

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  const creative = loaded?.id === id ? loaded.creative : (knownCreative(id) ?? null);
  const error = failure?.id === id ? failure.error : null;

  return { creative, error, isLoading: creative === null && error === null, isRefreshing, refresh, retry: load };
}
