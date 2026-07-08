import React from 'react';
import { Briefcase, ChevronDown, ChevronRight, GripVertical, Building2 } from 'lucide-react';
import { OrgEmployee, OrgTreeNode } from '../types';
import ImageWithLoader from './ImageWithLoader';
import { formatDepartmentLabel, getOrgNodeLabel, isOrgRoleNode } from '../utils/orgStructure';
import OrgDepartmentBranch from './OrgDepartmentBranch';
import { OrgConnectorChildren, OrgConnectorDrop } from './OrgChartConnectors';

const AVATAR_OPTIONS = {
  width: 96,
  height: 96,
  quality: 72,
  fit: 'cover',
} as const;

export const getOrgEmployeeName = (employee: OrgEmployee): string => getOrgNodeLabel(employee);

export const employeeMatchesSearch = (employee: OrgEmployee, query: string): boolean => {
  if (!query.trim()) {
    return true;
  }

  const normalized = query.trim().toLowerCase();
  const haystack = [
    getOrgNodeLabel(employee),
    employee.position,
    employee.department,
    isOrgRoleNode(employee) ? '' : [employee.firstName, employee.lastName, employee.middleName].join(' '),
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
  hasChildren?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: (employeeId: string) => void;
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
  hasChildren = false,
  isExpanded = true,
  onToggleExpand,
  onSelect,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}) => {
  const isRole = isOrgRoleNode(employee);
  const departmentLabel = formatDepartmentLabel(employee.department);
  const initials = `${employee.firstName?.charAt(0) || '?'}${employee.lastName?.charAt(0) || '?'}`;

  return (
    <div
      className={`
        relative rounded-2xl transition-all
        ${isDragging ? 'scale-95 opacity-40' : ''}
        ${isDropTarget && !isDropInvalid ? 'ring-2 ring-pastel-400 ring-offset-2' : ''}
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
      {isAdmin && !isRole && (
        <div
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/employee-id', employee.id);
            onDragStart(employee.id);
          }}
          onDragEnd={onDragEnd}
          className="absolute -left-2 top-1/2 z-10 -translate-y-1/2 cursor-grab rounded-lg border border-pastel-200 bg-white p-1 text-pastel-400 shadow-sm active:cursor-grabbing"
          title="Перетащите на карточку руководителя"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      )}

      {hasChildren && onToggleExpand && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleExpand(employee.id);
          }}
          className="absolute -right-2 top-1/2 z-10 -translate-y-1/2 rounded-lg border border-pastel-200 bg-white p-1 text-pastel-500 shadow-sm hover:bg-pastel-50"
          aria-label={isExpanded ? 'Свернуть ветку' : 'Развернуть ветку'}
        >
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      )}

      <button
        type="button"
        onClick={() => onSelect(employee)}
        data-employee-id={employee.id}
        className={`
          text-left transition-all
          ${isRole
            ? 'w-[180px] rounded-lg border border-dashed border-pastel-300 bg-pastel-50 px-3 py-3 hover:border-pastel-400'
            : `w-[220px] rounded-xl border bg-white px-4 py-3.5 shadow-sm hover:border-pastel-300 hover:shadow-md ${isExecutiveRoot ? 'border-pastel-400 shadow-md' : 'border-pastel-200'}`
          }
          ${isSelected ? 'border-pastel-500 ring-2 ring-pastel-200' : ''}
          ${isDimmed ? 'opacity-35' : 'opacity-100'}
        `}
      >
        {isRole ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <Briefcase className="h-4 w-4 text-pastel-500" />
            <div className="text-sm font-medium leading-snug text-pastel-900">{employee.position}</div>
            <div className="text-[10px] uppercase tracking-wide text-pastel-500">Роль</div>
            <div className="inline-flex max-w-full items-center gap-1 text-[10px] text-pastel-500">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{departmentLabel}</span>
            </div>
            {directReportsCount > 0 && (
              <div className="text-[11px] text-pastel-500">{directReportsCount} в подчинении</div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            {isDepartmentHead && (
              <span className="rounded-md bg-pastel-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-pastel-600">
                Руководитель отдела
              </span>
            )}
            <div
              className={`relative flex items-center justify-center overflow-hidden rounded-full bg-pastel-800 ${
                isExecutiveRoot ? 'h-14 w-14' : 'h-12 w-12'
              }`}
            >
              {employee.photo ? (
                <ImageWithLoader
                  src={employee.photo}
                  alt={getOrgNodeLabel(employee)}
                  className={`rounded-full object-cover ${isExecutiveRoot ? 'h-14 w-14' : 'h-12 w-12'}`}
                  imageOptions={AVATAR_OPTIONS}
                />
              ) : (
                <span className={`font-semibold text-white ${isExecutiveRoot ? 'text-sm' : 'text-xs'}`}>
                  {initials}
                </span>
              )}
            </div>
            <div className="w-full text-center">
              <div className="text-sm font-semibold leading-snug text-pastel-900">
                {getOrgNodeLabel(employee)}
              </div>
              <div className="mt-0.5 text-xs leading-snug text-pastel-500">{employee.position}</div>
              <div
                className="mx-auto mt-2 inline-flex max-w-full items-center gap-1 text-[10px] text-pastel-500"
                title={departmentLabel}
              >
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{departmentLabel}</span>
              </div>
              {directReportsCount > 0 && (
                <div className="mt-1.5 text-[11px] text-pastel-500">
                  {directReportsCount} в подчинении
                  {!isExpanded ? ' · свёрнуто' : ''}
                </div>
              )}
            </div>
          </div>
        )}
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
  expandedIds: Set<string>;
  onToggleExpand: (employeeId: string) => void;
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
  expandedIds,
  onToggleExpand,
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
  const hasChildren = visibleChildren.length > 0;
  const isExpanded = searchQuery.trim() ? true : expandedIds.has(node.employee.id);

  if (searchQuery.trim() && !hasMatch) {
    return null;
  }

  const useDepartmentBranches = branchChildrenByDepartment && hasChildren;

  const childNodeProps = {
    searchQuery,
    selectedId,
    isAdmin,
    draggingId,
    dropTargetId,
    dropInvalid,
    departmentHeadId,
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

  const renderChildNode = (child: OrgTreeNode, index: number) => {
    const chartNode = <OrgChartNode node={child} {...childNodeProps} />;

    if (!useDepartmentBranches) {
      return <OrgConnectorDrop key={child.employee.id}>{chartNode}</OrgConnectorDrop>;
    }

    return (
      <OrgDepartmentBranch
        key={child.employee.id}
        department={child.employee.department}
        showDivider={index > 0}
      >
        {chartNode}
      </OrgDepartmentBranch>
    );
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
        hasChildren={hasChildren}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
        onSelect={onSelect}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      />

      {hasChildren && isExpanded && (
        <OrgConnectorChildren childCount={visibleChildren.length}>
          {visibleChildren.map((child, index) => renderChildNode(child, index))}
        </OrgConnectorChildren>
      )}
    </div>
  );
};
