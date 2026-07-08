import React from 'react';
import { Building2 } from 'lucide-react';
import { formatDepartmentLabel } from '../utils/orgStructure';
import { OrgConnectorStem } from './OrgChartConnectors';

interface OrgDepartmentBranchProps {
  department?: string | null;
  showDivider?: boolean;
  children: React.ReactNode;
}

const OrgDepartmentBranch: React.FC<OrgDepartmentBranchProps> = ({
  department,
  showDivider = false,
  children,
}) => (
  <div
    className={`flex shrink-0 flex-col items-center px-8 ${showDivider ? 'border-l border-pastel-200' : ''}`}
  >
    <OrgConnectorStem height={28} />
    <div className="mb-3 flex max-w-[240px] items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-pastel-500">
      <Building2 className="h-3 w-3 shrink-0" />
      <span className="truncate">{formatDepartmentLabel(department)}</span>
    </div>
    <div className="flex flex-col items-center">{children}</div>
  </div>
);

export default OrgDepartmentBranch;
