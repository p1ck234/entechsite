import { OrgEmployee, OrgTreeNode, OrgDepartmentGroup } from '../types';

export const getEmployeeFullName = (employee: OrgEmployee): string =>
  [employee.lastName, employee.firstName, employee.middleName].filter(Boolean).join(' ');

export const normalizeOrgId = (id: string | number | null | undefined): string | null => {
  if (id === null || id === undefined || id === '') {
    return null;
  }

  return String(id);
};

const resolveDepartmentManagerId = (
  employee: OrgEmployee,
  departmentIds: Set<string>,
  employeesById: Map<string, OrgEmployee>
): string | null => {
  let currentId = normalizeOrgId(employee.managerId);
  const visited = new Set<string>();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    if (departmentIds.has(currentId)) {
      return currentId;
    }

    const manager = employeesById.get(currentId);
    currentId = manager ? normalizeOrgId(manager.managerId) : null;
  }

  return null;
};

const countTreeNodes = (node: OrgTreeNode): number =>
  1 + node.children.reduce((sum, child) => sum + countTreeNodes(child), 0);

export const mergeDepartmentRoots = (roots: OrgTreeNode[]): OrgTreeNode[] => {
  if (roots.length <= 1) {
    return roots;
  }

  const sorted = [...roots].sort((left, right) => countTreeNodes(right) - countTreeNodes(left));
  const mergedRoot: OrgTreeNode = {
    employee: sorted[0].employee,
    children: [...sorted[0].children],
  };
  const pending = sorted.slice(1);

  while (pending.length > 0) {
    let attached = false;

    for (let index = pending.length - 1; index >= 0; index -= 1) {
      const orphan = pending[index];
      const managerId = normalizeOrgId(orphan.employee.managerId);
      if (!managerId) {
        continue;
      }

      const managerNode = findNodeById([mergedRoot], managerId);
      if (managerNode) {
        managerNode.children = [...managerNode.children, orphan].sort((left, right) =>
          compareOrgEmployees(left.employee, right.employee)
        );
        pending.splice(index, 1);
        attached = true;
      }
    }

    if (!attached) {
      mergedRoot.children = [...mergedRoot.children, ...pending];
      break;
    }
  }

  return [mergedRoot];
};

export const buildOrgTree = (employees: OrgEmployee[]): OrgTreeNode[] => {
  const normalizedEmployees = employees.map((employee) => ({
    ...employee,
    id: normalizeOrgId(employee.id)!,
    managerId: normalizeOrgId(employee.managerId),
  }));
  const byId = new Map(normalizedEmployees.map((employee) => [employee.id, employee]));
  const childrenByManager = new Map<string, OrgEmployee[]>();

  for (const employee of normalizedEmployees) {
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
      .sort(compareOrgEmployees)
      .map(buildNode),
  });

  return normalizedEmployees
    .filter((employee) => {
      if (!employee.managerId) {
        return true;
      }
      return !byId.has(employee.managerId) || employee.managerId === employee.id;
    })
    .sort((left, right) => {
      const scoreDiff = leadershipScore(left.position) - leadershipScore(right.position);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return getEmployeeFullName(left).localeCompare(getEmployeeFullName(right), 'ru');
    })
    .map(buildNode);
};

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

const compareOrgEmployees = (left: OrgEmployee, right: OrgEmployee): number => {
  const leftIsRole = left.orgDisplayMode === 'role';
  const rightIsRole = right.orgDisplayMode === 'role';

  if (leftIsRole !== rightIsRole) {
    return leftIsRole ? 1 : -1;
  }

  if (leftIsRole && rightIsRole) {
    return left.position.localeCompare(right.position, 'ru');
  }

  return getEmployeeFullName(left).localeCompare(getEmployeeFullName(right), 'ru');
};

export const isOrgRoleNode = (employee: OrgEmployee): boolean => employee.orgDisplayMode === 'role';

export const getOrgNodeLabel = (employee: OrgEmployee): string =>
  isOrgRoleNode(employee) ? employee.position : getEmployeeFullName(employee);

