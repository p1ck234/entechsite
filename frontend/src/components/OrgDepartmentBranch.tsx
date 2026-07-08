import React, { Children, isValidElement } from 'react';
import { Building2 } from 'lucide-react';
import { formatDepartmentLabel } from '../utils/orgStructure';
import { OrgConnectorStem } from './OrgChartConnectors';

interface OrgDepartmentBranchProps {
  department?: string | null;
  showDivider?: boolean;
  showStem?: boolean;
  children: React.ReactNode;
}

const OrgDepartmentBranch: React.FC<OrgDepartmentBranchProps> = ({
  department,
  showStem = true,
  children,
}) => (
  <div className="flex shrink-0 flex-col items-center" data-connector-item>
    {showStem && <OrgConnectorStem height={20} />}
    <div className="w-[272px] overflow-visible rounded-lg border border-slate-200 bg-white px-2 pb-2 pt-2 shadow-sm">
      <div className="mb-2 flex items-center gap-1.5 border-b border-slate-100 pb-1.5 text-slate-500">
        <Building2 className="h-3 w-3 shrink-0" />
        <span className="truncate text-[10px] font-semibold uppercase tracking-wide">
          {formatDepartmentLabel(department)}
        </span>
      </div>
      <div>
        {Children.map(children, (child) =>
          isValidElement(child) ? (
            <div key={child.key} className="mb-3 block w-full shrink-0 last:mb-0">
              {child}
            </div>
          ) : null
        )}
      </div>
    </div>
  </div>
);

export default OrgDepartmentBranch;
