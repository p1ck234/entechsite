import React from 'react';
import { GripVertical } from 'lucide-react';
import { OrgEmployee, OrgTreeNode } from '../types';
import ImageWithLoader from './ImageWithLoader';

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
  onSelect,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}) => {
  const initials = `${employee.firstName?.charAt(0) || '?'}${employee.lastName?.charAt(0) || '?'}`;

  return (
    <div
      className={`
        relative rounded-2xl transition-all
        ${isDragging ? 'opacity-40 scale-95' : ''}
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
          w-44 sm:w-52 rounded-2xl border bg-white px-4 py-3 text-left shadow-sm transition-all
          hover:-translate-y-0.5 hover:shadow-md
          ${isSelected ? 'border-primary-500 ring-2 ring-primary-200' : 'border-pastel-200'}
          ${isDimmed ? 'opacity-35' : 'opacity-100'}
        `}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="h-14 w-14 overflow-hidden rounded-full bg-primary-500 flex items-center justify-center">
            {employee.photo ? (
              <ImageWithLoader
                src={employee.photo}
                alt={getOrgEmployeeName(employee)}
                className="h-14 w-14 rounded-full object-cover"
                imageOptions={AVATAR_OPTIONS}
              />
            ) : (
              <span className="text-sm font-bold text-white">{initials}</span>
            )}
          </div>
          <div className="w-full text-center">
            <div className="truncate text-sm font-semibold text-pastel-900">
              {getOrgEmployeeName(employee)}
            </div>
            <div className="truncate text-xs text-pastel-600">{employee.position}</div>
            <div className="truncate text-[11px] text-pastel-500">{employee.department}</div>
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
        onSelect={onSelect}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      />

      {visibleChildren.length > 0 && (
        <div className="mt-3 flex flex-col items-center">
          <div className="h-4 w-px bg-pastel-300" />
          <div className="relative flex flex-wrap items-start justify-center gap-6 pt-4">
            {visibleChildren.length > 1 && (
              <div
                className="pointer-events-none absolute top-0 h-px bg-pastel-300"
                style={{ left: '12%', right: '12%' }}
              />
            )}
            {visibleChildren.map((child) => (
              <div key={child.employee.id} className="flex flex-col items-center">
                <div className="h-4 w-px bg-pastel-300" />
                <OrgChartNode
                  node={child}
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
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
