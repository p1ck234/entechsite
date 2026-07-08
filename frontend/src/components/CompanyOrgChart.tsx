import React from 'react';
import { OrgTreeNode } from '../types';
import { OrgChartNode } from './OrgChart';
import { formatDepartmentLabel } from '../utils/orgStructure';

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
  const chartProps = {
    searchQuery,
    selectedId,
    isAdmin,
    draggingId,
    dropTargetId,
    dropInvalid,
    getDirectReportsCount,
    onSelect,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDragLeave,
    onDrop,
  };

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max flex-col items-center py-4">
        <div
          className={`rounded-2xl border-2 bg-primary-50 px-8 py-4 text-center shadow-sm transition-all ${
            dropTargetCompany
              ? 'border-green-400 ring-2 ring-green-200'
              : 'border-primary-300'
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
          <div className="text-xs font-semibold uppercase tracking-wide text-primary-600">Компания</div>
          <div className="text-xl font-bold text-pastel-900">{companyName}</div>
          <div className="mt-1 text-xs text-pastel-600">
            {totalEmployees} сотрудников · {managerLinksCount} связей подчинения
          </div>
          {isAdmin && draggingId && (
            <div className="mt-2 text-[11px] font-medium text-green-700">
              Отпустите здесь — прикрепить к компании (верхний уровень)
            </div>
          )}
        </div>

        {roots.length > 0 && (
          <>
            <div className="my-3 h-8 w-px bg-pastel-400" />
            <div
              className="pointer-events-none mb-2 h-px bg-pastel-400"
              style={{ width: `${Math.min(roots.length * 200, 960)}px` }}
            />
          </>
        )}

        <div className="flex flex-wrap items-start justify-center gap-10">
          {roots.map((root) => (
            <div key={root.employee.id} className="flex flex-col items-center">
              <div className="mb-1 max-w-[13rem] rounded-full bg-pastel-100 px-3 py-1 text-center text-[11px] font-semibold text-pastel-700">
                {formatDepartmentLabel(root.employee.department)}
              </div>
              <div className="mb-2 h-4 w-px bg-pastel-400" />
              <OrgChartNode node={root} {...chartProps} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CompanyOrgChart;
