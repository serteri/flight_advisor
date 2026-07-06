import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserEmail, isAdmin } from '@/lib/auth/currentUser';
import { ClaimStatusSelect } from '@/components/admin/ClaimStatusSelect';

type AdminClaimStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'LEGAL_REVIEW'
  | 'AIRLINE_CONTACTED'
  | 'SETTLED'
  | 'REJECTED';

export const dynamic = 'force-dynamic';

export default async function AdminClaimsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const email = await getCurrentUserEmail();
  if (!isAdmin(email)) {
    notFound();
  }

  const claims = await prisma.claimRequest.findMany({
    include: {
      trip: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="container mx-auto px-4 md:px-6 py-8">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Admin Claims</h1>
        <p className="mt-1 text-sm text-slate-600">
          Back-office claim status management panel
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">Created</th>
              <th className="px-3 py-3">Claim ID</th>
              <th className="px-3 py-3">Claimant</th>
              <th className="px-3 py-3">Trip</th>
              <th className="px-3 py-3">Trip User</th>
              <th className="px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((claim) => (
              <tr key={claim.id} className="border-t border-slate-100 align-top">
                <td className="px-3 py-3 text-slate-600">
                  {new Date(claim.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-3 font-mono text-xs text-slate-700">{claim.id}</td>
                <td className="px-3 py-3">
                  <div className="font-medium text-slate-900">{claim.fullName}</div>
                  <div className="text-xs text-slate-600">{claim.email}</div>
                </td>
                <td className="px-3 py-3 text-slate-700">{claim.trip.routeLabel}</td>
                <td className="px-3 py-3">
                  <div className="text-slate-800">{claim.trip.user.name || '-'}</div>
                  <div className="text-xs text-slate-600">{claim.trip.user.email}</div>
                </td>
                <td className="px-3 py-3">
                  <ClaimStatusSelect
                    claimId={claim.id}
                    initialStatus={claim.status as AdminClaimStatus}
                  />
                </td>
              </tr>
            ))}
            {claims.length === 0 && (
              <tr>
                <td className="px-3 py-8 text-center text-slate-500" colSpan={6}>
                  No claim requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
