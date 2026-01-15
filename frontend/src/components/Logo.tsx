import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean; // Оставлен для обратной совместимости, но не используется
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: { width: 'w-32', height: 'h-8' },
    md: { width: 'w-48', height: 'h-12' },
    lg: { width: 'w-64', height: 'h-16' },
  };

  const currentSize = sizeClasses[size];

  return (
    <div className={`flex items-center ${className}`}>
      <img
        src="/group.svg"
        alt="ENTECH GROUP"
        className={`${currentSize.width} ${currentSize.height} object-contain`}
        style={{ height: 'auto' }}
      />
    </div>
  );
};

export default Logo;

