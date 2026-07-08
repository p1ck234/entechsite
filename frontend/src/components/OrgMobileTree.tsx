import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { OrgEmployee, OrgTreeNode } from '../types';
import { countDirectReports, formatDepartmentLabel } from '../utils/orgStructure';
import { employeeMatchesSearch, getOrgEmployeeName, treeNodeHasMatch } from './OrgChart';
import ImageWithLoader from './ImageWithLoader';

const AVATAR_OPTIONS = {
  width: 64,
  height: 64,
  quality: 70,
  fit: 'cover',
} as const;

const collectExpandedIdsForSearch = (nodes: OrgTreeNode[], query: string): Set<string> => {
  const ids = new Set<string>();

  const walk = (node: OrgTreeNode, ancestors: string[]): boolean => {
    const selfMatch = employeeMatchesSearch(node.employee, query);
    let childMatch = false;

    for (const child of node.children) {
      if (walk(child, [...ancestors, node.employee.id])) {
        childMatch = true;
      }
    }

    if (selfMatch || childMatch) {
      ancestors.forEach((ancestorId) => ids.add(ancestorId));
      if (childMatch) {
        ids.add(node.employee.id);
      }
      return true;
    }

    return false;
  };

  nodes.forEach((node) => walk(node, []));
  return ids;
};

interface OrgMobileTreeProps {
  roots: OrgTreeNode[];
  searchQuery: string;
  selectedId: string | null;
  onSelect: (employee: OrgEmployee) => void;
}

interface OrgMobileTreeNodeProps {
  node: OrgTreeNode;
  depth: number;
  searchQuery: string;
  selectedId: string | null;
  expandedIds: Set<string>;
  onToggle: (employeeId: string) => void;
  onSelect: (employee: OrgEmployee) => void;
}

const OrgMobileTreeNode: React.FC<OrgMobileTreeNodeProps> = ({
  node,
  depth,
  searchQuery,
  selectedId,
  expandedIds,
  onToggle,
  onSelect,
}) => {
  const { employee, children } = node;
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(employee.id);
  const isSelected = selectedId === employee.id;
  const isMatch = employeeMatchesSearch(employee, searchQuery);
  const visibleChildren = searchQuery.trim()
    ? children.filter((child) => treeNodeHasMatch(child, searchQuery))
    : children;

  if (searchQuery.trim() && !isMatch && visibleChildren.length === 0) {
    return null;
  }

  const initials = `${employee.firstName?.charAt(0) || '?'}${employee.lastName?.charAt(0) || '?'}`;

  return (
    <div>
      <div
        className="flex items-stretch gap-1"
        style={{ paddingLeft: `${depth * 14}px` }}
      >
        {depth > 0 && (
          <div className="mr-1 w-3 shrink-0 border-l border-b border-pastel-300 rounded-bl-lg self-start h-5 mt-4" />
        )}

        <div className="min-w-0 flex-1">
          <div
            className={`
              flex items-center gap-2 rounded-2xl border px-2 py-2 transition-colors
              ${isSelected ? 'border-primary-500 bg-primary-50' : 'border-pastel-200 bg-white'}
              ${searchQuery.trim() && !isMatch ? 'opacity-50' : ''}
            `}
          >
            {hasChildren ? (
              <button
                type="button"
                onClick={() => onToggle(employee.id)}
                className="rounded-lg p-1 text-pastel-500 hover:bg-pastel-100"
                aria-label={isExpanded ? 'Свернуть' : 'Развернуть'}
              >
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ) : (
              <div className="w-6" />
            )}

            <button
              type="button"
              data-employee-id={employee.id}
              onClick={() => onSelect(employee)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-primary-500 flex items-center justify-center">
                {employee.photo ? (
                  <ImageWithLoader
                    src={employee.photo}
                    alt={getOrgEmployeeName(employee)}
                    className="h-10 w-10 rounded-full object-cover"
                    imageOptions={AVATAR_OPTIONS}
                  />
                ) : (
                  <span className="text-xs font-bold text-white">{initials}</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-pastel-900">
                  {getOrgEmployeeName(employee)}
                </div>
                <div className="truncate text-xs text-pastel-600">{employee.position}</div>
                <div className="truncate text-[11px] text-pastel-500">{formatDepartmentLabel(employee.department)}</div>
              </div>

              {hasChildren && (
                <span className="shrink-0 rounded-full bg-pastel-100 px-2 py-0.5 text-[11px] font-medium text-pastel-600">
                  {countDirectReports(node)}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="mt-1 space-y-1">
          {visibleChildren.map((child) => (
            <OrgMobileTreeNode
              key={child.employee.id}
              node={child}
              depth={depth + 1}
              searchQuery={searchQuery}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const OrgMobileTree: React.FC<OrgMobileTreeProps> = ({
  roots,
  searchQuery,
  selectedId,
  onSelect,
}) => {
  const defaultExpanded = useMemo(
    () => new Set(roots.map((root) => root.employee.id)),
    [roots]
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(defaultExpanded);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setExpandedIds(defaultExpanded);
      return;
    }

    setExpandedIds(collectExpandedIdsForSearch(roots, searchQuery));
  }, [searchQuery, roots, defaultExpanded]);

  const handleToggle = (employeeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) {
        next.delete(employeeId);
      } else {
        next.add(employeeId);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    const walk = (nodes: OrgTreeNode[]) => {
      for (const node of nodes) {
        if (node.children.length > 0) {
          allIds.add(node.employee.id);
          walk(node.children);
        }
      }
    };
    walk(roots);
    setExpandedIds(allIds);
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-sm font-medium text-pastel-700">Иерархия</div>
        <div className="flex gap-2 text-xs">
          <button type="button" onClick={expandAll} className="text-primary-600 hover:underline">
            Развернуть всё
          </button>
          <button type="button" onClick={collapseAll} className="text-pastel-500 hover:underline">
            Свернуть
          </button>
        </div>
      </div>

      <div className="space-y-1">
        {roots.map((root) => (
          <OrgMobileTreeNode
            key={root.employee.id}
            node={root}
            depth={0}
            searchQuery={searchQuery}
            selectedId={selectedId}
            expandedIds={expandedIds}
            onToggle={handleToggle}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
};

export default OrgMobileTree;
