import React from 'react';
import { GripVertical, Building2 } from 'lucide-react';
import { OrgEmployee, OrgTreeNode } from '../types';
import ImageWithLoader from './ImageWithLoader';
import { formatDepartmentLabel } from '../utils/orgStructure';
import { DepartmentTheme, getDepartmentTheme } from '../utils/orgDepartmentTheme';
import OrgDepartmentBranch from './OrgDepartmentBranch';
import {
  ORG_CHART_BRANCH_COLUMN_GAP,
  ORG_CHART_BRANCH_COLUMN_WIDTH,
  ORG_CHART_COLUMN_GAP,
  ORG_CHART_COLUMN_WIDTH,
  OrgConnectorFork,
} from './OrgChartConnectors';

const AVATAR_OPTIONS = {
  width: 96,
  height: 96,
  quality: 72,
  fit: 'cover',
} as const;

export const getOrgEmployeeName = (employee: OrgEmployee): string =>
  [employee.lastName, employee.firstName, employee.middleName].filter(Boolean).join(' ');

export const employeeMatchesSearch = (employee: OrgEmployee, query: string): boolean => {
  if (!query.trim()) {
    return true;
  }

  const normalized = query.trim().toLowerCase();
  const haystack = [
    getOrgEmployeeName(employee),
    employee.position,
    employee.department,
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalized);
};

export const treeNodeHasMatch = (node: OrgTreeNode, query: string): boolean => {
  if (!query.trim()) {
    return true;
  }

  if (employeeMatchesSearch(node.employee, query)) {
    return true;
  }

  return node.children.some((child) => treeNodeHasMatch(child, query));
};

interface OrgEmployeeCardProps {
  employee: OrgEmployee;
  isSelected: boolean;
  isDimmed: boolean;
  isAdmin: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  isDropInvalid: boolean;
  directReportsCount?: number;
  isDepartmentHead?: boolean;
  isExecutiveRoot?: boolean;
  departmentTheme?: DepartmentTheme;
  onSelect: (employee: OrgEmployee) => void;
  onDragStart: (employeeId: string) => void;
  onDragEnd: () => void;
  onDragOver: (event: React.DragEvent, employeeId: string) => void;
  onDragLeave: (employeeId: string) => void;
  onDrop: (event: React.DragEvent, employeeId: string) => void;
}

export const OrgEmployeeCard: React.FC<OrgEmployeeCardProps> = ({
  employee,
  isSelected,
  isDimmed,
  isAdmin,
  isDragging,
  isDropTarget,
  isDropInvalid,
  directReportsCount = 0,
  isDepartmentHead = false,
  isExecutiveRoot = false,
  departmentTheme,
  onSelect,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}) => {
  const initials = `${employee.firstName?.charAt(0) || '?'}${employee.lastName?.charAt(0) || '?'}`;
  const departmentLabel = formatDepartmentLabel(employee.department);
  const theme = departmentTheme ?? getDepartmentTheme(employee.department);

  return (
    <div
      className={`
        relative rounded-2xl transition-all
        ${isDragging ? 'scale-95 opacity-40' : ''}
        ${isDropTarget && !isDropInvalid ? 'ring-2 ring-green-400 ring-offset-2' : ''}
        ${isDropTarget && isDropInvalid ? 'ring-2 ring-red-300 ring-offset-2' : ''}
      `}
      onDragOver={(event) => {
        if (!isAdmin) {
          return;
        }
        onDragOver(event, employee.id);
      }}
      onDragLeave={() => onDragLeave(employee.id)}
      onDrop={(event) => {
        if (!isAdmin) {
          return;
        }
        onDrop(event, employee.id);
      }}
    >
      {isAdmin && (
        <div
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/employee-id', employee.id);
            onDragStart(employee.id);
          }}
          onDragEnd={onDragEnd}
          className="absolute -left-2 top-1/2 z-10 -translate-y-1/2 cursor-grab rounded-lg bg-white p-1 text-pastel-400 shadow active:cursor-grabbing"
          title="Перетащите на карточку руководителя"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      )}

      <button
        type="button"
        onClick={() => onSelect(employee)}
        data-employee-id={employee.id}
        className={`
          w-52 rounded-2xl border border-l-[3px] bg-white px-4 py-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all
          hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(15,23,42,0.1)]
          sm:w-60
          ${departmentTheme ? theme.cardAccentClass : 'border-l-pastel-200'}
          ${isExecutiveRoot ? 'border-primary-300 ring-1 ring-primary-100' : 'border-pastel-200/90'}
          ${isSelected ? 'border-primary-500 ring-2 ring-primary-200' : ''}
          ${isDimmed ? 'opacity-35' : 'opacity-100'}
        `}
      >
        <div className="flex flex-col items-center gap-2.5">
          {isDepartmentHead && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              Руководитель отдела
            </span>
          )}
          <div
            className={`relative flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary-500 to-primary-600 shadow-md ${
              isExecutiveRoot ? 'h-16 w-16' : 'h-14 w-14'
            }`}
          >
            {employee.photo ? (
              <ImageWithLoader
                src={employee.photo}
                alt={getOrgEmployeeName(employee)}
                className={`rounded-full object-cover ${isExecutiveRoot ? 'h-16 w-16' : 'h-14 w-14'}`}
                imageOptions={AVATAR_OPTIONS}
              />
            ) : (
              <span className={`font-bold text-white ${isExecutiveRoot ? 'text-base' : 'text-sm'}`}>{initials}</span>
            )}
          </div>
          <div className="w-full text-center">
            <div className="text-sm font-semibold leading-snug text-pastel-900">
              {getOrgEmployeeName(employee)}
            </div>
            <div className="mt-0.5 text-xs leading-snug text-pastel-600">{employee.position}</div>
            <div
              className={`mx-auto mt-2 inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium ${theme.headerClass} ${theme.titleClass}`}
              title={departmentLabel}
            >
              <Building2 className="h-3 w-3 shrink-0 opacity-70" />
              <span className="truncate">{departmentLabel}</span>
            </div>
            {directReportsCount > 0 && (
              <div className="mt-2 inline-flex rounded-full bg-primary-50 px-2.5 py-0.5 text-[11px] font-semibold text-primary-700">
                {directReportsCount} в подчинении
              </div>
            )}
          </div>
        </div>
      </button>
    </div>
  );
};

