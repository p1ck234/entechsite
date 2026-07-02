import type { EventPhotosResponse } from '../types';

const EVENT_PHOTOS_CACHE = new Map<string, EventPhotosResponse>();
const CACHE_TTL_MS = 10 * 60 * 1000;
const cacheTimestamps = new Map<string, number>();

export const getCachedEventPhotos = (eventId: string): EventPhotosResponse | null => {
  const cachedAt = cacheTimestamps.get(eventId);
  if (!cachedAt || Date.now() - cachedAt > CACHE_TTL_MS) {
    EVENT_PHOTOS_CACHE.delete(eventId);
    cacheTimestamps.delete(eventId);
    return null;
  }

  return EVENT_PHOTOS_CACHE.get(eventId) ?? null;
};

export const rememberEventPhotos = (eventId: string, payload: EventPhotosResponse): void => {
  EVENT_PHOTOS_CACHE.set(eventId, payload);
  cacheTimestamps.set(eventId, Date.now());
};

export const clearEventPhotosCache = (eventId?: string): void => {
  if (!eventId) {
    EVENT_PHOTOS_CACHE.clear();
    cacheTimestamps.clear();
    return;
  }

  EVENT_PHOTOS_CACHE.delete(eventId);
  cacheTimestamps.delete(eventId);
};
