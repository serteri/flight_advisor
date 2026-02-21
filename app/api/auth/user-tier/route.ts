import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      // Return FREE tier for unauthenticated users (still 200 OK)
      return Response.json(
        { subscriptionPlan: 'FREE', isPremium: false },
        { status: 200 }
      );
    }

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { subscriptionPlan: true }
    });

    // Return subscription plan from DB, or FREE if user not found
    const subscriptionPlan = (user?.subscriptionPlan as string) || 'FREE';
    const isPremium = subscriptionPlan === 'PRO' || subscriptionPlan === 'ELITE';

    return Response.json({
      subscriptionPlan,
      isPremium
    }, { status: 200 });
  } catch (error) {
    console.error('[user-tier] Error:', error);
    // Always return 200 with FREE tier on error
    return Response.json(
      { subscriptionPlan: 'FREE', isPremium: false },
      { status: 200 }
    );
  }
}
