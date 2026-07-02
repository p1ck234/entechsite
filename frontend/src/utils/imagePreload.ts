import { getImageUrlCandidates, isDriveImageRef, NormalizeImageUrlOptions } from './imageUtils';
import { fetchDriveImageBlobUrl } from './driveImageLoader';

interface PreloadEntry {
  src: string;
  options?: NormalizeImageUrlOptions;
}

const SUCCESS_CACHE = new Map<string, string>();
const INFLIGHT_CACHE = new Map<string, Promise<string | null>>();
const STORAGE_KEY = 'entech:image-candidate-cache:v2';
const MAX_PERSISTED_ENTRIES = 300;
const MAX_PRELOAD_CONCURRENCY = 4;
const MAX_PRELOAD_BATCH = 120;

interface QueuedPreloadTask {
  key: string;
  src: string;
  options?: NormalizeImageUrlOptions;
}

const PRELOAD_QUEUE: QueuedPreloadTask[] = [];
const QUEUED_KEYS = new Set<string>();
let activePreloads = 0;

let hydrated = false;
let persistScheduled = false;

const serializeOptions = (options?: NormalizeImageUrlOptions): string => {
  if (!options) {
    return '';
  }

  return [
    options.width ?? '',
    options.height ?? '',
    options.quality ?? '',
    options.fit ?? '',
  ].join(':');
};

const getCacheKey = (src: string, options?: NormalizeImageUrlOptions): string => {
  return `${src.trim()}|${serializeOptions(options)}`;
};

const hydrateCacheFromStorage = (): void => {
  if (hydrated || typeof window === 'undefined') {
    hydrated = true;
    return;
  }

  hydrated = true;

  try {
    const rawValue = window.sessionStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return;
    }

    const parsed = JSON.parse(rawValue) as Record<string, string>;
    Object.entries(parsed).forEach(([key, value]) => {
      if (key && value) {
        SUCCESS_CACHE.set(key, value);
      }
    });
  } catch {
    // Игнорируем ошибки чтения кеша.
  }
};

const persistCacheToStorage = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const entries = Array.from(SUCCESS_CACHE.entries());
    const limitedEntries = entries.slice(Math.max(0, entries.length - MAX_PERSISTED_ENTRIES));
    const serializable: Record<string, string> = {};

    for (const [key, value] of limitedEntries) {
      serializable[key] = value;
    }

    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch {
    // Игнорируем ошибки записи кеша.
  }
};

const schedulePersist = (): void => {
  if (persistScheduled || typeof window === 'undefined') {
    return;
  }

  persistScheduled = true;
  window.setTimeout(() => {
    persistScheduled = false;
    persistCacheToStorage();
  }, 500);
};

const loadImage = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
};

export const getCachedImageCandidate = (src: string, options?: NormalizeImageUrlOptions): string | null => {
  if (!src) {
    return null;
  }

  hydrateCacheFromStorage();
  return SUCCESS_CACHE.get(getCacheKey(src, options)) ?? null;
};

export const rememberImageCandidate = (src: string, options: NormalizeImageUrlOptions | undefined, candidateUrl: string): void => {
  if (!src || !candidateUrl) {
    return;
  }

  hydrateCacheFromStorage();
  const key = getCacheKey(src, options);

  if (SUCCESS_CACHE.get(key) === candidateUrl) {
    return;
  }

  SUCCESS_CACHE.set(key, candidateUrl);
  schedulePersist();
};

export const preloadImageCandidates = async (src: string, options?: NormalizeImageUrlOptions): Promise<string | null> => {
  if (!src) {
    return null;
  }

  hydrateCacheFromStorage();

  const key = getCacheKey(src, options);
  const cached = SUCCESS_CACHE.get(key);
  if (cached) {
    return cached;
  }

  const inflight = INFLIGHT_CACHE.get(key);
  if (inflight) {
    return inflight;
  }

  const task = (async () => {
    if (isDriveImageRef(src)) {
      try {
        const blobUrl = await fetchDriveImageBlobUrl(src, options);
        rememberImageCandidate(src, options, blobUrl);
        return blobUrl;
      } catch {
        return null;
      }
    }

    const candidates = getImageUrlCandidates(src, options);

    for (const candidate of candidates) {
      try {
        await loadImage(candidate);
        rememberImageCandidate(src, options, candidate);
        return candidate;
      } catch {
        // Пробуем следующий URL-кандидат.
      }
    }

    return null;
  })();

  INFLIGHT_CACHE.set(key, task);

  try {
    return await task;
  } finally {
    INFLIGHT_CACHE.delete(key);
  }
};

const processPreloadQueue = (): void => {
  while (activePreloads < MAX_PRELOAD_CONCURRENCY && PRELOAD_QUEUE.length > 0) {
    const task = PRELOAD_QUEUE.shift();
    if (!task) {
      return;
    }

    QUEUED_KEYS.delete(task.key);
    activePreloads += 1;

    void preloadImageCandidates(task.src, task.options).finally(() => {
      activePreloads = Math.max(0, activePreloads - 1);
      processPreloadQueue();
    });
  }
};

const enqueuePreload = (src: string, options?: NormalizeImageUrlOptions): void => {
  const key = getCacheKey(src, options);
  if (SUCCESS_CACHE.has(key) || INFLIGHT_CACHE.has(key) || QUEUED_KEYS.has(key)) {
    return;
  }

  QUEUED_KEYS.add(key);
  PRELOAD_QUEUE.push({ key, src, options });
};

export const preloadImages = (entries: PreloadEntry[], maxCount = 80): void => {
  if (!entries.length) {
    return;
  }

  const uniqueByKey = new Map<string, PreloadEntry>();

  for (const entry of entries) {
    if (!entry.src) {
      continue;
    }

    const key = getCacheKey(entry.src, entry.options);
    if (!uniqueByKey.has(key)) {
      uniqueByKey.set(key, entry);
    }
  }

  const safeLimit = Math.min(Math.max(0, maxCount), MAX_PRELOAD_BATCH);
  const limited = Array.from(uniqueByKey.values()).slice(0, safeLimit);
  for (const entry of limited) {
    enqueuePreload(entry.src, entry.options);
  }

  processPreloadQueue();
};
