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

const buildDriveThumbnailPath = (fileId: string): string =>
  `/drive/files/${encodeURIComponent(fileId)}/thumbnail`;

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

export const fetchDriveVideoThumbnailBlobUrl = async (ref: string): Promise<string> => {
  const fileId = parseDriveImageRef(ref);
  if (!fileId) {
    throw new Error('Некорректная ссылка на файл Google Drive');
  }

  const cacheKey = `${fileId}|thumbnail`;
  const cached = blobCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const inflight = inflightCache.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const task = (async () => {
    const response = await api.get(buildDriveThumbnailPath(fileId), {
      responseType: 'blob',
    });

    const blob = response.data as Blob;
    if (!(blob instanceof Blob) || blob.size === 0) {
      throw new Error('Пустой ответ при загрузке превью');
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

export const captureVideoPosterFromRef = (ref: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const streamUrl = getDriveMediaStreamUrl(ref);
    if (!streamUrl) {
      reject(new Error('Не удалось получить ссылку на видео'));
      return;
    }

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = streamUrl;

    const cleanup = () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    };

    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('Таймаут загрузки превью видео'));
    }, 15000);

    video.addEventListener('loadeddata', () => {
      const seekTime =
        Number.isFinite(video.duration) && video.duration > 0
          ? Math.min(1, video.duration * 0.1)
          : 0.5;
      video.currentTime = seekTime;
    });

    video.addEventListener('seeked', () => {
      try {
        const width = video.videoWidth || 480;
        const height = video.videoHeight || 270;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');

        if (!context || width === 0 || height === 0) {
          throw new Error('Не удалось прочитать кадр видео');
        }

        context.drawImage(video, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            window.clearTimeout(timeoutId);
            cleanup();

            if (!blob) {
              reject(new Error('Не удалось создать превью'));
              return;
            }

            resolve(URL.createObjectURL(blob));
          },
          'image/jpeg',
          0.82
        );
      } catch (error) {
        window.clearTimeout(timeoutId);
        cleanup();
        reject(error);
      }
    });

    video.addEventListener('error', () => {
      window.clearTimeout(timeoutId);
      cleanup();
      reject(new Error('Ошибка загрузки видео для превью'));
    });
  });

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
