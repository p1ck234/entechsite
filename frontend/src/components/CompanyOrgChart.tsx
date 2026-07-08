import React from 'react';
import { Building2, Hand, Network, ZoomIn, ZoomOut } from 'lucide-react';
import { OrgTreeNode } from '../types';
import { OrgChartNode } from './OrgChart';
import OrgDepartmentBranch from './OrgDepartmentBranch';
import { OrgConnectorChildren, OrgConnectorStem, orgChartCanvasClassName } from './OrgChartConnectors';
import { useChartPan } from '../hooks/useChartPan';
import { groupOrgNodesByDepartment } from '../utils/orgStructure';

interface CompanyOrgChartProps {
  companyName: string;
  roots: OrgTreeNode[];
  totalEmployees: number;
  managerLinksCount: number;
  searchQuery: string;
  selectedId: string | null;
  isAdmin: boolean;
  draggingId: string | null;
  dropTargetId: string | null;
  dropTargetCompany: boolean;
  dropInvalid: boolean;
  chartScale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  expandedIds: Set<string>;
  onToggleExpand: (employeeId: string) => void;
  getDirectReportsCount: (employeeId: string) => number;
  onSelect: (employee: OrgTreeNode['employee']) => void;
  onDragStart: (employeeId: string) => void;
  onDragEnd: () => void;
  onDragOver: (event: React.DragEvent, employeeId: string) => void;
  onDragLeave: (employeeId: string) => void;
  onDrop: (event: React.DragEvent, employeeId: string) => void;
  onDragOverCompany: (event: React.DragEvent) => void;
  onDragLeaveCompany: () => void;
  onDropOnCompany: (event: React.DragEvent) => void;
}

const CompanyOrgChart: React.FC<CompanyOrgChartProps> = ({
  companyName,
  roots,
  totalEmployees,
  managerLinksCount,
  searchQuery,
  selectedId,
  isAdmin,
  draggingId,
  dropTargetId,
  dropTargetCompany,
  dropInvalid,
  chartScale,
  onZoomIn,
  onZoomOut,
  expandedIds,
  onToggleExpand,
  getDirectReportsCount,
  onSelect,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragOverCompany,
  onDragLeaveCompany,
  onDropOnCompany,
}) => {
  const initialScrollDone = React.useRef(false);
  const pan = useChartPan(Boolean(draggingId));

  const chartProps = {
    searchQuery,
    selectedId,
    isAdmin,
    draggingId,
    dropTargetId,
    dropInvalid,
    expandedIds,
    onToggleExpand,
    getDirectReportsCount,
    onSelect,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDragLeave,
    onDrop,
  };

  const singleRoot = roots.length === 1;
  const groupedRoots = groupOrgNodesByDepartment(roots);

  React.useEffect(() => {
    initialScrollDone.current = false;
  }, [roots, chartScale]);

  React.useEffect(() => {
    if (searchQuery.trim() || initialScrollDone.current) {
      return;
    }

    const container = pan.containerRef.current;
    if (!container) {
      return;
    }

    requestAnimationFrame(() => {
      container.scrollLeft = Math.max(0, (container.scrollWidth - container.clientWidth) / 2);
      container.scrollTop = 0;
      initialScrollDone.current = true;
    });
  }, [roots, chartScale, searchQuery, pan.containerRef]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-3 py-1.5 text-xs text-slate-500">
          <Hand className="h-3.5 w-3.5" />
          Зажмите ЛКМ на фоне и перетаскивайте
        </span>
        <div className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white p-1 text-xs text-slate-600 shadow-sm">
          <button
            type="button"
            onClick={onZoomOut}
            className="rounded-full p-1.5 hover:bg-slate-100"
            aria-label="Уменьшить"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[3rem] text-center font-medium">{Math.round(chartScale * 100)}%</span>
          <button
            type="button"
            onClick={onZoomIn}
            className="rounded-full p-1.5 hover:bg-slate-100"
            aria-label="Увеличить"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className={`min-h-[28rem] ${orgChartCanvasClassName}`}>
        <div
          ref={pan.containerRef}
          onMouseDown={pan.onMouseDown}
          className={`max-h-[calc(100vh-15rem)] overflow-auto p-4 ${pan.className}`}
        >
          <div className="box-border w-max min-w-full py-2" style={{ zoom: chartScale }}>
            <div className="mx-auto flex w-max flex-col items-center">
              <div
                className={`w-full min-w-[280px] max-w-sm rounded-2xl border bg-gradient-to-b from-white to-primary-50/20 px-6 py-5 text-center shadow-[0_8px_30px_rgba(15,23,42,0.08)] transition-all ${
                  dropTargetCompany
                    ? 'border-primary-400 ring-2 ring-primary-100'
                    : 'border-primary-200/60'
                } ${isAdmin && draggingId ? 'cursor-copy' : ''}`}
                onDragOver={(event) => {
                  if (!isAdmin) {
                    return;
                  }
                  onDragOverCompany(event);
                }}
                onDragLeave={() => {
                  if (!isAdmin) {
                    return;
                  }
                  onDragLeaveCompany();
                }}
                onDrop={(event) => {
                  if (!isAdmin) {
                    return;
                  }
                  onDropOnCompany(event);
                }}
              >
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-500 text-white shadow-md">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-600/80">
                  Компания
                </div>
                <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{companyName}</div>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs text-slate-600 shadow-sm">
                    <Network className="h-3.5 w-3.5 text-primary-500" />
                    {totalEmployees} сотрудников
                  </span>
                  <span className="rounded-full bg-white/90 px-3 py-1 text-xs text-slate-600 shadow-sm">
                    {managerLinksCount} связей
                  </span>
                </div>
                {isAdmin && draggingId && (
                  <div className="mt-3 rounded-xl border border-primary-200 bg-primary-50/80 px-3 py-2 text-[11px] text-primary-800">
                    Отпустите здесь — прикрепить к компании
                  </div>
                )}
              </div>

              {roots.length > 0 && <OrgConnectorStem height={32} />}

              {singleRoot ? (
                <OrgChartNode
                  node={roots[0]}
                  isExecutiveRoot
                  branchChildrenByDepartment
                  {...chartProps}
                />
              ) : (
                <OrgConnectorChildren childCount={groupedRoots.length}>
                  {groupedRoots.map((group) => (
                    <OrgDepartmentBranch key={group.department || '__none__'} department={group.department}>
                      {group.nodes.map((root) => (
                        <OrgChartNode key={root.employee.id} node={root} hideDepartmentOnCard {...chartProps} />
                      ))}
                    </OrgDepartmentBranch>
                  ))}
                </OrgConnectorChildren>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyOrgChart;
