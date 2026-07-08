import React from 'react';

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

export const OrgConnectorChildren: React.FC<OrgConnectorChildrenProps> = ({ childCount, children }) => (
  <div className="flex flex-col items-center">
    <OrgConnectorStem height={24} />
    <div
      className="relative inline-flex items-start justify-center pt-6"
      style={{ gap: ORG_CHART_CHILD_GAP }}
    >
      {childCount > 1 && (
        <div
          className="pointer-events-none absolute top-6 h-0.5 rounded-full"
          style={{ left: 24, right: 24, backgroundColor: connectorColor }}
          aria-hidden
        />
      )}
      {children}
    </div>
  </div>
);

interface OrgConnectorDropProps {
  children: React.ReactNode;
}

export const OrgConnectorDrop: React.FC<OrgConnectorDropProps> = ({ children }) => (
  <div className="flex shrink-0 flex-col items-center">
    <OrgConnectorStem height={24} />
    {children}
  </div>
);

export const orgChartCanvasClassName =
  'rounded-2xl border border-slate-200 bg-white';
