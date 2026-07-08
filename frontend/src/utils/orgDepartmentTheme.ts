import { formatDepartmentLabel } from './orgStructure';

export interface DepartmentTheme {
  id: string;
  label: string;
  lineColor: string;
  borderClass: string;
  backgroundClass: string;
  headerClass: string;
  titleClass: string;
  dotClass: string;
  cardAccentClass: string;
}

const DEPARTMENT_THEMES: Omit<DepartmentTheme, 'label'>[] = [
  {
    id: 'rose',
    lineColor: '#e11d48',
    borderClass: 'border-rose-200',
    backgroundClass: 'bg-rose-50/70',
    headerClass: 'bg-rose-100/90',
    titleClass: 'text-rose-900',
    dotClass: 'bg-rose-500',
    cardAccentClass: 'border-l-rose-400',
  },
  {
    id: 'sky',
    lineColor: '#0284c7',
    borderClass: 'border-sky-200',
    backgroundClass: 'bg-sky-50/70',
    headerClass: 'bg-sky-100/90',
    titleClass: 'text-sky-900',
    dotClass: 'bg-sky-500',
    cardAccentClass: 'border-l-sky-400',
  },
  {
    id: 'emerald',
    lineColor: '#059669',
    borderClass: 'border-emerald-200',
    backgroundClass: 'bg-emerald-50/70',
    headerClass: 'bg-emerald-100/90',
    titleClass: 'text-emerald-900',
    dotClass: 'bg-emerald-500',
    cardAccentClass: 'border-l-emerald-400',
  },
  {
    id: 'amber',
    lineColor: '#d97706',
    borderClass: 'border-amber-200',
    backgroundClass: 'bg-amber-50/70',
    headerClass: 'bg-amber-100/90',
    titleClass: 'text-amber-900',
    dotClass: 'bg-amber-500',
    cardAccentClass: 'border-l-amber-400',
  },
  {
    id: 'violet',
    lineColor: '#7c3aed',
    borderClass: 'border-violet-200',
    backgroundClass: 'bg-violet-50/70',
    headerClass: 'bg-violet-100/90',
    titleClass: 'text-violet-900',
    dotClass: 'bg-violet-500',
    cardAccentClass: 'border-l-violet-400',
  },
  {
    id: 'cyan',
    lineColor: '#0891b2',
    borderClass: 'border-cyan-200',
    backgroundClass: 'bg-cyan-50/70',
    headerClass: 'bg-cyan-100/90',
    titleClass: 'text-cyan-900',
    dotClass: 'bg-cyan-500',
    cardAccentClass: 'border-l-cyan-400',
  },
  {
    id: 'fuchsia',
    lineColor: '#c026d3',
    borderClass: 'border-fuchsia-200',
    backgroundClass: 'bg-fuchsia-50/70',
    headerClass: 'bg-fuchsia-100/90',
    titleClass: 'text-fuchsia-900',
    dotClass: 'bg-fuchsia-500',
    cardAccentClass: 'border-l-fuchsia-400',
  },
];

const hashDepartment = (department: string): number => {
  let hash = 0;
  for (let index = 0; index < department.length; index += 1) {
    hash = (hash * 31 + department.charCodeAt(index)) >>> 0;
  }
  return hash;
};

export const getDepartmentTheme = (department?: string | null): DepartmentTheme => {
  const label = formatDepartmentLabel(department);
  const palette = DEPARTMENT_THEMES[hashDepartment(label) % DEPARTMENT_THEMES.length];

  return {
    ...palette,
    label,
  };
};
