import { API_BASE_URL } from '../config/api';

export type ImageResizeFit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';

export interface NormalizeImageUrlOptions {
  width?: number;
  height?: number;
  quality?: number;
  fit?: ImageResizeFit;
}

const RESIZE_FITS = new Set<ImageResizeFit>(['cover', 'contain', 'fill', 'inside', 'outside']);

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
    const fallbackOrigin = API_ORIGIN || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    const parsedUrl = new URL(sourceUrl, fallbackOrigin);

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

const normalizeGoogleDriveUrl = (url: string): string => {
  // Формат: https://lh3.google.com/u/0/d/FILE_ID=w2880-h1764-iv1?auditContext=prefetch
  if (url.includes('lh3.google.com')) {
    const lh3Match = url.match(/lh3\.google\.com\/[^/]+\/d\/([^=]+)/);
    if (lh3Match) {
      const fileId = lh3Match[1];
      return `https://drive.google.com/uc?export=view&id=${fileId}`;
    }

    try {
      const urlObj = new URL(url);
      urlObj.searchParams.delete('auditContext');
      urlObj.searchParams.delete('usp');
      if (urlObj.pathname.includes('=')) {
        urlObj.pathname = urlObj.pathname.replace(/=[^?]+/, '=s0');
      }
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  // Формат: https://drive.google.com/file/d/FILE_ID/view
  const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveFileMatch) {
    return `https://drive.google.com/uc?export=view&id=${driveFileMatch[1]}`;
  }

  // Формат: https://drive.google.com/open?id=FILE_ID
  const driveOpenMatch = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (driveOpenMatch) {
    return `https://drive.google.com/uc?export=view&id=${driveOpenMatch[1]}`;
  }

  // Формат: https://docs.google.com/uc?id=FILE_ID
  const docsMatch = url.match(/docs\.google\.com\/uc\?id=([^&]+)/);
  if (docsMatch) {
    return `https://drive.google.com/uc?export=view&id=${docsMatch[1]}`;
  }

  // Формат: https://lh3.googleusercontent.com/d/FILE_ID=w0
  const lh3UserContentMatch = url.match(/lh3\.googleusercontent\.com\/d\/([^=]+)/);
  if (lh3UserContentMatch) {
    return `https://drive.google.com/uc?export=view&id=${lh3UserContentMatch[1]}`;
  }

  try {
    const urlObj = new URL(url);
    urlObj.searchParams.delete('auditContext');
    urlObj.searchParams.delete('usp');
    return urlObj.toString();
  } catch {
    return url;
  }
};

/**
 * Нормализует ссылки изображений:
 * - приводит ссылки загрузок /api/uploads к backend origin (важно для Telegram Mini App);
 * - преобразует Google Drive URL в формат прямого доступа;
 * - по необходимости добавляет параметры оптимизации (w/h/q/fit) для локальных загрузок.
 */
export function normalizeImageUrl(url: string, options?: NormalizeImageUrlOptions): string {
  if (!url) {
    return url;
  }

  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return trimmedUrl;
  }

  if (trimmedUrl.startsWith('data:') || trimmedUrl.startsWith('blob:')) {
    return trimmedUrl;
  }

  const normalizedUrl = trimmedUrl.includes('google.com') || trimmedUrl.includes('googleusercontent.com')
    ? normalizeGoogleDriveUrl(trimmedUrl)
    : toAbsoluteUploadUrl(trimmedUrl);

  return applyUploadOptimization(normalizedUrl, options);
}

