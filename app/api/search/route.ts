import { NextResponse } from 'next/server';
import { searchAllProviders } from '@/services/search/searchService';
import { HybridSearchParams } from '@/types/hybridFlight';

// Vercel Pro Ayarları
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get('origin');
    const destination = searchParams.get('destination');
    const date = searchParams.get('date');

    if (!origin || !destination || !date) {
        return NextResponse.json({ error: 'Eksik parametre' }, { status: 400 });
    }

    console.log(`🚀 YARIŞ BAŞLADI: ${origin} -> ${destination} [${date}]`);

    try {
        const searchParams: HybridSearchParams = {
            origin,
            destination,
            date,
            // Opsiyonel parametreler eklenebilir
        };

        const allFlights = await searchAllProviders(searchParams);

        if (allFlights.length === 0) {
            return NextResponse.json([], { status: 200 });
        }

        return NextResponse.json(allFlights);

    } catch (error) {
        console.error("🔥 GENEL ARAMA HATASI:", error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
}
