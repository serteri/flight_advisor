'use client';

import { Lock, Sparkles, Zap, Crown } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
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
    const pathname = usePathname();
    const locale = pathname?.split('/')[1] || 'en';

    const handleUpgrade = () => {
        if (onClick) {
            onClick();
        } else {
            router.push(`/${locale}/pricing`);
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
            className={`absolute inset-0 z-30 flex items-center justify-center backdrop-blur-sm bg-slate-950/70 ${className}`}
        >
            <div className="relative text-center space-y-4 text-white drop-shadow-md">
                {/* Icon - CENTERED, MINIMAL */}
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/20 text-white">
                    <Lock className="w-7 h-7" />
                </div>

                {/* Title */}
                <h3 className="text-lg font-bold text-white">
                    Premium Feature
                </h3>

                {/* Simple Description */}
                <p className="text-sm text-white/80 max-w-xs">
                    Upgrade to {requiredTier} for advanced analytics
                </p>

                {/* CTA Button - Simple, Clean */}
                <Button
                    onClick={handleUpgrade}
                    className={`bg-gradient-to-r ${config.gradient} hover:opacity-90 text-white font-semibold px-6 py-2 rounded-lg shadow-lg transition-all mt-4`}
                >
                    Upgrade Now
                </Button>
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
