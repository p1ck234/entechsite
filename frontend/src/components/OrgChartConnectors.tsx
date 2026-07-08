import React from 'react';

export const OrgVerticalLine: React.FC<{ className?: string; heightClass?: string }> = ({
  className = '',
  heightClass = 'h-8',
}) => (
  <div
    className={`w-px shrink-0 bg-gradient-to-b from-primary-400/80 to-pastel-300/90 ${heightClass} ${className}`}
    aria-hidden
  />
);

interface OrgMultiRootBusProps {
  columns: number;
}

export const OrgMultiRootBus: React.FC<OrgMultiRootBusProps> = ({ columns }) => {
  if (columns <= 1) {
    return null;
  }

  const width = Math.min(columns * 220, 1100);

  return (
    <div className="relative flex justify-center" style={{ width, height: 28 }} aria-hidden>
      <OrgVerticalLine heightClass="h-7" className="absolute left-1/2 top-0 -translate-x-1/2" />
      <div
        className="absolute top-7 h-px bg-gradient-to-r from-transparent via-pastel-300 to-transparent"
        style={{ left: '8%', right: '8%' }}
      />
    </div>
  );
};
