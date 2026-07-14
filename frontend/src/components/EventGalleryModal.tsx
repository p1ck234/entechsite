import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, ImageOff, X } from 'lucide-react';
import { eventsAPI } from '../api/client';
import type { Event, EventPhoto } from '../types';
import ImageWithLoader from './ImageWithLoader';
import VideoThumbnailTile from './VideoThumbnailTile';
import {
  fetchDriveImageBlobUrl,
  getDriveMediaStreamUrl,
  isEventVideo,
  revokeDriveImageBlobUrl,
} from '../utils/driveImageLoader';
import { isDriveImageRef } from '../utils/imageUtils';

interface EventGalleryModalProps {
  event: Event;
  onClose: () => void;
}

const GALLERY_IMAGE_OPTIONS = {
  width: 1200,
  height: 1200,
  quality: 82,
  fit: 'inside',
} as const;

const GALLERY_THUMB_OPTIONS = {
  width: 480,
  height: 480,
  quality: 72,
  fit: 'cover',
} as const;

const formatMediaCount = (items: EventPhoto[]): string => {
  const imageCount = items.filter((item) => !isEventVideo(item)).length;
  const videoCount = items.filter((item) => isEventVideo(item)).length;

  if (imageCount > 0 && videoCount > 0) {
    return `${imageCount} фото, ${videoCount} видео`;
  }

  if (videoCount > 0) {
    return `${videoCount} видео`;
  }

  return `${imageCount} фото`;
};

const GalleryMediaTile: React.FC<{ item: EventPhoto }> = ({ item }) => {
  if (isEventVideo(item)) {
    return <VideoThumbnailTile refValue={item.ref} name={item.name} />;
  }

  return (
    <ImageWithLoader
      src={item.ref}
      alt={item.name}
      className="w-full h-full object-cover"
      imageOptions={GALLERY_THUMB_OPTIONS}
    />
  );
};

const LightboxMedia: React.FC<{ item: EventPhoto }> = ({ item }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isEventVideo(item)) {
      setBlobUrl(null);
      setError(false);
      return;
    }

    if (!isDriveImageRef(item.ref)) {
      setBlobUrl(item.ref);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;

    fetchDriveImageBlobUrl(item.ref, GALLERY_IMAGE_OPTIONS)
      .then((url) => {
        if (!active) {
          revokeDriveImageBlobUrl(url);
          return;
        }
        objectUrl = url;
        setBlobUrl(url);
      })
      .catch(() => {
        if (active) {
          setError(true);
        }
      });

    return () => {
      active = false;
      if (objectUrl) {
        revokeDriveImageBlobUrl(objectUrl);
      }
    };
  }, [item]);

  if (isEventVideo(item)) {
    const streamUrl = getDriveMediaStreamUrl(item.ref);

    if (!streamUrl) {
      return <ImageOff className="w-16 h-16 text-white/60" />;
    }

    return (
      <video
        key={streamUrl}
        src={streamUrl}
        controls
        autoPlay
        playsInline
        preload="metadata"
        className="max-w-full max-h-[80vh] rounded-lg bg-black"
      >
        Ваш браузер не поддерживает воспроизведение видео.
      </video>
    );
  }

  if (error || !blobUrl) {
    return <ImageOff className="w-16 h-16 text-white/60" />;
  }

  return (
    <img
      src={blobUrl}
      alt={item.name}
      className="max-w-full max-h-[80vh] object-contain rounded-lg"
    />
  );
};

const EventGalleryModal: React.FC<EventGalleryModalProps> = ({ event, onClose }) => {
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPhotos = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await eventsAPI.getEventPhotos(event.id);
        if (!isMounted) {
          return;
        }
        setPhotos(response.photos);
      } catch (loadError: any) {
        if (!isMounted) {
          return;
        }
        setError(loadError.response?.data?.message || loadError.message || 'Не удалось загрузить медиафайлы');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadPhotos();

    return () => {
      isMounted = false;
    };
  }, [event.id]);

  useEffect(() => {
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Escape') {
        if (activeIndex !== null) {
          setActiveIndex(null);
          return;
        }
        onClose();
      }

      if (activeIndex === null || photos.length === 0) {
        return;
      }

      if (keyboardEvent.key === 'ArrowRight') {
        setActiveIndex((current) => (current === null ? 0 : (current + 1) % photos.length));
      }

      if (keyboardEvent.key === 'ArrowLeft') {
        setActiveIndex((current) =>
          current === null ? 0 : (current - 1 + photos.length) % photos.length
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, onClose, photos.length]);

  const activePhoto = activeIndex !== null ? photos[activeIndex] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-pastel-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-pastel-800 truncate">{event.title}</h2>
            <p className="text-sm text-pastel-500 mt-1">
              {loading ? 'Загрузка...' : formatMediaCount(photos)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-pastel-500 hover:text-pastel-800 hover:bg-pastel-100 transition-colors"
            aria-label="Закрыть галерею"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-10">
              <ImageOff className="w-10 h-10 text-pastel-400 mx-auto mb-3" />
              <p className="text-pastel-700">{error}</p>
            </div>
          ) : photos.length === 0 ? (
            <div className="text-center py-10">
              <ImageOff className="w-10 h-10 text-pastel-400 mx-auto mb-3" />
              <p className="text-pastel-700">В этой папке пока нет фото и видео</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {photos.map((photo, index) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className="relative aspect-square overflow-hidden rounded-xl bg-pastel-100 hover:ring-2 hover:ring-primary-400 transition-all"
                >
                  <GalleryMediaTile item={photo} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-pastel-200 px-5 py-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <a
            href={event.googleDriveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 text-sm text-pastel-600 hover:text-primary-600 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Открыть папку в Google Drive</span>
          </a>
          <button type="button" onClick={onClose} className="btn-secondary sm:min-w-[140px]">
            Закрыть
          </button>
        </div>
      </div>

      {activePhoto && activeIndex !== null && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setActiveIndex(null)}
        >
          <button
            type="button"
            onClick={(clickEvent) => {
              clickEvent.stopPropagation();
              setActiveIndex(null);
            }}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Закрыть просмотр"
          >
            <X className="w-6 h-6" />
          </button>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(clickEvent) => {
                  clickEvent.stopPropagation();
                  setActiveIndex((current) =>
                    current === null ? 0 : (current - 1 + photos.length) % photos.length
                  );
                }}
                className="absolute left-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                aria-label="Предыдущий файл"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={(clickEvent) => {
                  clickEvent.stopPropagation();
                  setActiveIndex((current) =>
                    current === null ? 0 : (current + 1) % photos.length
                  );
                }}
                className="absolute right-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                aria-label="Следующий файл"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          <div
            className="max-w-[90vw] max-h-[85vh] flex flex-col items-center"
            onClick={(clickEvent) => clickEvent.stopPropagation()}
          >
            <LightboxMedia item={activePhoto} />
            <p className="mt-3 text-sm text-white/80 text-center">
              {activeIndex + 1} / {photos.length}
              <span className="block text-white/60 mt-1">{activePhoto.name}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventGalleryModal;
