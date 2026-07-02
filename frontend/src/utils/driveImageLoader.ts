import api from '../api/client';
import { NormalizeImageUrlOptions, parseDriveImageRef } from './imageUtils';

const blobCache = new Map<string, string>();
const inflightCache = new Map<string, Promise<string>>();

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

const buildDriveContentPath = (fileId: string, options?: NormalizeImageUrlOptions): string => {
  const params = new URLSearchParams();

  if (options?.width) {
    params.set('w', String(Math.round(options.width)));
  }
  if (options?.height) {
    params.set('h', String(Math.round(options.height)));
  }
  if (options?.quality) {
    params.set('q', String(Math.round(options.quality)));
  }
  if (options?.fit) {
    params.set('fit', options.fit);
  }

  const query = params.toString();
  return `/drive/files/${encodeURIComponent(fileId)}/content${query ? `?${query}` : ''}`;
};

export const fetchDriveImageBlobUrl = async (
  ref: string,
  options?: NormalizeImageUrlOptions
): Promise<string> => {
  const fileId = parseDriveImageRef(ref);
  if (!fileId) {
    throw new Error('Некорректная ссылка на файл Google Drive');
  }

  const cacheKey = `${fileId}|${serializeOptions(options)}`;
  const cached = blobCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const inflight = inflightCache.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const task = (async () => {
    const response = await api.get(buildDriveContentPath(fileId, options), {
      responseType: 'blob',
    });

    const blob = response.data as Blob;
    if (!(blob instanceof Blob) || blob.size === 0) {
      throw new Error('Пустой ответ при загрузке изображения');
    }

    const objectUrl = URL.createObjectURL(blob);
    blobCache.set(cacheKey, objectUrl);
    return objectUrl;
  })();

  inflightCache.set(cacheKey, task);

  try {
    return await task;
  } finally {
    inflightCache.delete(cacheKey);
  }
};

export const revokeDriveImageBlobUrl = (objectUrl: string): void => {
  if (!objectUrl.startsWith('blob:')) {
    return;
  }

  URL.revokeObjectURL(objectUrl);

  for (const [key, value] of blobCache.entries()) {
    if (value === objectUrl) {
      blobCache.delete(key);
    }
  }
};

export const isVideoMimeType = (mimeType?: string): boolean => {
  return Boolean(mimeType?.startsWith('video/'));
};

export const fetchDriveFileBlobUrl = async (ref: string): Promise<string> => {
  return fetchDriveImageBlobUrl(ref);
};

export const isPdfMimeType = (mimeType?: string): boolean => mimeType === 'application/pdf';

export const isAudioMimeType = (mimeType?: string): boolean => Boolean(mimeType?.startsWith('audio/'));

export const isLessonVideo = (item: { mediaType?: string; mimeType?: string }): boolean => {
  return item.mediaType === 'video' || isVideoMimeType(item.mimeType);
};

export const isLessonPdf = (item: { mediaType?: string; mimeType?: string }): boolean => {
  return item.mediaType === 'pdf' || isPdfMimeType(item.mimeType);
};

export const isLessonAudio = (item: { mediaType?: string; mimeType?: string }): boolean => {
  return item.mediaType === 'audio' || isAudioMimeType(item.mimeType);
};

export const isEventVideo = (item: { mediaType?: string; mimeType?: string }): boolean => {
  if (item.mediaType === 'video') {
    return true;
  }

  return isVideoMimeType(item.mimeType);
};

export const getDriveMediaStreamUrl = (ref: string): string => {
  const fileId = parseDriveImageRef(ref);
  if (!fileId || typeof window === 'undefined') {
    return '';
  }

  const token = localStorage.getItem('token');
  const path = `/api/drive/files/${encodeURIComponent(fileId)}/content`;
  const query = token ? `?access_token=${encodeURIComponent(token)}` : '';

  return `${window.location.origin}${path}${query}`;
};
