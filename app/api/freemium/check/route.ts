import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { FREEMIUM_FEATURES, type FreemiumFeature } from '@/lib/freemium/limits';
import { checkLimit } from '@/lib/freemium/usage';
import { prisma } from '@/lib/prisma';

const querySchema = z.object({
  feature: z.enum(FREEMIUM_FEATURES as unknown as [FreemiumFeature, ...FreemiumFeature[]]),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = querySchema.safeParse({
    feature: request.nextUrl.searchParams.get('feature') || '',
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid feature query param',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  let resolvedUserId: string | undefined = session.user.id;
  if (!resolvedUserId && session.user.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    resolvedUserId = user?.id;
  }

  if (!resolvedUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = await checkLimit(resolvedUserId, parsed.data.feature);

  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: 'LIMIT_REACHED',
        feature: parsed.data.feature,
        ...limit,
      },
      { status: 402 },
    );
  }

  return NextResponse.json(limit, { status: 200 });
}
