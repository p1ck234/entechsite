import React, { Children, isValidElement } from 'react';

export const ORG_CHART_CHILD_GAP = 20;

const connectorColor = '#94a3b8';

interface OrgConnectorStemProps {
  height?: number;
}

export const OrgConnectorStem: React.FC<OrgConnectorStemProps> = ({ height = 20 }) => (
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
    <OrgConnectorStem height={20} />
    <div
      className="relative inline-flex items-start"
      style={{ gap: ORG_CHART_CHILD_GAP }}
    >
      {childCount > 1 && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-0.5 rounded-full"
          style={{ backgroundColor: connectorColor }}
          aria-hidden
        />
      )}
      {children}
    </div>
  </div>
);

interface OrgConnectorDropProps {
  children: React.ReactNode;
  showStem?: boolean;
}

export const OrgConnectorDrop: React.FC<OrgConnectorDropProps> = ({ children, showStem = true }) => (
  <div className="flex shrink-0 flex-col items-center" data-connector-item>
    {showStem && <OrgConnectorStem height={20} />}
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
