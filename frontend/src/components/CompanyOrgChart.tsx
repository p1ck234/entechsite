import React from 'react';
import { Building2, Network } from 'lucide-react';
import { OrgTreeNode } from '../types';
import { OrgChartNode } from './OrgChart';
import { formatDepartmentLabel } from '../utils/orgStructure';
import { OrgMultiRootBus, OrgVerticalLine } from './OrgChartConnectors';

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

  const singleRoot = roots.length === 1;

  return (
    <div className="overflow-x-auto pb-4">
      <div className="mx-auto flex min-w-max flex-col items-center px-4 py-6">
        <div className="relative flex w-full flex-col items-center">
          {/* Корень дерева — компания */}
          <div
            className={`relative z-10 w-full max-w-md rounded-3xl border bg-gradient-to-br from-white via-primary-50/40 to-pastel-50 px-8 py-5 text-center shadow-[0_12px_40px_rgba(15,23,42,0.08)] transition-all ${
              dropTargetCompany
                ? 'border-green-400 ring-4 ring-green-100'
                : 'border-primary-200/80'
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
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-500 text-white shadow-md">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-600">Компания</div>
            <div className="mt-1 text-2xl font-bold tracking-tight text-pastel-900">{companyName}</div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-pastel-600">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 shadow-sm">
                <Network className="h-3.5 w-3.5 text-primary-500" />
                {totalEmployees} сотрудников
              </span>
              <span className="rounded-full bg-white/80 px-3 py-1 shadow-sm">
                {managerLinksCount} связей
              </span>
            </div>
            {isAdmin && draggingId && (
              <div className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-[11px] font-medium text-green-800">
                Отпустите здесь — прикрепить к компании
              </div>
            )}
          </div>

          {roots.length > 0 && (
            <div className="flex flex-col items-center">
              <OrgVerticalLine heightClass={singleRoot ? 'h-10' : 'h-8'} />
              {!singleRoot && <OrgMultiRootBus columns={roots.length} />}
            </div>
          )}

          {/* Уровень под компанией */}
          <div
            className={`flex items-start justify-center gap-8 ${singleRoot ? 'flex-col items-center' : 'flex-wrap'}`}
          >
            {roots.map((root) => (
              <div key={root.employee.id} className="flex flex-col items-center">
                {!singleRoot && (
                  <>
                    <div className="mb-2 rounded-full border border-pastel-200 bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-pastel-600 shadow-sm">
                      {formatDepartmentLabel(root.employee.department)}
                    </div>
                    <OrgVerticalLine heightClass="h-4" />
                  </>
                )}
                <OrgChartNode
                  node={root}
                  isExecutiveRoot={singleRoot}
                  {...chartProps}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyOrgChart;
