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
    <div className="min-w-[240px] max-w-full rounded-2xl border border-slate-200/70 bg-white/80 px-4 pb-4 pt-3 shadow-[0_6px_24px_rgba(15,23,42,0.06)] backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-center gap-1.5 rounded-xl bg-slate-50/90 px-3 py-2">
        <Building2 className="h-3.5 w-3.5 shrink-0 text-primary-500/70" />
        <span className="max-w-[210px] truncate text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
          {formatDepartmentLabel(department)}
        </span>
      </div>
      <div className="flex w-full min-w-0 flex-col items-stretch gap-5">{children}</div>
    </div>
  </div>
);

export default OrgDepartmentBranch;
