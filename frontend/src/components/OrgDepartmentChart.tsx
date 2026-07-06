import React from 'react';
import { OrgDepartmentGroup } from '../types';
import { OrgChartNode } from './OrgChart';

interface OrgDepartmentChartProps {
  groups: OrgDepartmentGroup[];
  searchQuery: string;
  selectedId: string | null;
  isAdmin: boolean;
  draggingId: string | null;
  dropTargetId: string | null;
  dropInvalid: boolean;
  onSelect: (employee: OrgDepartmentGroup['employees'][number]) => void;
  onDragStart: (employeeId: string) => void;
  onDragEnd: () => void;
  onDragOver: (event: React.DragEvent, employeeId: string) => void;
  onDragLeave: (employeeId: string) => void;
  onDrop: (event: React.DragEvent, employeeId: string) => void;
}

const OrgDepartmentChart: React.FC<OrgDepartmentChartProps> = ({
  groups,
  searchQuery,
  selectedId,
  isAdmin,
  draggingId,
  dropTargetId,
  dropInvalid,
  onSelect,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}) => {
  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section
          key={group.department}
          className="rounded-3xl border border-pastel-200 bg-gradient-to-b from-white to-pastel-50/60 p-5"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-pastel-200 pb-3">
            <div>
              <h2 className="text-lg font-bold text-pastel-900">{group.department}</h2>
              <p className="text-xs text-pastel-500">{group.employeeCount} сотрудников</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="flex min-w-max flex-wrap justify-center gap-8 py-2">
              {group.roots.map((root) => (
                <OrgChartNode
                  key={root.employee.id}
                  node={root}
                  searchQuery={searchQuery}
                  selectedId={selectedId}
                  isAdmin={isAdmin}
                  draggingId={draggingId}
                  dropTargetId={dropTargetId}
                  dropInvalid={dropInvalid}
                  onSelect={onSelect}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                />
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
};

export default OrgDepartmentChart;
