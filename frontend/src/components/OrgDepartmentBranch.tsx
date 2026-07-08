import React from 'react';
import { Building2 } from 'lucide-react';
import { formatDepartmentLabel } from '../utils/orgStructure';
import { OrgConnectorStem } from './OrgChartConnectors';

interface OrgDepartmentBranchProps {
  department?: string | null;
  showDivider?: boolean;
  children: React.ReactNode;
}

const OrgDepartmentBranch: React.FC<OrgDepartmentBranchProps> = ({ department, children }) => (
  <div className="flex shrink-0 flex-col items-center" data-connector-item>
    <OrgConnectorStem height={24} />
    <div className="min-w-[240px] max-w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3 pb-3 pt-2.5">
      <div className="mb-2.5 flex items-center justify-center gap-1.5 text-slate-500">
        <Building2 className="h-3 w-3 shrink-0" />
        <span className="max-w-[220px] truncate text-[10px] font-semibold uppercase tracking-[0.12em]">
          {formatDepartmentLabel(department)}
        </span>
      </div>
      <div className="flex w-full min-w-0 flex-col items-stretch gap-4">{children}</div>
    </div>
  </div>
);

export default OrgDepartmentBranch;
