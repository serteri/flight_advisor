import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return Response.json(
        { subscriptionPlan: 'FREE', error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { subscriptionPlan: true, isPremium: true }
    });

    if (!user) {
      return Response.json(
        { subscriptionPlan: 'FREE', error: 'User not found' },
        { status: 404 }
      );
    }

    return Response.json({
      subscriptionPlan: user.subscriptionPlan || 'FREE',
      isPremium: user.isPremium || false
    });
  } catch (error) {
    console.error('[user-tier] Error:', error);
    return Response.json(
      { subscriptionPlan: 'FREE', error: 'Internal server error' },
      { status: 500 }
    );
  }
}
