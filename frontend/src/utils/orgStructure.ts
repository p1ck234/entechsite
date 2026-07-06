import { OrgEmployee, OrgTreeNode, OrgDepartmentGroup } from '../types';

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

export const buildDepartmentGroups = (employees: OrgEmployee[]): OrgDepartmentGroup[] => {
  const departments = [...new Set(employees.map((employee) => employee.department || 'Без отдела'))]
    .sort((left, right) => left.localeCompare(right, 'ru'));

  return departments.map((department) => {
    const deptEmployees = employees.filter(
      (employee) => (employee.department || 'Без отдела') === department
    );
    const deptIds = new Set(deptEmployees.map((employee) => employee.id));
    const scopedEmployees = deptEmployees.map((employee) => {
      if (employee.managerId && deptIds.has(employee.managerId)) {
        return employee;
      }
      return { ...employee, managerId: null };
    });

    return {
      department,
      employees: deptEmployees,
      roots: buildOrgTree(scopedEmployees),
      employeeCount: deptEmployees.length,
    };
  });
};

export const countManagerLinks = (employees: OrgEmployee[]): number =>
  employees.filter((employee) => employee.managerId).length;

export const countDepartmentInternalLinks = (employees: OrgEmployee[]): number => {
  const deptIds = new Set(employees.map((employee) => employee.id));
  return employees.filter((employee) => employee.managerId && deptIds.has(employee.managerId)).length;
};

export const departmentHasHierarchy = (group: OrgDepartmentGroup): boolean =>
  countDepartmentInternalLinks(group.employees) > 0;

const leadershipScore = (position: string): number => {
  const normalized = position.toLowerCase();
  if (normalized.includes('генеральн')) return 0;
  if (normalized.includes('коммерческ') && normalized.includes('директор')) return 1;
  if (normalized.includes('директор')) return 2;
  if (normalized.includes('руководитель') || normalized.includes('начальник')) return 3;
  if (normalized.includes('старш')) return 4;
  if (normalized.includes('менеджер')) return 5;
  return 6;
};

export const sortEmployeesBySeniority = (employees: OrgEmployee[]): OrgEmployee[] =>
  [...employees].sort((left, right) => {
    const scoreDiff = leadershipScore(left.position) - leadershipScore(right.position);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return getEmployeeFullName(left).localeCompare(getEmployeeFullName(right), 'ru');
  });

export const guessDepartmentHead = (employees: OrgEmployee[]): OrgEmployee | null => {
  if (employees.length === 0) {
    return null;
  }

  const withInternalReports = employees
    .map((employee) => ({
      employee,
      reports: employees.filter((item) => item.managerId === employee.id).length,
    }))
    .sort((left, right) => right.reports - left.reports);

  if (withInternalReports[0]?.reports > 0) {
    return withInternalReports[0].employee;
  }

  return sortEmployeesBySeniority(employees)[0] || null;
};

export const getDirectReports = (employees: OrgEmployee[], managerId: string): OrgEmployee[] =>
  employees.filter((employee) => employee.managerId === managerId);
