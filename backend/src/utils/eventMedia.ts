import type { DriveFileItem } from '../services/googleDrive';
import { getDriveMediaKind, toDriveImageRef } from '../services/googleDrive';

export interface StoredEventPhoto {
  id: string;
  name: string;
  mimeType: string;
  ref: string;
  mediaType: string;
}

export const mapDriveItemsToEventPhotos = (items: DriveFileItem[]): StoredEventPhoto[] => {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    mimeType: item.mimeType || '',
    ref: toDriveImageRef(item.id),
    mediaType: getDriveMediaKind(item.mimeType) || 'image',
  }));
};

export const extractPreviewImageRefs = (photos: StoredEventPhoto[]): string[] => {
  return photos
    .filter((photo) => photo.mediaType === 'image')
    .slice(0, 4)
    .map((photo) => photo.ref);
};

export const parseStoredEventPhotos = (value: unknown): StoredEventPhoto[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const photo = item as Partial<StoredEventPhoto>;
      if (!photo.id || !photo.ref || !photo.name) {
        return null;
      }

      return {
        id: String(photo.id),
        name: String(photo.name),
        mimeType: String(photo.mimeType || ''),
        ref: String(photo.ref),
        mediaType: String(photo.mediaType || 'image'),
      };
    })
    .filter((item): item is StoredEventPhoto => item !== null);
};

export const areEventPhotosEqual = (
  left: StoredEventPhoto[] | unknown,
  right: StoredEventPhoto[]
): boolean => {
  const normalizedLeft = parseStoredEventPhotos(left);
  if (normalizedLeft.length !== right.length) {
    return false;
  }

  return normalizedLeft.every((photo, index) => {
    const other = right[index];
    return (
      photo.id === other.id &&
      photo.ref === other.ref &&
      photo.name === other.name &&
      photo.mimeType === other.mimeType &&
      photo.mediaType === other.mediaType
    );
  });
};
