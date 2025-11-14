import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ size = 'md', showText = true, className = '' }) => {
  const sizeClasses = {
    sm: { width: 'w-24', height: 'h-8', scale: 0.3 },
    md: { width: 'w-40', height: 'h-14', scale: 0.5 },
    lg: { width: 'w-60', height: 'h-20', scale: 0.75 },
  };

  const currentSize = sizeClasses[size];

  return (
    <div className={`flex items-center ${className}`}>
      <svg
        className={currentSize.width}
        viewBox="0 0 1200 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ height: 'auto' }}
      >
        <defs>
          <style>
            {`
              .logo-fill { fill: #811c1d; }
              .logo-text {
                fill: #811c1d;
                font-family: "Montserrat", "SF Pro Display", Arial, sans-serif;
                font-weight: 600;
                letter-spacing: 0.35em;
              }
              .logo-text-small {
                fill: #811c1d;
                font-family: "Montserrat", "SF Pro Display", Arial, sans-serif;
                font-weight: 600;
                letter-spacing: 0.30em;
              }
            `}
          </style>
        </defs>
        
        {/* Логотип EG слева */}
        <g transform="translate(80,80)" className="logo-fill">
          {/* Верхний угол */}
          <polygon points="0,55 28,0 188,0 60,32" />
          {/* Нижний угол */}
          <polygon points="210,190 182,245 22,245 150,213" />
          {/* Буквы E и G */}
          <text
            x="70"
            y="135"
            fontFamily="Montserrat, Arial, sans-serif"
            fontWeight="700"
            fontSize="110"
            fill="#811c1d"
          >
            EG
          </text>
        </g>
        
        {/* Текст ENTECH GROUP справа */}
        {showText && (
          <g transform="translate(430,120)">
            <text className="logo-text" fontSize="80" y="0">
              ENTECH
            </text>
            <text className="logo-text-small" fontSize="80" y="110">
              GROUP
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};

export default Logo;

