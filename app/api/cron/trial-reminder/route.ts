import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { EmailChannel } from '@/services/notifications/channels/email';
import type { NotificationPayload } from '@/services/notifications/types';

export const dynamic = 'force-dynamic';

const getTargetWindow = (daysFromNow: number) => {
    const targetStart = new Date();
    targetStart.setDate(targetStart.getDate() + daysFromNow);
    targetStart.setHours(0, 0, 0, 0);

    const targetEnd = new Date(targetStart);
    targetEnd.setHours(23, 59, 59, 999);

    return { targetStart, targetEnd };
};

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { targetStart, targetEnd } = getTargetWindow(3);
    const now = new Date();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://flight-guardian.com';

    try {
        const users = await prisma.user.findMany({
            where: {
                subscriptionStatus: 'trialing',
                trialEndsAt: {
                    gte: targetStart,
                    lte: targetEnd,
                },
                OR: [
                    { trialReminderSentAt: null },
                    { trialReminderSentAt: { lt: targetStart } },
                ],
            },
            select: {
                id: true,
                email: true,
                name: true,
                trialEndsAt: true,
                subscriptionPlan: true,
            },
        });

        const emailChannel = EmailChannel.getInstance();
        let sent = 0;
        let failed = 0;

        for (const user of users) {
            if (!user.email || !user.trialEndsAt) {
                continue;
            }

            console.log('[CRON] Trial reminder candidate', {
                userId: user.id,
                email: user.email,
                trialEndsAt: user.trialEndsAt.toISOString(),
            });

            const planName = user.subscriptionPlan && user.subscriptionPlan !== 'FREE'
                ? user.subscriptionPlan
                : 'PRO';
            const trialEndLabel = user.trialEndsAt.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
            });

            const payload: NotificationPayload = {
                userId: user.id,
                type: 'UPGRADE',
                title: `${planName} trial ends in 3 days`,
                message: `Your ${planName} trial ends on ${trialEndLabel}. Keep your premium features by confirming your subscription.`,
                priority: 'WARNING',
                data: {
                    ctaUrl: `${appUrl}/pricing`,
                    ctaLabel: 'Manage Subscription',
                },
            };

            try {
                const result = await emailChannel.send(user.email, payload);
                if (result.success) {
                    sent += 1;
                    await prisma.user.update({
                        where: { id: user.id },
                        data: { trialReminderSentAt: now },
                    });
                } else {
                    failed += 1;
                }
            } catch (error) {
                console.error('[CRON] Trial reminder email failed', error);
                failed += 1;
            }
        }

        return NextResponse.json({
            success: true,
            window: {
                start: targetStart.toISOString(),
                end: targetEnd.toISOString(),
            },
            candidates: users.length,
            sent,
            failed,
        });
    } catch (error) {
        console.error('[CRON] Trial reminder failed', error);
        return NextResponse.json(
            { error: 'Trial reminder failed', details: String(error) },
            { status: 500 }
        );
    }
}
