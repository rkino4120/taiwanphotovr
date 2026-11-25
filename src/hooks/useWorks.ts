import { useState, useEffect, useCallback, useRef } from 'react';
import type { Work } from '../types/work';

interface UseWorksResult {
  works: Work[];
  loading: boolean;
  error: Error | null;
  refetch: (useCache?: boolean) => Promise<void>;
  lastUpdated: Date | null;
}

const CACHE_KEY = 'webgl-works-cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5分

interface CacheData {
  works: Work[];
  timestamp: number;
}

interface MicroCMSResponse {
  contents?: Work[];
  totalCount?: number;
}

const MICROCMS_URL =
  import.meta.env.VITE_MICROCMS_API_URL || 'https://liangworks.microcms.io/api/v1/taiwanphoto';
const API_KEY = import.meta.env.VITE_MICROCMS_API_KEY || import.meta.env.MICROCMS_API_KEY;

export const useWorks = (): UseWorksResult => {
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const loadFromCache = useCallback((): Work[] | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const cacheData = JSON.parse(cached) as CacheData;
        if (
          Array.isArray(cacheData.works) &&
          typeof cacheData.timestamp === 'number' &&
          Date.now() - cacheData.timestamp < CACHE_DURATION
        ) {
          return cacheData.works;
        }
      }
    } catch (err) {
      console.warn('Failed to load from cache:', err);
      try {
        localStorage.removeItem(CACHE_KEY);
      } catch {
        // storage unavailable
      }
    }
    return null;
  }, []);

  const saveToCache = useCallback((data: Work[]) => {
    try {
      const cacheData: CacheData = {
        works: data,
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (err) {
      console.warn('Failed to save to cache:', err);
    }
  }, []);

  const fetchWorks = useCallback(
    async (useCache = true) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        setLoading(true);
        setError(null);

        if (useCache) {
          const cachedWorks = loadFromCache();
          if (cachedWorks && cachedWorks.length > 0) {
            setWorks(cachedWorks);
            setLastUpdated(new Date());
            setLoading(false);
            return;
          }
        }

        const headers: Record<string, string> = {};
        if (API_KEY) {
          headers['X-MICROCMS-API-KEY'] = API_KEY;
        }

        const allContents: Work[] = [];
        const limit = 100;
        let offset = 0;
        let totalCount = Number.POSITIVE_INFINITY;

        while (allContents.length < totalCount) {
          if (controller.signal.aborted) {
            throw new DOMException('Aborted', 'AbortError');
          }

          const url = `${MICROCMS_URL}?limit=${limit}&offset=${offset}`;
          const res = await fetch(url, { headers, signal: controller.signal });

          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`MicroCMS API error (${res.status}): ${errorText}`);
          }

          const data = (await res.json()) as MicroCMSResponse;
          const contents = data.contents ?? [];

          if (typeof data.totalCount === 'number') {
            totalCount = data.totalCount;
          }

          allContents.push(...contents);
          offset += contents.length;

          if (contents.length === 0) {
            break;
          }
        }

        if (!controller.signal.aborted) {
          setWorks(allContents);
          saveToCache(allContents);
          setLastUpdated(new Date());
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }

        console.error('Failed to fetch works:', err);
        setError(err instanceof Error ? err : new Error('Unknown error occurred'));
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [loadFromCache, saveToCache],
  );

  useEffect(() => {
    const id = window.setTimeout(() => {
      void fetchWorks();
    }, 0);

    return () => {
      window.clearTimeout(id);
      abortControllerRef.current?.abort();
    };
  }, [fetchWorks]);

  const refetch = useCallback((useCache = false) => fetchWorks(useCache), [fetchWorks]);

  return {
    works,
    loading,
    error,
    refetch,
    lastUpdated,
  };
};

export default useWorks;
