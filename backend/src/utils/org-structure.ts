import { Pool } from 'pg';

export interface OrgEmployeeRow {
  id: number | string;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  position: string;
  department: string;
  photo?: string | null;
  manager_id?: number | string | null;
}

export interface OrgEmployee {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  position: string;
  department: string;
  photo?: string;
  managerId?: string | null;
}

export interface OrgTreeNode {
  employee: OrgEmployee;
  children: OrgTreeNode[];
}

export const mapOrgEmployee = (row: OrgEmployeeRow): OrgEmployee => ({
  id: String(row.id),
  firstName: row.first_name,
  lastName: row.last_name,
  middleName: row.middle_name || undefined,
  position: row.position,
  department: row.department,
  photo: row.photo || undefined,
  managerId: row.manager_id ? String(row.manager_id) : null,
});

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

  const roots = employees
    .filter((employee) => {
      if (!employee.managerId) {
        return true;
      }

      return !byId.has(employee.managerId) || employee.managerId === employee.id;
    })
    .sort((left, right) => getEmployeeFullName(left).localeCompare(getEmployeeFullName(right), 'ru'))
    .map(buildNode);

  return roots;
};

export const flattenOrgTree = (
  nodes: OrgTreeNode[],
  depth = 0,
  acc: Array<{ node: OrgTreeNode; depth: number }> = []
): Array<{ node: OrgTreeNode; depth: number }> => {
  for (const node of nodes) {
    acc.push({ node, depth });
    flattenOrgTree(node.children, depth + 1, acc);
  }

  return acc;
};

export const wouldCreateManagerCycle = async (
  pool: Pool,
  employeeId: string | number,
  managerId: string | number | null | undefined
): Promise<boolean> => {
  if (!managerId) {
    return false;
  }

  if (String(employeeId) === String(managerId)) {
    return true;
  }

  let current: string | number | null = managerId;
  const visited = new Set<string>();

  while (current) {
    const currentKey = String(current);
    if (visited.has(currentKey)) {
      return true;
    }

    visited.add(currentKey);

    if (currentKey === String(employeeId)) {
      return true;
    }

    const result: { rows: Array<{ manager_id: number | null }> } = await pool.query(
      'SELECT manager_id FROM employees WHERE id = $1',
      [current]
    );

    if (result.rows.length === 0) {
      break;
    }

    current = result.rows[0].manager_id;
  }

  return false;
};
