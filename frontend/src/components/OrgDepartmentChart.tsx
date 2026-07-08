import React, { useMemo, useState } from 'react';
import { OrgDepartmentGroup } from '../types';
import { OrgChartNode, OrgEmployeeCard, getOrgEmployeeName } from './OrgChart';
import {
  countDepartmentInternalLinks,
  departmentHasHierarchy,
  getDirectReports,
  guessDepartmentHead,
  sortEmployeesBySeniority,
} from '../utils/orgStructure';

interface OrgDepartmentChartProps {
  groups: OrgDepartmentGroup[];
  searchQuery: string;
  selectedId: string | null;
  isAdmin: boolean;
  assigning: boolean;
  draggingId: string | null;
  dropTargetId: string | null;
  dropInvalid: boolean;
  expandedIds: Set<string>;
  onToggleExpand: (employeeId: string) => void;
  onSelect: (employee: OrgDepartmentGroup['employees'][number]) => void;
  onDragStart: (employeeId: string) => void;
  onDragEnd: () => void;
  onDragOver: (event: React.DragEvent, employeeId: string) => void;
  onDragLeave: (employeeId: string) => void;
  onDrop: (event: React.DragEvent, employeeId: string) => void;
  onAssignDepartmentHead: (department: string, headId: string) => Promise<void>;
}

const DepartmentSection: React.FC<{
  group: OrgDepartmentGroup;
  chartProps: Omit<OrgDepartmentChartProps, 'groups' | 'onAssignDepartmentHead'>;
  onAssignDepartmentHead: (headId: string) => Promise<void>;
}> = ({ group, chartProps, onAssignDepartmentHead }) => {
  const suggestedHead = useMemo(() => guessDepartmentHead(group.employees), [group.employees]);
  const [headDraft, setHeadDraft] = useState(suggestedHead?.id || '');
  const hasHierarchy = departmentHasHierarchy(group);
  const internalLinks = countDepartmentInternalLinks(group.employees);
  const departmentHeadId = hasHierarchy
    ? group.roots.length === 1
      ? group.roots[0].employee.id
      : suggestedHead?.id || null
    : headDraft || suggestedHead?.id || null;

  const getDirectReportsCount = (employeeId: string) =>
    getDirectReports(group.employees, employeeId).length;

  const chartNodeProps = {
    ...chartProps,
    departmentHeadId,
    getDirectReportsCount,
  };

  const sortedFlatEmployees = sortEmployeesBySeniority(group.employees);
  const headEmployee = group.employees.find((employee) => employee.id === departmentHeadId) || suggestedHead;
  const teamMembers = sortedFlatEmployees.filter((employee) => employee.id !== headEmployee?.id);

  return (
    <section className="rounded-3xl border border-pastel-200 bg-gradient-to-b from-white to-pastel-50/60 p-5">
      <div className="mb-4 flex flex-col gap-3 border-b border-pastel-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-pastel-900">{group.department}</h2>
          <p className="text-xs text-pastel-500">
            {group.employeeCount} сотрудников · {internalLinks} связей внутри отдела
          </p>
        </div>

        {chartProps.isAdmin && !hasHierarchy && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={headDraft}
              onChange={(event) => setHeadDraft(event.target.value)}
              className="input-field min-w-[220px]"
              disabled={chartProps.assigning}
            >
              <option value="">Руководитель отдела</option>
              {sortedFlatEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {getOrgEmployeeName(employee)} — {employee.position}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!headDraft || chartProps.assigning}
              onClick={() => onAssignDepartmentHead(headDraft)}
              className="btn-primary whitespace-nowrap disabled:opacity-50"
            >
              Подчинить отдел
            </button>
          </div>
        )}
      </div>

      {!hasHierarchy && chartProps.isAdmin && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Иерархия в отделе не настроена. Выберите руководителя и нажмите «Подчинить отдел» — или перетащите сотрудников на руководителя.
        </div>
      )}

      {hasHierarchy ? (
        <div className="overflow-x-auto">
          <div className="flex min-w-max justify-center gap-10 py-2">
            {group.roots.map((root) => (
              <OrgChartNode key={root.employee.id} node={root} {...chartNodeProps} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          {headEmployee && (
            <>
              <OrgEmployeeCard
                employee={headEmployee}
                isSelected={chartProps.selectedId === headEmployee.id}
                isDimmed={false}
                isAdmin={chartProps.isAdmin}
                isDragging={chartProps.draggingId === headEmployee.id}
                isDropTarget={chartProps.dropTargetId === headEmployee.id}
                isDropInvalid={chartProps.dropInvalid}
                isDepartmentHead
                directReportsCount={teamMembers.length}
                onSelect={chartProps.onSelect}
                onDragStart={chartProps.onDragStart}
                onDragEnd={chartProps.onDragEnd}
                onDragOver={chartProps.onDragOver}
                onDragLeave={chartProps.onDragLeave}
                onDrop={chartProps.onDrop}
              />
              {teamMembers.length > 0 && (
                <>
                  <div className="my-2 h-6 w-px border-l-2 border-dashed border-pastel-300" />
                  <div className="relative flex flex-wrap items-start justify-center gap-6 pt-2">
                    <div
                      className="pointer-events-none absolute top-0 h-px border-t-2 border-dashed border-pastel-300"
                      style={{ left: '8%', right: '8%' }}
                    />
                    {teamMembers.map((employee) => (
                      <div key={employee.id} className="flex flex-col items-center">
                        <div className="h-4 w-px border-l-2 border-dashed border-pastel-300" />
                        <OrgEmployeeCard
                          employee={employee}
                          isSelected={chartProps.selectedId === employee.id}
                          isDimmed={false}
                          isAdmin={chartProps.isAdmin}
                          isDragging={chartProps.draggingId === employee.id}
                          isDropTarget={chartProps.dropTargetId === employee.id}
                          isDropInvalid={chartProps.dropInvalid}
                          onSelect={chartProps.onSelect}
                          onDragStart={chartProps.onDragStart}
                          onDragEnd={chartProps.onDragEnd}
                          onDragOver={chartProps.onDragOver}
                          onDragLeave={chartProps.onDragLeave}
                          onDrop={chartProps.onDrop}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
};

const OrgDepartmentChart: React.FC<OrgDepartmentChartProps> = ({
  groups,
  onAssignDepartmentHead,
  ...chartProps
}) => {
  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <DepartmentSection
          key={group.department}
          group={group}
          chartProps={chartProps}
          onAssignDepartmentHead={(headId) => onAssignDepartmentHead(group.department, headId)}
        />
      ))}
    </div>
  );
};

export default OrgDepartmentChart;
