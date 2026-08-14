import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import { LoadingState } from '@/components/states';
import { CompanyList } from '@/features/crm/components/company-list';
import { requireOrg } from '@/server/auth-context';

export const metadata = { title: 'Companies' };

export const dynamic = 'force-dynamic';

/**
 * Companies (Milestone 10).
 */
export default async function CrmCompaniesPage() {
  await requireOrg();

  return (
    <div className="space-y-6">
      <PageHeader title="Companies" description="Organisations linked to contacts and deals." />
      <Suspense fallback={<LoadingState rows={5} label="Loading companies" />}>
        <CompanyList />
      </Suspense>
    </div>
  );
}
