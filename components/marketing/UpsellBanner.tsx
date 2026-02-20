'use client';

import { Crown, Zap, TrendingUp, Shield, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { UserTier } from '@/lib/tierUtils';

interface UpsellBannerProps {
    userTier: UserTier;
    onDismiss?: () => void;
}

export function UpsellBanner({ userTier, onDismiss }: UpsellBannerProps) {
    const router = useRouter();
    const [dismissed, setDismissed] = useState(false);

    // Don't show for ELITE users
    if (userTier === 'ELITE' || dismissed) {
        return null;
    }

    const handleDismiss = () => {
        setDismissed(true);
        if (onDismiss) onDismiss();
    };

    const handleUpgrade = () => {
        router.push('/pricing');
    };

    // Different messaging for FREE vs PRO users
    const config = userTier === 'FREE' 
        ? {
            title: '🚀 Unlock Flight Guardian Intelligence',
            description: 'Get real-time disruption alerts, EU261 compensation tracking, and AI-powered flight analysis',
            targetTier: 'PRO',
            price: '$9.90/mo',
            gradient: 'from-blue-600 via-purple-600 to-indigo-600',
            features: [
                { icon: <Shield className="w-4 h-4" />, text: 'Live flight status & delay alerts' },
                { icon: <TrendingUp className="w-4 h-4" />, text: 'EU261 compensation calculator' },
                { icon: <Zap className="w-4 h-4" />, text: 'Detailed amenity & aircraft analysis' }
            ],
            cta: 'Upgrade to PRO'
        }
        : {
            title: '👑 Unlock Elite Powers',
            description: 'Get SMS alerts, priority support, and advanced disruption hunting with ELITE membership',
            targetTier: 'ELITE',
            price: '$19.90/mo',
            gradient: 'from-amber-500 via-orange-500 to-red-500',
            features: [
                { icon: <Crown className="w-4 h-4" />, text: 'SMS alerts for critical disruptions' },
                { icon: <Shield className="w-4 h-4" />, text: 'Priority customer support' },
                { icon: <Zap className="w-4 h-4" />, text: 'Advanced upgrade opportunity alerts' }
            ],
            cta: 'Upgrade to ELITE'
        };

    return (
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${config.gradient} p-6 shadow-xl mb-6`}>
            {/* Animated Background Pattern */}
            <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl animate-pulse" style={{ animationDuration: '3s' }} />
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s', animationDelay: '1s' }} />
            </div>

            {/* Dismiss Button */}
            <button
                onClick={handleDismiss}
                className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-10"
            >
                <X className="w-5 h-5" />
            </button>

            {/* Content */}
            <div className="relative z-10">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    {/* Left Side - Info */}
                    <div className="flex-1">
                        <h3 className="text-2xl font-bold text-white mb-2">
                            {config.title}
                        </h3>
                        <p className="text-white/90 text-sm mb-4 max-w-2xl">
                            {config.description}
                        </p>

                        {/* Features */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {config.features.map((feature, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-white/95">
                                    <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                                        {feature.icon}
                                    </div>
                                    <span className="text-sm font-medium">{feature.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Side - CTA */}
                    <div className="md:text-right">
                        <div className="inline-block mb-3">
                            <div className="text-white/80 text-xs uppercase tracking-wider mb-1">Starting at</div>
                            <div className="text-4xl font-black text-white">{config.price}</div>
                            <div className="text-white/70 text-xs">billed monthly</div>
                        </div>
                        <Button
                            onClick={handleUpgrade}
                            size="lg"
                            className="w-full md:w-auto bg-white hover:bg-gray-50 text-gray-900 font-bold shadow-lg hover:shadow-xl transition-all duration-300 px-8"
                        >
                            {config.cta}
                            {config.targetTier === 'ELITE' ? <Crown className="w-5 h-5 ml-2" /> : <Zap className="w-5 h-5 ml-2" />}
                        </Button>
                        <div className="text-white/60 text-xs mt-2">
                            14-day money-back guarantee
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Compact Upsell Card (for sidebar or smaller spaces)
 */
export function CompactUpsellCard({ userTier }: { userTier: UserTier }) {
    const router = useRouter();

    if (userTier === 'ELITE') return null;

    const config = userTier === 'FREE'
        ? {
            title: 'Upgrade to PRO',
            subtitle: 'Unlock real-time alerts',
            gradient: 'from-blue-500 to-purple-600',
            price: '$9.90',
            icon: <Zap className="w-6 h-6" />
        }
        : {
            title: 'Go ELITE',
            subtitle: 'Get SMS alerts & priority support',
            gradient: 'from-amber-500 to-orange-600',
            price: '$19.90',
            icon: <Crown className="w-6 h-6" />
        };

    return (
        <div onClick={() => router.push('/pricing')} className={`cursor-pointer rounded-xl bg-gradient-to-br ${config.gradient} p-4 text-white shadow-lg hover:shadow-xl transition-shadow`}>
            <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    {config.icon}
                </div>
                <div className="text-right">
                    <div className="text-2xl font-black">{config.price}</div>
                    <div className="text-xs opacity-80">/month</div>
                </div>
            </div>
            <h4 className="font-bold text-lg mb-1">{config.title}</h4>
            <p className="text-sm opacity-90 mb-3">{config.subtitle}</p>
            <Button size="sm" variant="secondary" className="w-full font-semibold">
                Learn More
            </Button>
        </div>
    );
}
