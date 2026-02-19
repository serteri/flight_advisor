import { PricingTable } from '@/components/marketing/PricingTable';
import { PricingFeatures } from '@/components/marketing/PricingFeatures';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function PricingPage() {
    return (
        <div className="min-h-screen bg-white">
            {/* Navigation */}
            <div className="border-b border-slate-200 bg-slate-50 sticky top-0 z-40">
                <div className="container mx-auto px-4 md:px-6 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-slate-900">Pricing Plans</h1>
                    <Link href="/">
                        <Button variant="outline" className="rounded-lg">
                            ← Back Home
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Pricing Cards */}
            <PricingTable />

            {/* Features Comparison Table */}
            <PricingFeatures />

            {/* CTA Section */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-16">
                <div className="container mx-auto px-4 md:px-6 text-center">
                    <h2 className="text-3xl font-bold mb-4">
                        Still have questions?
                    </h2>
                    <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
                        Our support team is ready to help you choose the right plan.
                    </p>
                    <Link href="/contact">
                        <Button className="bg-white text-blue-600 hover:bg-blue-50 font-bold px-8 py-3 rounded-lg">
                            Contact Support
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
