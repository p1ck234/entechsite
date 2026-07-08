import React, { useEffect, useRef } from 'react';
import { Building2, Network, ZoomIn, ZoomOut } from 'lucide-react';
import { OrgTreeNode } from '../types';
import { OrgChartNode } from './OrgChart';
import OrgDepartmentBranch from './OrgDepartmentBranch';
import { OrgConnectorChildren, OrgConnectorStem } from './OrgChartConnectors';

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialScrollDone = useRef(false);

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

  useEffect(() => {
    initialScrollDone.current = false;
  }, [roots, chartScale]);

  useEffect(() => {
    if (searchQuery.trim() || initialScrollDone.current) {
      return;
    }

    const container = scrollRef.current;
    if (!container) {
      return;
    }

    requestAnimationFrame(() => {
      container.scrollLeft = Math.max(0, (container.scrollWidth - container.clientWidth) / 2);
      container.scrollTop = 0;
      initialScrollDone.current = true;
    });
  }, [roots, chartScale, searchQuery]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-2 text-xs text-pastel-500">
        <button
          type="button"
          onClick={onZoomOut}
          className="inline-flex items-center gap-1 rounded-lg border border-pastel-200 px-2 py-1 hover:bg-pastel-50"
          aria-label="Уменьшить"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-[3rem] text-center">{Math.round(chartScale * 100)}%</span>
        <button
          type="button"
          onClick={onZoomIn}
          className="inline-flex items-center gap-1 rounded-lg border border-pastel-200 px-2 py-1 hover:bg-pastel-50"
          aria-label="Увеличить"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="max-h-[calc(100vh-14rem)] overflow-auto pb-6"
      >
        {/* w-max — полная ширина дерева для прокрутки; min-w-full — центрирование узкой схемы */}
        <div
          className="box-border w-max min-w-full px-4 py-4"
          style={{ zoom: chartScale }}
        >
          <div className="mx-auto flex w-max flex-col items-center">
            <div
              className={`w-full max-w-sm rounded-2xl border bg-white px-6 py-5 text-center shadow-sm transition-all ${
                dropTargetCompany
                  ? 'border-pastel-500 ring-2 ring-pastel-200'
                  : 'border-pastel-200'
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
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-pastel-800 text-white">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-pastel-500">
                Компания
              </div>
              <div className="mt-1 text-xl font-bold text-pastel-900">{companyName}</div>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs text-pastel-500">
                <span className="inline-flex items-center gap-1">
                  <Network className="h-3.5 w-3.5" />
                  {totalEmployees} сотрудников
                </span>
                <span>{managerLinksCount} связей</span>
              </div>
              {isAdmin && draggingId && (
                <div className="mt-3 rounded-lg border border-pastel-200 bg-pastel-50 px-3 py-2 text-[11px] text-pastel-600">
                  Отпустите здесь — прикрепить к компании
                </div>
              )}
            </div>

            {roots.length > 0 && <OrgConnectorStem height={36} />}

            {singleRoot ? (
              <OrgChartNode
                node={roots[0]}
                isExecutiveRoot
                branchChildrenByDepartment
                {...chartProps}
              />
            ) : (
              <OrgConnectorChildren childCount={roots.length}>
                {roots.map((root, index) => (
                  <OrgDepartmentBranch
                    key={root.employee.id}
                    department={root.employee.department}
                    showDivider={index > 0}
                  >
                    <OrgChartNode node={root} {...chartProps} />
                  </OrgDepartmentBranch>
                ))}
              </OrgConnectorChildren>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyOrgChart;
