import React from 'react';
import { Briefcase, ChevronDown, ChevronRight, GripVertical, Building2 } from 'lucide-react';
import { OrgEmployee, OrgTreeNode } from '../types';
import ImageWithLoader from './ImageWithLoader';
import { formatDepartmentLabel, getOrgNodeLabel, groupOrgNodesByDepartment, getDepartmentGroupKey, isOrgRoleNode } from '../utils/orgStructure';
import OrgDepartmentBranch from './OrgDepartmentBranch';
import { OrgConnectorChildren, OrgConnectorDrop, OrgConnectorSideBranch, OrgConnectorSideItem } from './OrgChartConnectors';

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
  hideDepartmentOnCard?: boolean;
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
  hideDepartmentOnCard = false,
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
        ${isDropTarget && !isDropInvalid ? 'ring-2 ring-primary-300 ring-offset-2' : ''}
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
          className="absolute -left-2 top-1/2 z-10 -translate-y-1/2 cursor-grab rounded-lg border border-slate-200 bg-white p-1 text-slate-400 shadow-sm hover:border-slate-300 active:cursor-grabbing"
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
          className="absolute -right-2 top-1/2 z-10 -translate-y-1/2 rounded-lg border border-slate-200 bg-white p-1 text-slate-500 shadow-sm hover:border-slate-300 hover:bg-slate-50"
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
          group text-left transition-all duration-200
          ${isRole
            ? 'w-[200px] rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-3 py-3 hover:border-slate-400 hover:bg-white'
            : `w-[250px] rounded-2xl border bg-white/95 px-3.5 py-3 shadow-[0_2px_10px_rgba(15,23,42,0.05)] backdrop-blur-sm hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(15,23,42,0.09)] ${
                isExecutiveRoot
                  ? 'border-primary-200/80 ring-1 ring-primary-100'
                  : 'border-slate-200/90 hover:border-slate-300'
              }`
          }
          ${isSelected ? 'border-primary-400 ring-2 ring-primary-100' : ''}
          ${isDimmed ? 'opacity-35' : 'opacity-100'}
        `}
      >
        {isRole ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <Briefcase className="h-4 w-4" />
            </div>
            <div className="text-sm font-medium leading-snug text-slate-900">{employee.position}</div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Роль</div>
            {!hideDepartmentOnCard && (
              <div className="inline-flex max-w-full items-center gap-1 text-[10px] text-slate-500">
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{departmentLabel}</span>
              </div>
            )}
            {directReportsCount > 0 && (
              <div className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                {directReportsCount} в подчинении
              </div>
            )}
          </div>
        ) : isExecutiveRoot ? (
          <div className="flex flex-col items-center gap-2.5 py-1">
            <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-md ring-2 ring-white">
              {employee.photo ? (
                <ImageWithLoader
                  src={employee.photo}
                  alt={getOrgNodeLabel(employee)}
                  className="h-14 w-14 rounded-2xl object-cover"
                  imageOptions={AVATAR_OPTIONS}
                />
              ) : (
                <span className="text-sm font-bold text-white">{initials}</span>
              )}
            </div>
            <div className="w-full text-center">
              <div className="text-base font-bold leading-snug text-slate-900">{getOrgNodeLabel(employee)}</div>
              <div className="mt-0.5 text-xs text-slate-500">{employee.position}</div>
              {!hideDepartmentOnCard && (
                <div className="mx-auto mt-2 inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] text-slate-600">
                  <Building2 className="h-3 w-3 shrink-0" />
                  <span className="truncate">{departmentLabel}</span>
                </div>
              )}
              {directReportsCount > 0 && (
                <div className="mt-2 inline-flex rounded-full bg-primary-50 px-2.5 py-0.5 text-[11px] font-medium text-primary-700">
                  {directReportsCount} в подчинении
                  {!isExpanded ? ' · свёрнуто' : ''}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 shadow-sm ring-2 ring-white">
              {employee.photo ? (
                <ImageWithLoader
                  src={employee.photo}
                  alt={getOrgNodeLabel(employee)}
                  className="h-11 w-11 rounded-xl object-cover"
                  imageOptions={AVATAR_OPTIONS}
                />
              ) : (
                <span className="text-xs font-bold text-white">{initials}</span>
              )}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              {isDepartmentHead && (
                <span className="mb-1 inline-block rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700">
                  Руководитель
                </span>
              )}
              <div className="text-sm font-semibold leading-snug text-slate-900">{getOrgNodeLabel(employee)}</div>
              <div className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-500">{employee.position}</div>
              {!hideDepartmentOnCard && (
                <div className="mt-1.5 inline-flex max-w-full items-center gap-1 text-[10px] text-slate-500">
                  <Building2 className="h-3 w-3 shrink-0" />
                  <span className="truncate">{departmentLabel}</span>
                </div>
              )}
              {directReportsCount > 0 && (
                <div className="mt-1.5 text-[11px] font-medium text-primary-600/90">
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
  hideDepartmentOnCard?: boolean;
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
  hideDepartmentOnCard = false,
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

  const childrenSameDepartment =
    visibleChildren.length > 0 &&
    visibleChildren.every(
      (child) =>
        getDepartmentGroupKey(child.employee.department) === getDepartmentGroupKey(node.employee.department)
    );

  const childrenAreFlat = visibleChildren.every((child) => child.children.length === 0);

  const useSideLayout =
    hideDepartmentOnCard && hasChildren && childrenSameDepartment && childrenAreFlat;
  const useDepartmentBranches =
    branchChildrenByDepartment && hasChildren && !useSideLayout && !hideDepartmentOnCard;
  const departmentGroups = useDepartmentBranches ? groupOrgNodesByDepartment(visibleChildren) : null;

  const childNodeProps = {
    searchQuery,
    selectedId,
    isAdmin,
    draggingId,
    dropTargetId,
    dropInvalid,
    departmentHeadId,
    branchChildrenByDepartment: useDepartmentBranches,
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

  const renderChildNode = (child: OrgTreeNode) => (
    <OrgConnectorDrop key={child.employee.id}>
      <OrgChartNode node={child} hideDepartmentOnCard={hideDepartmentOnCard} {...childNodeProps} />
    </OrgConnectorDrop>
  );

  const renderDepartmentGroup = (group: { department: string | null; nodes: OrgTreeNode[] }) => (
    <OrgDepartmentBranch key={getDepartmentGroupKey(group.department)} department={group.department}>
      {group.nodes.map((child) => (
        <OrgChartNode key={child.employee.id} node={child} hideDepartmentOnCard {...childNodeProps} />
      ))}
    </OrgDepartmentBranch>
  );

  const card = (
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
      hideDepartmentOnCard={hideDepartmentOnCard}
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
  );

  if (useSideLayout) {
    return (
      <div className="inline-flex max-w-full items-start">
        <div className="shrink-0">{card}</div>
        {hasChildren && isExpanded && (
          <OrgConnectorSideBranch>
            {visibleChildren.map((child) => (
              <OrgConnectorSideItem key={child.employee.id}>
                <OrgChartNode
                  node={child}
                  hideDepartmentOnCard
                  {...childNodeProps}
                  branchChildrenByDepartment={false}
                />
              </OrgConnectorSideItem>
            ))}
          </OrgConnectorSideBranch>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {card}

      {hasChildren && isExpanded && (
        <OrgConnectorChildren
          childCount={useDepartmentBranches ? departmentGroups!.length : visibleChildren.length}
        >
          {useDepartmentBranches
            ? departmentGroups!.map((group) => renderDepartmentGroup(group))
            : visibleChildren.map((child) => renderChildNode(child))}
        </OrgConnectorChildren>
      )}
    </div>
  );
};
