import React from 'react';

export const ORG_CHART_CHILD_GAP = 40;

interface OrgConnectorStemProps {
  height?: number;
}

export const OrgConnectorStem: React.FC<OrgConnectorStemProps> = ({ height = 28 }) => (
  <div className="w-px shrink-0 bg-pastel-300" style={{ height }} aria-hidden />
);

interface OrgConnectorChildrenProps {
  childCount: number;
  children: React.ReactNode;
}

export const OrgConnectorChildren: React.FC<OrgConnectorChildrenProps> = ({ childCount, children }) => (
  <div className="flex flex-col items-center">
    <OrgConnectorStem height={28} />
    <div
      className="relative inline-flex items-start justify-center"
      style={{ gap: ORG_CHART_CHILD_GAP }}
    >
      {childCount > 1 && (
        <div
          className="pointer-events-none absolute top-0 h-px bg-pastel-300"
          style={{ left: 32, right: 32 }}
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
    <OrgConnectorStem height={28} />
    {children}
  </div>
);
