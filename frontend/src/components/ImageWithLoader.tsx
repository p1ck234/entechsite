import React, { useState, useMemo, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { normalizeImageUrl } from '../utils/imageUtils';

interface ImageWithLoaderProps {
  src: string;
  alt: string;
  className?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  onLoadError?: () => void; // Callback для уведомления родителя об ошибке
}

const ImageWithLoader: React.FC<ImageWithLoaderProps> = ({ src, alt, className = '', onError, onLoadError }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Нормализуем URL для Google Drive ссылок
  const normalizedSrc = useMemo(() => {
    if (!src) return '';
    return normalizeImageUrl(src);
  }, [src]);

  const handleLoad = () => {
    setLoading(false);
    setError(false);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
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
    setLoading(true);
    setError(false);
  }, [src]);

  if (!src || error) {
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
        src={normalizedSrc}
        alt={alt}
        className={`${className} ${loading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
      />
    </div>
  );
};

export default ImageWithLoader;

