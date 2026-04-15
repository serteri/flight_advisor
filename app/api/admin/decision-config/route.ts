import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import DecisionConfigManager from '@/lib/decision/decisionConfigManager';

const isAdmin = async (): Promise<boolean> => {
	const session = await auth();
	const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim()).filter(Boolean);
	return adminEmails.length > 0 && adminEmails.includes(session?.user?.email || '');
};

export async function GET(request: Request) {
	try {
		if (!(await isAdmin())) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
		}

		const { searchParams } = new URL(request.url);
		const decisionType = searchParams.get('type');

		if (decisionType) {
			const config = DecisionConfigManager.getConfig(decisionType as 'BUY_NOW' | 'WAIT' | 'AVOID');
			return NextResponse.json({ success: true, config });
		}

		return NextResponse.json({
			success: true,
			configs: DecisionConfigManager.getAllConfigs(),
			lastSync: new Date(),
		});
	} catch (error) {
		console.error('[ADMIN_DECISION_CONFIG_GET]', error);
		return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
	}
}

export async function POST(request: Request) {
	try {
		if (!(await isAdmin())) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
		}

		const payload = await request.json();
		const session = await auth();
		const adminEmail = session?.user?.email || 'unknown';
		const { decisionType, ...updates } = payload;

		if (!decisionType || !['BUY_NOW', 'WAIT', 'AVOID'].includes(decisionType)) {
			return NextResponse.json({ error: 'Invalid decisionType' }, { status: 400 });
		}

		if (
			typeof updates.priceThresholdMin === 'number' &&
			typeof updates.priceThresholdMax === 'number' &&
			updates.priceThresholdMin >= updates.priceThresholdMax
		) {
			return NextResponse.json({ error: 'Invalid range: min must be < max' }, { status: 400 });
		}

		const result = await DecisionConfigManager.updateConfig(decisionType, updates, adminEmail);
		if (!result.success) {
			return NextResponse.json({ error: result.error || 'Update failed' }, { status: 400 });
		}

		return NextResponse.json({
			success: true,
			config: result.config,
			message: `Config updated for ${decisionType}. Version: ${result.config?.version}`,
		});
	} catch (error) {
		console.error('[ADMIN_DECISION_CONFIG_POST]', error);
		return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
	}
}