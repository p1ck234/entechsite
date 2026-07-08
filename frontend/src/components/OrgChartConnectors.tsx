import React, { Children, isValidElement, useLayoutEffect, useRef, useState } from 'react';

export const ORG_CHART_CHILD_GAP = 20;

const connectorColor = '#94a3b8';

interface OrgConnectorStemProps {
  height?: number;
}

export const OrgConnectorStem: React.FC<OrgConnectorStemProps> = ({ height = 28 }) => (
  <div
    className="w-0.5 shrink-0 rounded-full"
    style={{ height, backgroundColor: connectorColor }}
    aria-hidden
  />
);

interface OrgConnectorChildrenProps {
  childCount: number;
  children: React.ReactNode;
}

export const OrgConnectorChildren: React.FC<OrgConnectorChildrenProps> = ({ childCount, children }) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [line, setLine] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row || childCount <= 1) {
      setLine(null);
      return;
    }

    const measure = () => {
      const items = row.querySelectorAll<HTMLElement>('[data-connector-item]');
      if (items.length < 2) {
        setLine(null);
        return;
      }

      const rowRect = row.getBoundingClientRect();
      const firstRect = items[0].getBoundingClientRect();
      const lastRect = items[items.length - 1].getBoundingClientRect();
      const left = firstRect.left + firstRect.width / 2 - rowRect.left;
      const right = lastRect.left + lastRect.width / 2 - rowRect.left;

      setLine({ left, width: Math.max(0, right - left) });
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(row);
    for (const item of row.querySelectorAll('[data-connector-item]')) {
      observer.observe(item);
    }

    return () => observer.disconnect();
  }, [childCount, children]);

  return (
    <div className="flex flex-col items-center">
      <OrgConnectorStem height={24} />
      <div
        ref={rowRef}
        className="relative inline-flex items-start justify-center pt-6"
        style={{ gap: ORG_CHART_CHILD_GAP }}
      >
        {line && line.width > 0 && (
          <div
            className="pointer-events-none absolute top-6 h-0.5 rounded-full"
            style={{ left: line.left, width: line.width, backgroundColor: connectorColor }}
            aria-hidden
          />
        )}
        {children}
      </div>
    </div>
  );
};

interface OrgConnectorDropProps {
  children: React.ReactNode;
}

export const OrgConnectorDrop: React.FC<OrgConnectorDropProps> = ({ children }) => (
  <div className="flex shrink-0 flex-col items-center" data-connector-item>
    <OrgConnectorStem height={24} />
    {children}
  </div>
);

interface OrgConnectorVerticalStackProps {
  children: React.ReactNode;
}

export const OrgConnectorVerticalStack: React.FC<OrgConnectorVerticalStackProps> = ({ children }) => (
  <div
    className="relative ml-1 mt-2 border-l-2 pl-2"
    style={{ borderColor: connectorColor }}
  >
    {Children.map(children, (child) =>
      isValidElement(child) ? (
        <div key={child.key} className="mb-3 block w-full shrink-0 last:mb-0">
          {child}
        </div>
      ) : null
    )}
  </div>
);

export const orgChartCanvasClassName =
  'rounded-2xl border border-slate-200 bg-white';
