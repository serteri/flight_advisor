import { NextResponse } from 'next/server';
import type { ClaimStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUserEmail, isAdmin } from '@/lib/auth/currentUser';

const VALID_STATUSES = new Set<ClaimStatus>([
  'PENDING',
  'SUBMITTED',
  'LEGAL_REVIEW',
  'AIRLINE_CONTACTED',
  'SETTLED',
  'REJECTED',
]);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const email = await getCurrentUserEmail();
  if (!isAdmin(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  let payload: { status?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const status = payload.status as ClaimStatus | undefined;
  if (!status || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const updated = await prisma.claimRequest.update({
    where: { id },
    data: { status },
    select: { id: true, status: true, updatedAt: true },
  });

  return NextResponse.json(updated, { status: 200 });
}
