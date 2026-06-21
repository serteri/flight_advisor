import { PricingFeatures } from '@/components/marketing/PricingFeatures';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';

export default async function FeaturesPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations('PricingFeaturesPage');
    return (
        <div className="min-h-screen bg-white">
            {/* Navigation */}
            <div className="border-b border-slate-200 bg-slate-50 sticky top-0 z-40">
                <div className="container mx-auto px-4 md:px-6 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
                    <Link href={`/${locale}/pricing`}>
                        <Button variant="outline" className="rounded-lg">
                            ← {t('backToPricing')}
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Features Comparison */}
            <PricingFeatures />

            {/* CTA Section */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-16">
                <div className="container mx-auto px-4 md:px-6 text-center">
                    <h2 className="text-3xl font-bold mb-4">
                        {t('ctaTitle')}
                    </h2>
                    <p className="text-emerald-100 mb-6 max-w-2xl mx-auto">
                        {t('ctaDesc')}
                    </p>
                    <Link href={`/${locale}/pricing`}>
                        <Button className="bg-white text-emerald-600 hover:bg-emerald-50 font-bold px-8 py-3 rounded-lg">
                            {t('viewPricingPlans')}
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
