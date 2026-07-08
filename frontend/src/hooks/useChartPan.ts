import { useCallback, useEffect, useRef, useState } from 'react';

const isPanBlockedTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return true;
  }

  return Boolean(
    target.closest('button, a, input, select, textarea, [draggable="true"], [data-no-chart-pan="true"]')
  );
};

interface PanSession {
  startX: number;
  startY: number;
  scrollLeft: number;
  scrollTop: number;
}

export const useChartPan = (disabled = false) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const panSessionRef = useRef<PanSession | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (disabled || event.button !== 0 || isPanBlockedTarget(event.target)) {
        return;
      }

      const container = containerRef.current;
      if (!container) {
        return;
      }

      panSessionRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
      };
      setIsPanning(true);
      event.preventDefault();
    },
    [disabled]
  );

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const session = panSessionRef.current;
      const container = containerRef.current;

      if (!session || !container) {
        return;
      }

      container.scrollLeft = session.scrollLeft - (event.clientX - session.startX);
      container.scrollTop = session.scrollTop - (event.clientY - session.startY);
    };

    const stopPan = () => {
      if (!panSessionRef.current) {
        return;
      }

      panSessionRef.current = null;
      setIsPanning(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopPan);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopPan);
    };
  }, []);

  return {
    containerRef,
    isPanning,
    onMouseDown: handleMouseDown,
    className: isPanning ? 'cursor-grabbing select-none' : 'cursor-grab',
  };
};
