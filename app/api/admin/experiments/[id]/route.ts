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
    request: Request,\n    { params }: { params: { id: string } }\n) {\n    try {\n        if (!await isAdmin()) {\n            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });\n        }\n\n        const { id } = params;\n        const payload = await request.json();\n        const { status } = payload;\n\n        const validStatuses = ['DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED'];\n        if (!validStatuses.includes(status)) {\n            return NextResponse.json(\n                { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },\n                { status: 400 }\n            );\n        }\n\n        // Update experiment status\n        const success = await ExperimentManager.updateExperimentStatus(\n            id,\n            status as 'DRAFT' | 'RUNNING' | 'PAUSED' | 'COMPLETED'\n        );\n\n        if (!success) {\n            return NextResponse.json(\n                { error: 'Failed to update experiment status' },\n                { status: 400 }\n            );\n        }\n\n        return NextResponse.json({\n            success: true,\n            experimentId: id,\n            newStatus: status,\n            message: `Experiment ${id} status updated to ${status}`,\n        });\n    } catch (error) {\n        console.error('[ADMIN_EXPERIMENT_STATUS_PUT]', error);\n        return NextResponse.json(\n            { error: 'Failed to update experiment status' },\n            { status: 500 }\n        );\n    }\n}\n