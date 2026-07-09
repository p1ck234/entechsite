import React, { Children, isValidElement } from 'react';

export const ORG_CHART_CHILD_GAP = 20;

const connectorColor = '#94a3b8';

/** Центр компактной карточки (аватар h-11 + py-2.5) для горизонтальной черты */
const COMPACT_CARD_MID = '1.375rem';

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
}) => {
  const gapBridge = ORG_CHART_CHILD_GAP / 2;
  const isFirst = index === 0;
  const isLast = index === total - 1;

  return (
    <div className="relative flex shrink-0 flex-col items-center" data-connector-item>
      {total > 1 && (
        <div
          className="pointer-events-none absolute top-0 h-0.5 rounded-full"
          style={{
            left: isFirst ? '50%' : -gapBridge,
            right: isLast ? '50%' : -gapBridge,
            backgroundColor: connectorColor,
          }}
          aria-hidden
        />
      )}
      {showStem && <OrgConnectorStem height={20} />}
      {children}
    </div>
  );
};

interface OrgConnectorVerticalStackProps {
  children: React.ReactNode;
}

export const OrgConnectorVerticalStack: React.FC<OrgConnectorVerticalStackProps> = ({ children }) => {
  const items = Children.toArray(children).filter(isValidElement);
  const count = items.length;

  return (
    <div className="relative ml-2">
      <div
        className="pointer-events-none absolute left-[7px] top-0 h-3 w-0.5 -translate-y-full rounded-full"
        style={{ backgroundColor: connectorColor }}
        aria-hidden
      />

      <div className="flex flex-col">
        {items.map((child, index) => (
            <div key={child.key} className="flex min-h-0 items-stretch">
              <div className="relative w-4 shrink-0 self-stretch">
                <div
                  className="pointer-events-none absolute bottom-0 left-1/2 top-0 w-0.5 -translate-x-1/2 rounded-full"
                  style={{ backgroundColor: connectorColor }}
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute left-1/2 top-0 h-0.5 w-1/2 -translate-y-1/2 rounded-full"
                  style={{ top: COMPACT_CARD_MID, backgroundColor: connectorColor }}
                  aria-hidden
                />
              </div>

              <div className={`min-w-0 flex-1 ${index < count - 1 ? 'pb-3' : ''}`}>{child}</div>
            </div>
          ))}
      </div>
    </div>
  );
};

export const orgChartCanvasClassName =
  'rounded-2xl border border-slate-200 bg-white';
