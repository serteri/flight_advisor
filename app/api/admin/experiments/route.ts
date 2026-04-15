/**
 * 🧪 ADMIN: EXPERIMENTS API
 * 
 * Create, manage, and monitor A/B tests
 * Protected endpoint - requires admin role
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import ExperimentManager, { ExperimentDefinition } from '@/lib/experiment/experimentManager';

const isAdmin = async (): Promise<boolean> => {
    const session = await auth();
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim());
    return adminEmails.length > 0 && adminEmails.includes(session?.user?.email || '');
};

export async function GET(request: Request) {
    try {
        if (!await isAdmin()) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status'); // DRAFT, RUNNING, PAUSED, COMPLETED

        let experiments = await ExperimentManager.getActiveExperiments();

        if (status) {
            experiments = experiments.filter((e) => e.status === status);
        }

        return NextResponse.json({
            success: true,
            experiments,
            count: experiments.length,
        });
    } catch (error) {
        console.error('[ADMIN_EXPERIMENTS_GET]', error);
        return NextResponse.json(
            { error: 'Failed to fetch experiments' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        if (!await isAdmin()) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const payload = await request.json();

        // Validate experiment definition
        if (!payload.name || !payload.experimentType || !payload.variants?.length) {
            return NextResponse.json(
                { error: 'Missing required fields: name, experimentType, variants' },
                { status: 400 }
            );
        }

        const experimentTypes = ['MESSAGE', 'CTA', 'PAYWALL_TIMING', 'RANKING_WEIGHT'];
        if (!experimentTypes.includes(payload.experimentType)) {
            return NextResponse.json(
                { error: `Invalid experimentType. Must be one of: ${experimentTypes.join(', ')}` },
                { status: 400 }
            );
        }

        // Validate variants
        if (!Array.isArray(payload.variants) || payload.variants.length < 2) {
            return NextResponse.json(
                { error: 'Experiments must have at least 2 variants' },
                { status: 400 }
            );
        }

        for (const variant of payload.variants) {\n            if (!variant.id || !variant.name) {\n                return NextResponse.json(\n                    { error: 'Each variant must have id and name' },\n                    { status: 400 }\n                );\n            }\n        }\n\n        // Create experiment\n        const result = await ExperimentManager.createExperiment(payload);\n\n        if (!result.success) {\n            return NextResponse.json(\n                { error: result.error || 'Creation failed' },\n                { status: 400 }\n            );\n        }\n\n        return NextResponse.json(\n            {\n                success: true,\n                experimentId: result.experimentId,\n                message: `Experiment \"${payload.name}\" created successfully`,\n            },\n            { status: 201 }\n        );\n    } catch (error) {\n        console.error('[ADMIN_EXPERIMENTS_POST]', error);\n        return NextResponse.json(\n            { error: 'Failed to create experiment' },\n            { status: 500 }\n        );\n    }\n}\n