interface OrgChartNodeProps {
  node: OrgTreeNode;
  searchQuery: string;
  selectedId: string | null;
  isAdmin: boolean;
  draggingId: string | null;
  dropTargetId: string | null;
  dropInvalid: boolean;
  departmentHeadId?: string | null;
  isExecutiveRoot?: boolean;
  branchChildrenByDepartment?: boolean;
  connectorColor?: string;
  departmentTheme?: DepartmentTheme;
  getDirectReportsCount?: (employeeId: string) => number;
  onSelect: (employee: OrgEmployee) => void;
  onDragStart: (employeeId: string) => void;
  onDragEnd: () => void;
  onDragOver: (event: React.DragEvent, employeeId: string) => void;
  onDragLeave: (employeeId: string) => void;
  onDrop: (event: React.DragEvent, employeeId: string) => void;
}

export const OrgChartNode: React.FC<OrgChartNodeProps> = ({
  node,
  searchQuery,
  selectedId,
  isAdmin,
  draggingId,
  dropTargetId,
  dropInvalid,
  departmentHeadId,
  isExecutiveRoot = false,
  branchChildrenByDepartment = false,
  connectorColor,
  departmentTheme,
  getDirectReportsCount,
  onSelect,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}) => {
  const hasMatch = treeNodeHasMatch(node, searchQuery);
  const visibleChildren = searchQuery.trim()
    ? node.children.filter((child) => treeNodeHasMatch(child, searchQuery))
    : node.children;

  if (searchQuery.trim() && !hasMatch) {
    return null;
  }

  const nodeTheme = departmentTheme ?? getDepartmentTheme(node.employee.department);
  const lineColor = connectorColor ?? nodeTheme.lineColor;
  const useDepartmentBranches = branchChildrenByDepartment && visibleChildren.length > 0;
  const columnWidth = useDepartmentBranches ? ORG_CHART_BRANCH_COLUMN_WIDTH : ORG_CHART_COLUMN_WIDTH;
  const columnGap = useDepartmentBranches ? ORG_CHART_BRANCH_COLUMN_GAP : ORG_CHART_COLUMN_GAP;

  const childNodeProps = {
    searchQuery,
    selectedId,
    isAdmin,
    draggingId,
    dropTargetId,
    dropInvalid,
    departmentHeadId,
    getDirectReportsCount,
    onSelect,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDragLeave,
    onDrop,
  };

  const renderChildNode = (child: OrgTreeNode, wrapInBranch: boolean) => {
    const childTheme = getDepartmentTheme(child.employee.department);
    const chartNode = (
      <OrgChartNode
        node={child}
        connectorColor={childTheme.lineColor}
        departmentTheme={wrapInBranch ? childTheme : undefined}
        {...childNodeProps}
      />
    );

    if (!wrapInBranch) {
      return chartNode;
    }

    return <OrgDepartmentBranch theme={childTheme}>{chartNode}</OrgDepartmentBranch>;
  };

  return (
    <div className="flex flex-col items-center">
      <OrgEmployeeCard
        employee={node.employee}
        isSelected={selectedId === node.employee.id}
        isDimmed={Boolean(searchQuery.trim()) && !employeeMatchesSearch(node.employee, searchQuery)}
        isAdmin={isAdmin}
        isDragging={draggingId === node.employee.id}
        isDropTarget={dropTargetId === node.employee.id}
        isDropInvalid={dropInvalid}
        directReportsCount={getDirectReportsCount?.(node.employee.id) ?? node.children.length}
        isDepartmentHead={departmentHeadId === node.employee.id}
        isExecutiveRoot={isExecutiveRoot}
        departmentTheme={departmentTheme}
        onSelect={onSelect}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      />

      {visibleChildren.length > 0 && (
        <div className="flex w-full flex-col items-center">
          <OrgConnectorFork
            columns={visibleChildren.length}
            columnWidth={columnWidth}
            gap={columnGap}
            color={lineColor}
          />
          <div
            className="flex items-start justify-center"
            style={{ gap: columnGap }}
          >
            {visibleChildren.map((child) => (
              <div
                key={child.employee.id}
                className="flex flex-col items-center"
                style={{ width: columnWidth }}
              >
                {renderChildNode(child, useDepartmentBranches)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
