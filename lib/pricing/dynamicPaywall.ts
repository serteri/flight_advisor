export type PaywallStrategy = 'HARD_LOCK' | 'SOFT_LOCK' | 'DELAYED_LOCK' | 'OPEN';

export interface PaywallContext {
	strategy: PaywallStrategy;
	showPreview: boolean;
	showUpgradePrompt: boolean;
	urgencyLevel: 'HIGH' | 'MEDIUM' | 'LOW';
	message: string;
	ctaLabel: string;
	ctaUrl?: string;
}

class DynamicPaywall {
	static resolveStrategy(
		decisionType: 'BUY_NOW' | 'WAIT' | 'AVOID' | null,
		confidence: number,
		isPremium: boolean
	): PaywallContext {
		if (isPremium) {
			return {
				strategy: 'OPEN',
				showPreview: false,
				showUpgradePrompt: false,
				urgencyLevel: 'LOW',
				message: '',
				ctaLabel: '',
			};
		}

		if (!decisionType) {
			return this.getSoftLockContext('See detailed analysis to make the best booking decision.', 'View Analysis');
		}

		if (decisionType === 'BUY_NOW') {
			const urgency = confidence >= 75 ? 'HIGH' : 'MEDIUM';
			return this.getHardLockContext(
				confidence >= 75
					? 'Do not miss out. Unlock the full analysis before prices rise.'
					: 'Unlock detailed price trends and booking strategy.',
				'Unlock Now',
				urgency
			);
		}

		if (decisionType === 'WAIT') {
			return this.getSoftLockContext(
				confidence >= 75
					? 'View trend analysis to confirm if the drop is coming.'
					: 'See pricing trends and recommendation.'
			);
		}

		if (decisionType === 'AVOID') {
			return this.getDelayedLockContext('See better alternatives and pricing insights.', 'See All Options');
		}

		return this.getSoftLockContext('View analysis', 'Learn More');
	}

	private static getHardLockContext(
		message: string,
		ctaLabel: string,
		urgency: 'HIGH' | 'MEDIUM' = 'MEDIUM'
	): PaywallContext {
		return {
			strategy: 'HARD_LOCK',
			showPreview: false,
			showUpgradePrompt: true,
			urgencyLevel: urgency,
			message,
			ctaLabel,
			ctaUrl: '/upgrade?intent=buy_now',
		};
	}

	private static getSoftLockContext(message: string, ctaLabel: string = 'Upgrade'): PaywallContext {
		return {
			strategy: 'SOFT_LOCK',
			showPreview: true,
			showUpgradePrompt: true,
			urgencyLevel: 'MEDIUM',
			message,
			ctaLabel,
			ctaUrl: '/upgrade',
		};
	}

	private static getDelayedLockContext(
		message: string,
		ctaLabel: string = 'Compare Flights'
	): PaywallContext {
		return {
			strategy: 'DELAYED_LOCK',
			showPreview: true,
			showUpgradePrompt: false,
			urgencyLevel: 'LOW',
			message,
			ctaLabel,
			ctaUrl: '/flights?sort=best',
		};
	}

	static canAccessFeature(
		feature: 'DECISION_RECOMMENDATION' | 'CONFIDENCE_SCORE' | 'TREND_ANALYSIS' | 'REGRET_INSIGHT',
		isPremium: boolean,
		decisionType: 'BUY_NOW' | 'WAIT' | 'AVOID' | null,
		confidence: number
	): boolean {
		if (isPremium) return true;

		if (feature === 'DECISION_RECOMMENDATION') return decisionType === 'BUY_NOW';
		if (feature === 'CONFIDENCE_SCORE') return false;
		if (feature === 'TREND_ANALYSIS') return decisionType === 'WAIT';
		if (feature === 'REGRET_INSIGHT') return decisionType === 'AVOID' && confidence >= 75;
		return false;
	}

	static getPaywallMessage(context: PaywallContext): string {
		if (context.strategy === 'HARD_LOCK') return `${context.message} (Premium exclusive)`;
		if (context.strategy === 'SOFT_LOCK') return `${context.message} Unlock for full details.`;
		if (context.strategy === 'DELAYED_LOCK') return context.message;
		return '';
	}

	static shouldShowPaywall(context: PaywallContext): boolean {
		return context.strategy !== 'OPEN';
	}

	static getBlurOpacity(context: PaywallContext): number {
		if (context.strategy === 'HARD_LOCK') return 0;
		if (context.strategy === 'SOFT_LOCK') return 0.4;
		return 1;
	}

	static showUpgradeButton(context: PaywallContext): boolean {
		return context.showUpgradePrompt && context.strategy !== 'OPEN';
	}
}

export default DynamicPaywall;