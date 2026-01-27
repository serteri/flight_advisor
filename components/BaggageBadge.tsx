/**
 * BaggageBadge Component
 * 
 * Bagaj durumunu görsel olarak gösteren rozet bileşeni.
 * Scoring Engine'den gelen bagaj bilgilerini kullanıcı dostu şekilde gösterir.
 */

import React from 'react';
import { useTranslations } from 'next-intl';

interface BaggageBadgeProps {
    baggage?: {
        quantity: number;
        weight?: number;
        unit: 'PC' | 'KG';
    };
    // Eski format desteği
    baggageIncluded?: boolean;
    baggageWeight?: number;
    baggageQuantity?: number;
    cabinBagOnly?: boolean;
    // Kısa versiyon için
    compact?: boolean;
}

export function BaggageBadge({
    baggage,
    baggageIncluded,
    baggageWeight,
    baggageQuantity,
    cabinBagOnly,
    compact = false
}: BaggageBadgeProps) {
    const t = useTranslations('FlightSearch.baggageExtras');

    // Bagaj ağırlığını hesapla
    let weight = 0;

    if (baggage) {
        if (baggage.unit === 'KG') {
            weight = baggage.weight || baggage.quantity;
        } else {
            weight = baggage.quantity * 23;
        }
    } else if (baggageIncluded) {
        if (baggageWeight) {
            weight = baggageWeight;
        } else if (baggageQuantity) {
            weight = baggageQuantity * 23;
        } else {
            weight = 23;
        }
    } else if (cabinBagOnly) {
        weight = 0;
    }

    // HİÇ bagaj yoksa
    if (weight === 0) {
        return (
            <span
                className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded text-xs font-bold border border-red-200"
                title={t('warningDesc')}
            >
                <span>🚫</span>
                {compact ? t('noBaggage') : t('excluded')}
            </span>
        );
    }

    // AZ bagaj (20kg altı)
    if (weight < 20) {
        return (
            <span
                className="inline-flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded text-xs font-medium border border-amber-200"
                title={`Limited baggage: ${weight}kg`}
            >
                <span>🧳</span>
                {weight}kg
                {!compact && <span className="text-amber-500">{t('restricted')}</span>}
            </span>
        );
    }

    // BOL bagaj (30kg ve üzeri)
    if (weight >= 30) {
        return (
            <span
                className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-1 rounded text-xs font-bold border border-green-200"
                title={`Generous: ${weight}kg`}
            >
                <span>🧳</span>
                {weight}kg
                {!compact && <span className="text-green-600">{t('generous')}</span>}
            </span>
        );
    }

    // STANDART bagaj (20-29kg)
    return (
        <span
            className="inline-flex items-center gap-1 text-gray-600 bg-gray-50 px-2 py-1 rounded text-xs border border-gray-200"
            title={`Standard: ${weight}kg`}
        >
            <span>🧳</span>
            {weight}kg
        </span>
    );
}

/**
 * BaggageWarning Component
 * 
 * Bagajsız uçuşlar için uyarı banner'ı
 */
interface BaggageWarningProps {
    weight: number;
}

export function BaggageWarning({ weight }: BaggageWarningProps) {
    const t = useTranslations('FlightSearch.baggageExtras');
    if (weight > 0) return null;

    return (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
            <span className="text-amber-500 text-lg">⚠️</span>
            <div>
                <p className="font-medium text-amber-800">{t('warningTitle')}</p>
                <p className="text-amber-700 text-xs mt-1">
                    {t('warningDesc')}
                </p>
            </div>
        </div>
    );
}

export default BaggageBadge;
