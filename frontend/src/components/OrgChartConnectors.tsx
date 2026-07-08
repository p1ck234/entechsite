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
  children: React.ReactNode;
}

export const OrgConnectorChildren: React.FC<OrgConnectorChildrenProps> = ({ children }) => (
  <div className="flex flex-col items-center">
    <OrgConnectorStem height={20} />
    <div className="inline-flex items-start" style={{ gap: ORG_CHART_CHILD_GAP }}>
      {children}
    </div>
  </div>
);

interface OrgConnectorBranchSlotProps {
  index: number;
  total: number;
  showStem?: boolean;
  children: React.ReactNode;
}

export const OrgConnectorBranchSlot: React.FC<OrgConnectorBranchSlotProps> = ({
  index,
  total,
  showStem = true,
  children,
}) => (
  <div className="relative flex shrink-0 flex-col items-center" data-connector-item>
    {total > 1 && (
      <div
        className="pointer-events-none absolute top-0 h-0.5 rounded-full"
        style={{
          left: index === 0 ? '50%' : 0,
          right: index === total - 1 ? '50%' : 0,
          backgroundColor: connectorColor,
        }}
        aria-hidden
      />
    )}
    {showStem && <OrgConnectorStem height={20} />}
    {children}
  </div>
);

interface OrgConnectorVerticalStackProps {
  depth?: number;
  children: React.ReactNode;
}

export const OrgConnectorVerticalStack: React.FC<OrgConnectorVerticalStackProps> = ({
  depth = 0,
  children,
}) => {
  const isNested = depth > 0;

  return (
    <div
      className={`relative mt-2 ${isNested ? 'ml-3' : 'ml-1 border-l-2 pl-2'}`}
      style={isNested ? undefined : { borderColor: connectorColor }}
    >
      {Children.map(children, (child) =>
        isValidElement(child) ? (
          <div key={child.key} className="relative mb-3 block w-full shrink-0 last:mb-0">
            {!isNested && (
              <div
                className="absolute -left-2 top-[1.35rem] h-0.5 w-2 rounded-full"
                style={{ backgroundColor: connectorColor }}
                aria-hidden
              />
            )}
            {isNested && (
              <div
                className="absolute -left-3 top-[1.35rem] h-0.5 w-3 rounded-full"
                style={{ backgroundColor: connectorColor }}
                aria-hidden
              />
            )}
            {child}
          </div>
        ) : null
      )}
    </div>
  );
};

export const orgChartCanvasClassName =
  'rounded-2xl border border-slate-200 bg-white';
