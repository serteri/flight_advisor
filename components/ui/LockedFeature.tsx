'use client';

import { Lock, Sparkles, Zap, Crown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface LockedFeatureOverlayProps {
    featureName: string;
    requiredTier: 'PRO' | 'ELITE';
    description?: string;
    benefits?: string[];
    className?: string;
    onClick?: () => void;
}

export function LockedFeatureOverlay({
    featureName,
    requiredTier,
    description,
    benefits = [],
    className = '',
    onClick
}: LockedFeatureOverlayProps) {
    const router = useRouter();

    const handleUpgrade = () => {
        if (onClick) {
            onClick();
        } else {
            router.push('/pricing');
        }
    };

    const tierConfig = {
        PRO: {
            icon: <Zap className="w-6 h-6" />,
            gradient: 'from-blue-500 to-purple-600',
            badge: 'bg-gradient-to-r from-blue-500 to-purple-600',
            price: '$9.90/mo'
        },
        ELITE: {
            icon: <Crown className="w-6 h-6" />,
            gradient: 'from-amber-500 to-orange-600',
            badge: 'bg-gradient-to-r from-amber-500 to-orange-600',
            price: '$19.90/mo'
        }
    };

    const config = tierConfig[requiredTier];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`absolute inset-0 z-30 flex items-center justify-center backdrop-blur-sm bg-white/60 rounded-lg ${className}`}
        >
            <div className="relative w-full h-full flex items-center justify-center p-6">
                {/* Gradient Border Effect */}
                <div className={`absolute inset-0 rounded-lg bg-gradient-to-br ${config.gradient} opacity-10`} />
                
                {/* Content */}
                <div className="relative text-center max-w-md">
                    {/* Icon */}
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br ${config.gradient} text-white mb-4 shadow-lg`}>
                        <Lock className="w-8 h-8" />
                    </div>

                    {/* Title */}
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {featureName}
                    </h3>

                    {/* Description */}
                    <p className="text-sm text-gray-600 mb-4">
                        {description || `Unlock ${featureName} with ${requiredTier} membership`}
                    </p>

                    {/* Benefits List */}
                    {benefits.length > 0 && (
                        <ul className="text-left space-y-2 mb-6 max-w-xs mx-auto">
                            {benefits.map((benefit, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                    <span>{benefit}</span>
                                </li>
                            ))}
                        </ul>
                    )}

                    {/* CTA Button */}
                    <Button
                        onClick={handleUpgrade}
                        className={`bg-gradient-to-r ${config.gradient} hover:opacity-90 text-white font-semibold px-6 py-2.5 rounded-full shadow-lg hover:shadow-xl transition-all duration-300`}
                    >
                        {config.icon}
                        <span className="ml-2">Upgrade to {requiredTier}</span>
                        <span className="ml-2 text-xs opacity-80">{config.price}</span>
                    </Button>

                    {/* Tier Badge */}
                    <div className={`inline-block mt-4 px-3 py-1 rounded-full ${config.badge} text-white text-xs font-bold`}>
                        {requiredTier} Feature
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

/**
 * Compact inline lock badge for smaller elements
 */
export function LockedBadge({ requiredTier, size = 'sm' }: { requiredTier: 'PRO' | 'ELITE'; size?: 'sm' | 'md' }) {
    const config = {
        PRO: { gradient: 'from-blue-500 to-purple-600' },
        ELITE: { gradient: 'from-amber-500 to-orange-600' }
    };

    const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs';

    return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r ${config[requiredTier].gradient} text-white font-bold ${sizeClass}`}>
            <Lock className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
            {requiredTier}
        </span>
    );
}

/**
 * Premium feature active badge (for PRO/ELITE users)
 */
export function PremiumBadge({ tier, label }: { tier: 'PRO' | 'ELITE'; label?: string }) {
    const config = {
        PRO: {
            gradient: 'from-blue-500 to-purple-600',
            icon: <Zap className="w-3 h-3" />,
            defaultLabel: 'Live Status Active'
        },
        ELITE: {
            gradient: 'from-amber-500 to-orange-600',
            icon: <Crown className="w-3 h-3" />,
            defaultLabel: 'Elite Secured'
        }
    };

    const { gradient, icon, defaultLabel } = config[tier];

    return (
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r ${gradient} text-white text-xs font-semibold shadow-sm`}>
            {icon}
            <span>{label || defaultLabel}</span>
        </div>
    );
}