export const collectExpandedIdsUpToDepth = (
  nodes: OrgTreeNode[],
  maxDepth: number,
  depth = 0,
  acc = new Set<string>()
): Set<string> => {
  for (const node of nodes) {
    if (node.children.length > 0 && depth < maxDepth) {
      acc.add(node.employee.id);
      collectExpandedIdsUpToDepth(node.children, maxDepth, depth + 1, acc);
    }
  }

  return acc;
};

export const collectAllExpandableIds = (nodes: OrgTreeNode[], acc = new Set<string>()): Set<string> => {
  for (const node of nodes) {
    if (node.children.length > 0) {
      acc.add(node.employee.id);
      collectAllExpandableIds(node.children, acc);
    }
  }

  return acc;
};

export const findNodeById = (nodes: OrgTreeNode[], employeeId: string): OrgTreeNode | null => {
  const normalizedId = normalizeOrgId(employeeId);
  for (const node of nodes) {
    if (normalizeOrgId(node.employee.id) === normalizedId) {
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
  const employeesById = new Map(
    employees.map((employee) => [normalizeOrgId(employee.id)!, employee])
  );
  const departments = [...new Set(employees.map((employee) => employee.department || 'Без отдела'))]
    .sort((left, right) => left.localeCompare(right, 'ru'));

  return departments.map((department) => {
    const deptEmployees = employees.filter(
      (employee) => (employee.department || 'Без отдела') === department
    );
    const departmentIds = new Set(
      deptEmployees.map((employee) => normalizeOrgId(employee.id)!)
    );
    const scopedEmployees = deptEmployees.map((employee) => ({
      ...employee,
      id: normalizeOrgId(employee.id)!,
      managerId: resolveDepartmentManagerId(employee, departmentIds, employeesById),
    }));

    return {
      department,
      employees: deptEmployees,
      roots: mergeDepartmentRoots(buildOrgTree(scopedEmployees)),
      employeeCount: deptEmployees.length,
    };
  });
};

export const countManagerLinks = (employees: OrgEmployee[]): number =>
  employees.filter((employee) => employee.managerId).length;

export const countDepartmentInternalLinks = (employees: OrgEmployee[]): number => {
  const deptIds = new Set(employees.map((employee) => normalizeOrgId(employee.id)!));
  return employees.filter((employee) => {
    const managerId = normalizeOrgId(employee.managerId);
    return managerId && deptIds.has(managerId);
  }).length;
};

export const departmentHasHierarchy = (group: OrgDepartmentGroup): boolean =>
  countDepartmentInternalLinks(group.employees) > 0;

export const formatDepartmentLabel = (department?: string | null): string => {
  const normalized = department?.trim();
  return normalized || 'Без отдела';
};

export const getDepartmentGroupKey = (department?: string | null): string =>
  (department || '').trim().toLowerCase() || '__none__';

export const groupOrgNodesByDepartment = (
  nodes: OrgTreeNode[]
): Array<{ department: string | null; nodes: OrgTreeNode[] }> => {
  const groups = new Map<string, OrgTreeNode[]>();
  const order: string[] = [];

  for (const node of nodes) {
    const key = getDepartmentGroupKey(node.employee.department);
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(node);
  }

  return order.map((key) => {
    const grouped = groups.get(key)!;
    return {
      department: key === '__none__' ? null : grouped[0].employee.department ?? null,
      nodes: grouped,
    };
  });
};

export const sortEmployeesBySeniority = (employees: OrgEmployee[]): OrgEmployee[] =>
  [...employees].sort((left, right) => {
    const scoreDiff = leadershipScore(left.position) - leadershipScore(right.position);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return getEmployeeFullName(left).localeCompare(getEmployeeFullName(right), 'ru');
  });

export const sortCompanyRoots = (roots: OrgTreeNode[]): OrgTreeNode[] =>
  [...roots].sort((left, right) => {
    const scoreDiff = leadershipScore(left.employee.position) - leadershipScore(right.employee.position);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return getEmployeeFullName(left.employee).localeCompare(getEmployeeFullName(right.employee), 'ru');
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

export const getDirectReports = (employees: OrgEmployee[], managerId: string): OrgEmployee[] => {
  const normalizedManagerId = normalizeOrgId(managerId);
  return employees.filter((employee) => normalizeOrgId(employee.managerId) === normalizedManagerId);
};
