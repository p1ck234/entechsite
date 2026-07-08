import React, { useRef } from 'react';
import { Briefcase, Building2, ChevronDown, ChevronRight } from 'lucide-react';
import { OrgEmployee, OrgTreeNode } from '../types';
import ImageWithLoader from './ImageWithLoader';
import { formatDepartmentLabel, getOrgNodeLabel, groupOrgNodesByDepartment, getDepartmentGroupKey, isOrgRoleNode } from '../utils/orgStructure';
import OrgDepartmentBranch from './OrgDepartmentBranch';
import { OrgConnectorBranchSlot, OrgConnectorChildren, OrgConnectorVerticalStack } from './OrgChartConnectors';

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
  compact?: boolean;
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
  compact = false,
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
  const isDraggable = isAdmin && !isRole;
  const dragHappenedRef = useRef(false);
  const showExpand = hasChildren && Boolean(onToggleExpand);

  const cardSurfaceClass = `
    flex items-stretch overflow-hidden rounded-xl transition-all duration-200
    ${isRole
      ? 'border border-dashed border-slate-300 bg-white shadow-sm hover:border-slate-400'
      : `border bg-white shadow-sm hover:shadow-md ${
          isExecutiveRoot
            ? 'border-primary-200/80 ring-1 ring-primary-100'
            : 'border-slate-200/90 hover:border-slate-300'
        }`
    }
    ${isSelected ? 'border-primary-400 ring-2 ring-primary-100' : ''}
    ${isDimmed ? 'opacity-35' : 'opacity-100'}
    ${compact ? 'w-full' : isRole ? 'w-[240px]' : 'w-[240px]'}
  `;

  return (
    <div
      className={`
        relative shrink-0
        ${compact ? 'w-full' : ''}
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
      <div className={cardSurfaceClass}>
        <button
          type="button"
          draggable={isDraggable}
          onDragStart={(event) => {
            if (!isDraggable) {
              return;
            }
            dragHappenedRef.current = true;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/employee-id', employee.id);
            onDragStart(employee.id);
          }}
          onDragEnd={() => {
            onDragEnd();
            window.setTimeout(() => {
              dragHappenedRef.current = false;
            }, 0);
          }}
          onClick={() => {
            if (dragHappenedRef.current) {
              return;
            }
            onSelect(employee);
          }}
          data-employee-id={employee.id}
          title={isDraggable ? 'Нажмите — открыть. Перетащите на карточку руководителя.' : undefined}
          className={`min-w-0 flex-1 px-3 py-2.5 text-left ${isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
        >
        {isRole ? (
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-500">
              <Briefcase className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <span className="mb-1 inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                Роль
              </span>
              <div className="text-sm font-semibold leading-snug text-slate-900">{employee.position}</div>
              {directReportsCount > 0 && (
                <div className="mt-1.5 text-[11px] font-medium text-slate-600">
                  {directReportsCount} подч.
                  {!isExpanded && !compact ? ' · свёрнуто' : ''}
                </div>
              )}
            </div>
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
                  {directReportsCount} подч.
                  {!isExpanded && !compact ? ' · свёрнуто' : ''}
                </div>
              )}
            </div>
          </div>
        )}
        </button>

        {showExpand && (
          <button
            type="button"
            onClick={() => onToggleExpand!(employee.id)}
            className="flex shrink-0 items-center border-l border-slate-100 px-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            aria-label={isExpanded ? 'Свернуть ветку' : 'Развернуть ветку'}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        )}
      </div>
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
  treeDepth?: number;
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
  treeDepth = 0,
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

  const useDepartmentBranches =
    branchChildrenByDepartment && hasChildren && !hideDepartmentOnCard;
  const departmentGroups = useDepartmentBranches ? groupOrgNodesByDepartment(visibleChildren) : null;

  const childNodeProps = {
    searchQuery,
    selectedId,
    isAdmin,
    draggingId,
    dropTargetId,
    dropInvalid,
    departmentHeadId,
    branchChildrenByDepartment: hideDepartmentOnCard ? false : branchChildrenByDepartment,
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

  const branchCount = useDepartmentBranches ? departmentGroups!.length : visibleChildren.length;

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
      compact={hideDepartmentOnCard}
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

  if (hideDepartmentOnCard) {
    return (
      <div className="block w-full shrink-0">
        {card}
        {hasChildren && isExpanded && (
          <OrgConnectorVerticalStack>
            {visibleChildren.map((child) => (
              <OrgChartNode
                key={child.employee.id}
                node={child}
                hideDepartmentOnCard
                treeDepth={treeDepth + 1}
                {...childNodeProps}
              />
            ))}
          </OrgConnectorVerticalStack>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {card}

      {hasChildren && isExpanded && (
        <OrgConnectorChildren>
          {useDepartmentBranches
            ? departmentGroups!.map((group, index) => (
                <OrgConnectorBranchSlot
                  key={getDepartmentGroupKey(group.department)}
                  index={index}
                  total={branchCount}
                  showStem={branchCount > 1}
                >
                  <OrgDepartmentBranch department={group.department}>
                    {group.nodes.map((child) => (
                      <OrgChartNode
                        key={child.employee.id}
                        node={child}
                        hideDepartmentOnCard
                        {...childNodeProps}
                      />
                    ))}
                  </OrgDepartmentBranch>
                </OrgConnectorBranchSlot>
              ))
            : visibleChildren.map((child, index) => (
                <OrgConnectorBranchSlot
                  key={child.employee.id}
                  index={index}
                  total={branchCount}
                  showStem={branchCount > 1}
                >
                  <OrgChartNode node={child} hideDepartmentOnCard={hideDepartmentOnCard} {...childNodeProps} />
                </OrgConnectorBranchSlot>
              ))}
        </OrgConnectorChildren>
      )}
    </div>
  );
};
