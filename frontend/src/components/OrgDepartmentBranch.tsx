import React from 'react';
import { Building2 } from 'lucide-react';
import { DepartmentTheme } from '../utils/orgDepartmentTheme';

interface OrgDepartmentBranchProps {
  theme: DepartmentTheme;
  children: React.ReactNode;
}

const OrgDepartmentBranch: React.FC<OrgDepartmentBranchProps> = ({ theme, children }) => (
  <div
    className={`w-full rounded-2xl border-2 px-4 pb-5 pt-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ${theme.borderClass} ${theme.backgroundClass}`}
  >
    <div
      className={`mb-4 flex items-center gap-2 rounded-xl border border-white/60 px-3 py-2 shadow-sm ${theme.headerClass}`}
    >
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${theme.dotClass}`} />
      <Building2 className={`h-3.5 w-3.5 shrink-0 ${theme.titleClass} opacity-70`} />
      <span className={`truncate text-xs font-bold uppercase tracking-wide ${theme.titleClass}`}>
        {theme.label}
      </span>
    </div>
    <div className="flex flex-col items-center">{children}</div>
  </div>
);

export default OrgDepartmentBranch;
