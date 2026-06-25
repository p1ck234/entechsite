import { API_BASE_URL } from '../config/api';

export type ImageResizeFit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';

export interface NormalizeImageUrlOptions {
  width?: number;
  height?: number;
  quality?: number;
  fit?: ImageResizeFit;
}

const RESIZE_FITS = new Set<ImageResizeFit>(['cover', 'contain', 'fill', 'inside', 'outside']);
const GOOGLE_HOST_MARKERS = ['google.com', 'googleusercontent.com'];

const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return '';
  }
})();

const isPositiveNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
};

const isTelegramMiniApp = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const telegramWindow = window as Window & { Telegram?: { WebApp?: unknown } };
  return Boolean(telegramWindow.Telegram?.WebApp);
};

const getFallbackOrigin = (): string => {
  if (API_ORIGIN) {
    return API_ORIGIN;
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return 'http://localhost';
};

const pushUniqueUrl = (target: string[], value?: string | null): void => {
  if (!value) {
    return;
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return;
  }

  if (!target.includes(normalizedValue)) {
    target.push(normalizedValue);
  }
};

const isGoogleUrl = (url: string): boolean => {
  return GOOGLE_HOST_MARKERS.some((marker) => url.includes(marker));
};

const extractGoogleFileId = (url: string): string | null => {
  const patterns = [
    /\/file\/d\/([^/?]+)/,
    /[?&]id=([^&]+)/,
    /\/d\/([^=/?]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
};

const cleanGoogleUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.delete('auditContext');
    urlObj.searchParams.delete('usp');
    return urlObj.toString();
  } catch {
    return url;
  }
};

const toAbsoluteUploadUrl = (sourceUrl: string): string => {
  const trimmedUrl = sourceUrl.trim();
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const baseOrigin = API_ORIGIN || currentOrigin;

  if (/^https?:\/\//i.test(trimmedUrl)) {
    try {
      const parsedUrl = new URL(trimmedUrl);

      if (parsedUrl.pathname.startsWith('/uploads/')) {
        parsedUrl.pathname = `/api${parsedUrl.pathname}`;
      }

      const shouldRewriteToApiOrigin =
        Boolean(API_ORIGIN) &&
        parsedUrl.pathname.startsWith('/api/uploads/') &&
        parsedUrl.origin !== API_ORIGIN;

      if (shouldRewriteToApiOrigin) {
        const apiUrl = new URL(API_ORIGIN);
        parsedUrl.protocol = apiUrl.protocol;
        parsedUrl.host = apiUrl.host;
      }

      return parsedUrl.toString();
    } catch {
      return trimmedUrl;
    }
  }

  if (!baseOrigin) {
    return trimmedUrl;
  }

  if (trimmedUrl.startsWith('/api/uploads/')) {
    return `${baseOrigin}${trimmedUrl}`;
  }

  if (trimmedUrl.startsWith('api/uploads/')) {
    return `${baseOrigin}/${trimmedUrl}`;
  }

  if (trimmedUrl.startsWith('/uploads/')) {
    return `${baseOrigin}/api${trimmedUrl}`;
  }

  if (trimmedUrl.startsWith('uploads/')) {
    return `${baseOrigin}/api/${trimmedUrl}`;
  }

  return trimmedUrl;
};

const buildMediaProxyUrl = (sourceUrl: string): string | null => {
  try {
    const proxyUrl = new URL('/api/media/proxy', getFallbackOrigin());
    proxyUrl.searchParams.set('url', sourceUrl);
    return proxyUrl.toString();
  } catch {
    return null;
  }
};

const isUploadUrl = (sourceUrl: string): boolean => {
  try {
    const parsedUrl = new URL(sourceUrl, getFallbackOrigin());
    return parsedUrl.pathname.startsWith('/api/uploads/') || parsedUrl.pathname.startsWith('/uploads/');
  } catch {
    return sourceUrl.startsWith('/api/uploads/') || sourceUrl.startsWith('/uploads/');
  }
};

const applyUploadOptimization = (sourceUrl: string, options?: NormalizeImageUrlOptions): string => {
  if (!options) {
    return sourceUrl;
  }

  const hasOptimizationOptions =
    isPositiveNumber(options.width) ||
    isPositiveNumber(options.height) ||
    isPositiveNumber(options.quality) ||
    (options.fit !== undefined && RESIZE_FITS.has(options.fit));

  if (!hasOptimizationOptions) {
    return sourceUrl;
  }

  try {
    const parsedUrl = new URL(sourceUrl, getFallbackOrigin());

    if (!parsedUrl.pathname.startsWith('/api/uploads/')) {
      return sourceUrl;
    }

    if (isPositiveNumber(options.width)) {
      parsedUrl.searchParams.set('w', Math.round(options.width).toString());
    }

    if (isPositiveNumber(options.height)) {
      parsedUrl.searchParams.set('h', Math.round(options.height).toString());
    }

    if (isPositiveNumber(options.quality)) {
      parsedUrl.searchParams.set('q', Math.min(100, Math.round(options.quality)).toString());
    }

    if (options.fit !== undefined && RESIZE_FITS.has(options.fit)) {
      parsedUrl.searchParams.set('fit', options.fit);
    }

    return parsedUrl.toString();
  } catch {
    return sourceUrl;
  }
};

const resolveGoogleTargetSize = (options?: NormalizeImageUrlOptions): number => {
  const width = isPositiveNumber(options?.width) ? Math.round(options.width) : 0;
  const height = isPositiveNumber(options?.height) ? Math.round(options.height) : 0;
  const baseSize = Math.max(width, height, 512);
  return Math.min(1600, Math.max(128, baseSize));
};

const buildGoogleCandidates = (sourceUrl: string, options?: NormalizeImageUrlOptions): string[] => {
  const candidates: string[] = [];
  const cleanedSource = cleanGoogleUrl(sourceUrl);
  const targetSize = resolveGoogleTargetSize(options);
  const miniApp = isTelegramMiniApp();
  const cleanedProxy = buildMediaProxyUrl(cleanedSource);
  const fileId = extractGoogleFileId(cleanedSource);
  const idBasedCandidates = fileId
    ? [
        `https://drive.google.com/thumbnail?id=${fileId}&sz=w${targetSize}`,
        `https://drive.google.com/uc?export=view&id=${fileId}`,
        `https://drive.usercontent.google.com/download?id=${fileId}&export=view`,
        `https://lh3.googleusercontent.com/d/${fileId}=s${targetSize}`,
      ]
    : [];

  if (miniApp) {
    // В Mini App сначала пробуем proxy/id-based варианты, чтобы не зависнуть на
    // ссылках, которые в webview отправляют в Google Sign-In.
    pushUniqueUrl(candidates, cleanedProxy);
    idBasedCandidates.forEach((url) => {
      pushUniqueUrl(candidates, buildMediaProxyUrl(url));
    });
    idBasedCandidates.forEach((url) => {
      pushUniqueUrl(candidates, url);
    });
    pushUniqueUrl(candidates, sourceUrl);
    pushUniqueUrl(candidates, cleanedSource);
    return candidates;
  }

  pushUniqueUrl(candidates, sourceUrl);
  pushUniqueUrl(candidates, cleanedSource);
  idBasedCandidates.forEach((url) => {
    pushUniqueUrl(candidates, url);
  });
  idBasedCandidates.forEach((url) => {
    pushUniqueUrl(candidates, buildMediaProxyUrl(url));
  });
  pushUniqueUrl(candidates, cleanedProxy);

  return candidates;
};

/**
 * Возвращает список URL-кандидатов:
 * - приводит ссылки загрузок /api/uploads к backend origin (важно для Telegram Mini App);
 * - для upload URL добавляет fallback без параметров оптимизации;
 * - для Google URL добавляет несколько совместимых форматов.
 */
export function getImageUrlCandidates(url: string, options?: NormalizeImageUrlOptions): string[] {
  if (!url) {
    return [];
  }

  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return [];
  }

  if (trimmedUrl.startsWith('data:') || trimmedUrl.startsWith('blob:')) {
    return [trimmedUrl];
  }

  const uploadAbsoluteUrl = toAbsoluteUploadUrl(trimmedUrl);
  if (isUploadUrl(uploadAbsoluteUrl)) {
    const candidates: string[] = [];
    pushUniqueUrl(candidates, applyUploadOptimization(uploadAbsoluteUrl, options));
    pushUniqueUrl(candidates, uploadAbsoluteUrl);
    pushUniqueUrl(candidates, trimmedUrl);
    return candidates;
  }

  if (isGoogleUrl(trimmedUrl)) {
    return buildGoogleCandidates(trimmedUrl, options);
  }

  const candidates: string[] = [];
  pushUniqueUrl(candidates, uploadAbsoluteUrl);
  pushUniqueUrl(candidates, trimmedUrl);
  return candidates;
}

/**
 * Нормализует ссылку изображения:
 * - приводит ссылки загрузок /api/uploads к backend origin;
 * - по необходимости добавляет параметры оптимизации (w/h/q/fit) для локальных загрузок.
 * Для более устойчивой загрузки лучше использовать `getImageUrlCandidates`.
 */
export function normalizeImageUrl(url: string, options?: NormalizeImageUrlOptions): string {
  const candidates = getImageUrlCandidates(url, options);
  return candidates[0] ?? url;
}

