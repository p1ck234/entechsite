import { OrgEmployee, OrgTreeNode } from '../types';

export const getEmployeeFullName = (employee: OrgEmployee): string =>
  [employee.lastName, employee.firstName, employee.middleName].filter(Boolean).join(' ');

export const buildOrgTree = (employees: OrgEmployee[]): OrgTreeNode[] => {
  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  const childrenByManager = new Map<string, OrgEmployee[]>();

  for (const employee of employees) {
    const managerId = employee.managerId;
    if (!managerId || !byId.has(managerId) || managerId === employee.id) {
      continue;
    }

    const siblings = childrenByManager.get(managerId) || [];
    siblings.push(employee);
    childrenByManager.set(managerId, siblings);
  }

  const buildNode = (employee: OrgEmployee): OrgTreeNode => ({
    employee,
    children: (childrenByManager.get(employee.id) || [])
      .sort((left, right) => getEmployeeFullName(left).localeCompare(getEmployeeFullName(right), 'ru'))
      .map(buildNode),
  });

  return employees
    .filter((employee) => {
      if (!employee.managerId) {
        return true;
      }
      return !byId.has(employee.managerId) || employee.managerId === employee.id;
    })
    .sort((left, right) => getEmployeeFullName(left).localeCompare(getEmployeeFullName(right), 'ru'))
    .map(buildNode);
};

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
