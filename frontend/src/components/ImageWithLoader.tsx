import React, { useState, useMemo, useEffect } from 'react';
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
  const [currentSrc, setCurrentSrc] = useState<string>('');

  // Нормализуем URL для Google Drive ссылок
  const normalizedSrc = useMemo(() => normalizeImageUrl(src), [src]);
  
  // Генерируем альтернативный URL для Google Drive
  const alternativeSrc = useMemo(() => {
    if (!src || !src.includes('lh3.google.com')) return null;
    const match = src.match(/lh3\.google\.com\/[^/]+\/d\/([^=]+)/);
    if (match) {
      const fileId = match[1];
      // Альтернативный формат через googleusercontent.com
      return `https://lh3.googleusercontent.com/d/${fileId}=s0`;
    }
    return null;
  }, [src]);

  // Устанавливаем текущий источник при изменении normalizedSrc
  useEffect(() => {
    setCurrentSrc(normalizedSrc);
    setLoading(true);
    setError(false);
  }, [normalizedSrc]);

  const handleLoad = () => {
    setLoading(false);
    setError(false);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    // Если есть альтернативный URL и мы еще не пробовали его, пробуем его
    if (alternativeSrc && currentSrc === normalizedSrc && !error) {
      setCurrentSrc(alternativeSrc);
      setLoading(true);
      return;
    }
    
    // Если альтернативный URL тоже не сработал или его нет, показываем ошибку
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
          src={currentSrc || normalizedSrc}
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

