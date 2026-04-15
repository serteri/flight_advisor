/**
 * 🧪 ADMIN: EXPERIMENT STATUS API
 * 
 * Update experiment status: DRAFT → RUNNING → PAUSED → COMPLETED
 * Protected endpoint - requires admin role
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import ExperimentManager from '@/lib/experiment/experimentManager';

const isAdmin = async (): Promise<boolean> => {
    const session = await auth();
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim());
    return adminEmails.length > 0 && adminEmails.includes(session?.user?.email || '');
};

export async function PUT(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        if (!await isAdmin()) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await context.params;
        const payload = await request.json();
        const { status } = payload;

        const validStatuses = ['DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED'];
        if (!validStatuses.includes(status)) {
            return NextResponse.json(
                { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
                { status: 400 }
            );
        }

        const success = await ExperimentManager.updateExperimentStatus(
            id,
            status as 'DRAFT' | 'RUNNING' | 'PAUSED' | 'COMPLETED'
        );

        if (!success) {
            return NextResponse.json(
                { error: 'Failed to update experiment status' },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            experimentId: id,
            newStatus: status,
            message: `Experiment ${id} status updated to ${status}`,
        });
    } catch (error) {
        console.error('[ADMIN_EXPERIMENT_STATUS_PUT]', error);
        return NextResponse.json(
            { error: 'Failed to update experiment status' },
            { status: 500 }
        );
    }
}