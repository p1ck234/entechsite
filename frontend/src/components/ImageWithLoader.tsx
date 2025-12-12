import React, { useState, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { normalizeImageUrl } from '../utils/imageUtils';

interface ImageWithLoaderProps {
  src: string;
  alt: string;
  className?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

const ImageWithLoader: React.FC<ImageWithLoaderProps> = ({ src, alt, className = '', onError }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Нормализуем URL для Google Drive ссылок
  const normalizedSrc = useMemo(() => normalizeImageUrl(src), [src]);

  const handleLoad = () => {
    setLoading(false);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setLoading(false);
    setError(true);
    if (onError) {
      onError(e);
    }
  };

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-pastel-100">
          <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
        </div>
      )}
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-pastel-100">
          <span className="text-pastel-400 text-xs">Ошибка загрузки</span>
        </div>
      ) : (
        <img
          src={normalizedSrc}
          alt={alt}
          className={`${className} ${loading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </div>
  );
};

export default ImageWithLoader;

