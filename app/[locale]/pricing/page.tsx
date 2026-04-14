import { UnlockPricingPage } from '@/components/marketing/UnlockPricingPage';

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
    await params;

    return <UnlockPricingPage />;
}
