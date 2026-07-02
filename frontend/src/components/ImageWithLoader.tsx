import React, { useState, useMemo, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { getImageUrlCandidates, isDriveImageRef, NormalizeImageUrlOptions } from '../utils/imageUtils';
import { getCachedImageCandidate, rememberImageCandidate } from '../utils/imagePreload';
import { fetchDriveImageBlobUrl, revokeDriveImageBlobUrl } from '../utils/driveImageLoader';

const IMAGE_LOAD_TIMEOUT_MS = 7000;

interface ImageWithLoaderProps {
  src: string;
  alt: string;
  className?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  onLoadError?: () => void; // Callback для уведомления родителя об ошибке
  imageOptions?: NormalizeImageUrlOptions;
}

const ImageWithLoader: React.FC<ImageWithLoaderProps> = ({
  src,
  alt,
  className = '',
  onError,
  onLoadError,
  imageOptions
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [driveBlobUrl, setDriveBlobUrl] = useState<string | null>(null);

  const isDriveRef = useMemo(() => Boolean(src && isDriveImageRef(src)), [src]);

  const srcCandidates = useMemo(() => {
    if (!src || isDriveRef) {
      return [];
    }

    return getImageUrlCandidates(src, imageOptions);
  }, [src, isDriveRef, imageOptions?.width, imageOptions?.height, imageOptions?.quality, imageOptions?.fit]);

  const currentSrc = srcCandidates[candidateIndex] || '';
  const hasNextCandidate = candidateIndex < srcCandidates.length - 1;

  const tryMoveToNextCandidate = (): boolean => {
    if (!hasNextCandidate) {
      return false;
    }

    setCandidateIndex((prev) => prev + 1);
    setLoading(true);
    setError(false);
    return true;
  };

  const finalizeLoadFailure = (e?: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setLoading(false);
    setError(true);

    if (onLoadError) {
      onLoadError();
    }

    if (e && onError) {
      onError(e);
    }
  };

  const handleLoad = () => {
    const loadedUrl = isDriveRef ? driveBlobUrl : currentSrc;
    if (src && loadedUrl) {
      rememberImageCandidate(src, imageOptions, loadedUrl);
    }
    setLoading(false);
    setError(false);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (isDriveRef) {
      finalizeLoadFailure(e);
      return;
    }

    if (tryMoveToNextCandidate()) {
      return;
    }

    finalizeLoadFailure(e);
  };

  // Сбрасываем состояние при изменении src
  useEffect(() => {
    const cachedCandidate = src ? getCachedImageCandidate(src, imageOptions) : null;
    const initialIndex = cachedCandidate ? srcCandidates.indexOf(cachedCandidate) : 0;

    setCandidateIndex(initialIndex >= 0 ? initialIndex : 0);
    setLoading(true);
    setError(false);
    setDriveBlobUrl(null);
  }, [src, srcCandidates, imageOptions?.width, imageOptions?.height, imageOptions?.quality, imageOptions?.fit]);

  useEffect(() => {
    if (!isDriveRef || !src) {
      return;
    }

    let isActive = true;
    let objectUrl: string | null = null;

    setLoading(true);
    setError(false);
    setDriveBlobUrl(null);

    fetchDriveImageBlobUrl(src, imageOptions)
      .then((url) => {
        if (!isActive) {
          revokeDriveImageBlobUrl(url);
          return;
        }

        objectUrl = url;
        setDriveBlobUrl(url);
        rememberImageCandidate(src, imageOptions, url);
        setLoading(false);
        setError(false);
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        setLoading(false);
        setError(true);
        if (onLoadError) {
          onLoadError();
        }
      });

    return () => {
      isActive = false;
      if (objectUrl) {
        revokeDriveImageBlobUrl(objectUrl);
      }
    };
  }, [src, isDriveRef, imageOptions?.width, imageOptions?.height, imageOptions?.quality, imageOptions?.fit, onLoadError]);

  useEffect(() => {
    if (isDriveRef || !loading || !currentSrc) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (candidateIndex < srcCandidates.length - 1) {
        setCandidateIndex((prev) => prev + 1);
        setLoading(true);
        setError(false);
        return;
      }

      setLoading(false);
      setError(true);
      if (onLoadError) {
        onLoadError();
      }
    }, IMAGE_LOAD_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loading, currentSrc, candidateIndex, srcCandidates.length, onLoadError, isDriveRef]);

  const resolvedSrc = isDriveRef ? driveBlobUrl : currentSrc;

  if (!resolvedSrc || error) {
    return null; // Если ошибка или нет src, возвращаем null - родитель покажет fallback
  }

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-pastel-100">
          <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
        </div>
      )}
      <img
        key={resolvedSrc}
        src={resolvedSrc}
        alt={alt}
        className={`${className} ${loading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

export default ImageWithLoader;

