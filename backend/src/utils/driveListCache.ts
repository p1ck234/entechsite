const DEFAULT_TTL_MS = 15 * 60 * 1000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

const normalizeKey = (prefix: string, resourceId: string): string => `${prefix}:${resourceId.trim()}`;

export const getDriveListCache = <T>(prefix: string, resourceId: string): T | null => {
  const key = normalizeKey(prefix, resourceId);
  const entry = cache.get(key) as CacheEntry<T> | undefined;

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.value;
};

export const setDriveListCache = <T>(
  prefix: string,
  resourceId: string,
  value: T,
  ttlMs = DEFAULT_TTL_MS
): void => {
  const key = normalizeKey(prefix, resourceId);
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
};

export const invalidateDriveListCache = (prefix: string, resourceId?: string): void => {
  if (!resourceId) {
    for (const key of cache.keys()) {
      if (key.startsWith(`${prefix}:`)) {
        cache.delete(key);
      }
    }
    return;
  }

  cache.delete(normalizeKey(prefix, resourceId));
};

export const invalidateAllDriveListCaches = (): void => {
  cache.clear();
};
