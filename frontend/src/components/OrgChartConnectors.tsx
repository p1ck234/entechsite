import React from 'react';

export const ORG_CHART_COLUMN_WIDTH = 280;
export const ORG_CHART_COLUMN_GAP = 40;
export const ORG_CHART_BRANCH_COLUMN_WIDTH = 300;
export const ORG_CHART_BRANCH_COLUMN_GAP = 48;

const DEFAULT_STEM_HEIGHT = 28;
const DEFAULT_DROP_HEIGHT = 24;
const DEFAULT_LINE_COLOR = '#64748b';
const DEFAULT_STROKE_WIDTH = 2.5;

const getChildCenters = (columns: number, columnWidth: number, gap: number): number[] =>
  Array.from({ length: columns }, (_, index) => columnWidth / 2 + index * (columnWidth + gap));

interface OrgConnectorForkProps {
  columns: number;
  columnWidth?: number;
  gap?: number;
  stemHeight?: number;
  dropHeight?: number;
  color?: string;
}

export const OrgConnectorFork: React.FC<OrgConnectorForkProps> = ({
  columns,
  columnWidth = ORG_CHART_COLUMN_WIDTH,
  gap = ORG_CHART_COLUMN_GAP,
  stemHeight = DEFAULT_STEM_HEIGHT,
  dropHeight = DEFAULT_DROP_HEIGHT,
  color = DEFAULT_LINE_COLOR,
}) => {
  if (columns <= 0) {
    return null;
  }

  const totalWidth = columns * columnWidth + Math.max(columns - 1, 0) * gap;
  const totalHeight = stemHeight + dropHeight;
  const centerX = totalWidth / 2;
  const childCenters = getChildCenters(columns, columnWidth, gap);

  return (
    <svg
      width={totalWidth}
      height={totalHeight}
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      className="shrink-0 overflow-visible"
      aria-hidden
    >
      {columns === 1 ? (
        <line
          x1={centerX}
          y1={0}
          x2={centerX}
          y2={totalHeight}
          stroke={color}
          strokeWidth={DEFAULT_STROKE_WIDTH}
          strokeLinecap="round"
        />
      ) : (
        <>
          <line
            x1={centerX}
            y1={0}
            x2={centerX}
            y2={stemHeight}
            stroke={color}
            strokeWidth={DEFAULT_STROKE_WIDTH}
            strokeLinecap="round"
          />
          <line
            x1={childCenters[0]}
            y1={stemHeight}
            x2={childCenters[columns - 1]}
            y2={stemHeight}
            stroke={color}
            strokeWidth={DEFAULT_STROKE_WIDTH}
            strokeLinecap="round"
          />
          {childCenters.map((childCenter, index) => (
            <line
              key={index}
              x1={childCenter}
              y1={stemHeight}
              x2={childCenter}
              y2={totalHeight}
              stroke={color}
              strokeWidth={DEFAULT_STROKE_WIDTH}
              strokeLinecap="round"
            />
          ))}
        </>
      )}
    </svg>
  );
};

interface OrgConnectorStemProps {
  height?: number;
  color?: string;
}

export const OrgConnectorStem: React.FC<OrgConnectorStemProps> = ({
  height = 36,
  color = DEFAULT_LINE_COLOR,
}) => (
  <svg width={3} height={height} viewBox={`0 0 3 ${height}`} className="shrink-0 overflow-visible" aria-hidden>
    <line
      x1={1.5}
      y1={0}
      x2={1.5}
      y2={height}
      stroke={color}
      strokeWidth={DEFAULT_STROKE_WIDTH}
      strokeLinecap="round"
    />
  </svg>
);

export const getOrgChartRowWidth = (
  columns: number,
  columnWidth: number = ORG_CHART_COLUMN_WIDTH,
  gap: number = ORG_CHART_COLUMN_GAP
): number => columns * columnWidth + Math.max(columns - 1, 0) * gap;
