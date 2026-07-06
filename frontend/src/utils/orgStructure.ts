import { OrgTreeNode } from '../types';

export const findNodeById = (nodes: OrgTreeNode[], employeeId: string): OrgTreeNode | null => {
  for (const node of nodes) {
    if (node.employee.id === employeeId) {
      return node;
    }

    const childMatch = findNodeById(node.children, employeeId);
    if (childMatch) {
      return childMatch;
    }
  }

  return null;
};

export const collectDescendantIds = (node: OrgTreeNode): Set<string> => {
  const ids = new Set<string>();

  const walk = (current: OrgTreeNode) => {
    for (const child of current.children) {
      ids.add(child.employee.id);
      walk(child);
    }
  };

  walk(node);
  return ids;
};

export const canAssignManager = (
  employeeId: string,
  managerId: string | null,
  roots: OrgTreeNode[]
): { valid: boolean; reason?: string } => {
  if (!managerId) {
    return { valid: true };
  }

  if (employeeId === managerId) {
    return { valid: false, reason: 'Сотрудник не может быть руководителем сам себе' };
  }

  const employeeNode = findNodeById(roots, employeeId);
  if (employeeNode && collectDescendantIds(employeeNode).has(managerId)) {
    return { valid: false, reason: 'Нельзя подчинить руководителю из своей ветки' };
  }

  return { valid: true };
};

export const countDirectReports = (node: OrgTreeNode): number => node.children.length;

export const countTotalReports = (node: OrgTreeNode): number => {
  let total = node.children.length;

  for (const child of node.children) {
    total += countTotalReports(child);
  }

  return total;
};
