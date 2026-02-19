import { PricingFeatures } from '@/components/marketing/PricingFeatures';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function FeaturesPage() {
    return (
        <div className="min-h-screen bg-white">
            {/* Navigation */}
            <div className="border-b border-slate-200 bg-slate-50 sticky top-0 z-40">
                <div className="container mx-auto px-4 md:px-6 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-slate-900">Feature Comparison</h1>
                    <Link href="/pricing">
                        <Button variant="outline" className="rounded-lg">
                            ← Back to Pricing
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
                        Ready to get started?
                    </h2>
                    <p className="text-emerald-100 mb-6 max-w-2xl mx-auto">
                        Choose the plan that suits your travel protection needs.
                    </p>
                    <Link href="/pricing">
                        <Button className="bg-white text-emerald-600 hover:bg-emerald-50 font-bold px-8 py-3 rounded-lg">
                            View Pricing Plans
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
