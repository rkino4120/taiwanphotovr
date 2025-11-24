import { useState, useEffect, useCallback, useRef } from 'react';
import type { Work } from '../types/work';

interface UseWorksResult {
  works: Work[];
  loading: boolean;
  error: Error | null; // stringよりErrorオブジェクトの方が扱いやすい場合が多い
  refetch: (useCache?: boolean) => Promise<void>;
  lastUpdated: Date | null;
}

const CACHE_KEY = 'webgl-works-cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5分

interface CacheData {
  works: Work[];
  timestamp: number;
}

// 環境変数から取得（なければ空文字）
const MICROCMS_URL = import.meta.env.VITE_MICROCMS_API_URL || 'https://liangworks.microcms.io/api/v1/taiwanphoto';
const API_KEY = import.meta.env.VITE_MICROCMS_API_KEY || import.meta.env.MICROCMS_API_KEY;

// デバッグ用ログ（本番環境で環境変数が読み込まれているか確認）
console.log('API Key exists:', !!API_KEY, 'Length:', API_KEY?.length || 0);

export const useWorks = (): UseWorksResult => {
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // 実行中のfetchをキャンセルするためのRef
  const abortControllerRef = useRef<AbortController | null>(null);

  // キャッシュ読み込み
  const loadFromCache = useCallback((): Work[] | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const cacheData: CacheData = JSON.parse(cached);
        if (Date.now() - cacheData.timestamp < CACHE_DURATION) {
          return cacheData.works;
        }
      }
    } catch (err) {
      console.warn('Failed to load from cache:', err);
      // キャッシュが壊れている場合は削除しておく
      localStorage.removeItem(CACHE_KEY);
    }
    return null;
  }, []);

  // キャッシュ保存
  const saveToCache = useCallback((data: Work[]) => {
    try {
      const cacheData: CacheData = {
        works: data,
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (err) {
      // localStorageの容量オーバーなどが考えられる
      console.warn('Failed to save to cache:', err);
    }
  }, []);

  const fetchWorks = useCallback(async (useCache = true) => {
    // 前回のクエストが進行中ならキャンセル
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    // 新しいコントローラーを作成
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      // APIキーチェック
      if (!API_KEY) {
        throw new Error('MicroCMS API Key is not configured.');
      }

      // キャッシュ利用フロー
      if (useCache) {
        const cachedWorks = loadFromCache();
        if (cachedWorks) {
          setWorks(cachedWorks);
          setLoading(false);
          setLastUpdated(new Date());
          return;
        }
      }

      const headers: Record<string, string> = {
        'X-MICROCMS-API-KEY': API_KEY as string,
      };

      // 全件取得ループ
      const allContents: Work[] = [];
      const limit = 100;
      let offset = 0;
      let totalCount = 0; // 初期値は0にしておき、初回レスポンスで更新する
      let hasMore = true;

      while (hasMore) {
        // fetchが中断されていたらループを抜ける
        if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');

        const url = `${MICROCMS_URL}?limit=${limit}&offset=${offset}`;
        const res = await fetch(url, { headers, signal: controller.signal });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`MicroCMS API error (${res.status}): ${errorText}`);
        }

        const data = await res.json();
        const contents: Work[] = data.contents || [];
        
        // 初回ループでtotalCountを確定させる
        if (offset === 0) {
            totalCount = data.totalCount;
        }

        allContents.push(...contents);
        offset += contents.length;

        // 終了判定: 取得数がtotalCountに達した、または返ってきたコンテンツが0件
        if (allContents.length >= totalCount || contents.length === 0) {
          hasMore = false;
        }
      }

      // 成功時処理
      if (!controller.signal.aborted) {
        setWorks(allContents);
        saveToCache(allContents);
        setLastUpdated(new Date());
      }

    } catch (err) {
      // AbortErrorの場合はエラーとして扱わない（単なるキャンセル）
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.log('Fetch aborted');
        return;
      }

      console.error('Failed to fetch works:', err);
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
      
      // エラー時のダミーデータセットは削除しました。
      // UI側で `if (error) return <ErrorComponent />` のように制御することを推奨します。

    } finally {
      // キャンセルされていない場合のみローディングを終了
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [loadFromCache, saveToCache]);

  // 初回マウント時の処理
  useEffect(() => {
    fetchWorks();
    
    // アンマウント時のクリーンアップ
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchWorks]);

  return {
    works,
    loading,
    error,
    refetch: (useCache = false) => fetchWorks(useCache),
    lastUpdated,
  };
};

export default useWorks;