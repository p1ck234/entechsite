import React, { useState, useMemo, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { getImageUrlCandidates, NormalizeImageUrlOptions } from '../utils/imageUtils';

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

  const srcCandidates = useMemo(() => {
    if (!src) {
      return [];
    }

    return getImageUrlCandidates(src, imageOptions);
  }, [src, imageOptions?.width, imageOptions?.height, imageOptions?.quality, imageOptions?.fit]);

  const currentSrc = srcCandidates[candidateIndex] || '';

  const handleLoad = () => {
    setLoading(false);
    setError(false);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (candidateIndex < srcCandidates.length - 1) {
      setCandidateIndex((prev) => prev + 1);
      setLoading(true);
      setError(false);
      return;
    }

    setLoading(false);
    setError(true);

    // Уведомляем родителя об ошибке загрузки
    if (onLoadError) {
      onLoadError();
    }
    if (onError) {
      onError(e);
    }
  };

  // Сбрасываем состояние при изменении src
  useEffect(() => {
    setCandidateIndex(0);
    setLoading(true);
    setError(false);
  }, [src, imageOptions?.width, imageOptions?.height, imageOptions?.quality, imageOptions?.fit]);

  if (!currentSrc || error) {
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
        src={currentSrc}
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

