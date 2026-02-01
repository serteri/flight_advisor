import { getAmadeusClient } from '@/lib/amadeus';
import { prisma } from '@/lib/prisma';

export async function checkSeatComfort(segmentId: string) {
    const segment = await prisma.flightSegment.findUnique({ where: { id: segmentId } });
    if (!segment || !segment.userSeat) return; // Kullanıcı koltuk seçmemişse işlem yapma

    // Amadeus client instance
    const amadeus = getAmadeusClient();

    try {
        // 1. Amadeus'tan Güncel Haritayı Çek
        // NOT: Gerçek hayatta önce uçuşu arayıp 'offerId' bulmak gerekir.
        // MVP için search -> get map akışını simüle ediyoruz veya mock data kullanıyoruz.
        // getRealSeatMap helper'ını kullanacağız (lib/amadeus içinde yeni eklenen)

        // Şimdilik lib/amadeus'taki metodumuzun segment datasına ihtiyacı var
        const flightParams = {
            origin: segment.origin,
            destination: segment.destination,
            date: segment.departureDate.toISOString().split('T')[0],
            airlineCode: segment.airlineCode,
            flightNumber: segment.flightNumber
        };

        const seatMap = await amadeus.getRealSeatMap(flightParams);

        if (!seatMap) {
            console.log(`⚠️ SeatMap not found for ${segment.airlineCode}${segment.flightNumber}`);
            return;
        }

        const decks = seatMap.decks;
        if (!decks || decks.length === 0) return;

        // 2. Kullanıcının Sırasını Bul (Örn: "24A" -> Row 24)
        const userSeatRow = parseInt(segment.userSeat.replace(/\D/g, '')); // 24
        const userSeatLetter = segment.userSeat.replace(/[0-9]/g, ''); // A

        // O satırı bul
        // Not: Deck yapısı karmaşık olabilir, basitçe ilk deck'te arayalım
        const rowData = decks[0].seats.filter((s: any) => s.coordinates.y === userSeatRow);

        // 3. Yan Koltuk Analizi
        // Basit mantık: Eğer ben A isem, yanım B'dir.
        // B koltuğunu bul ve durumuna bak.
        const neighborLetter = getNeighborLetter(userSeatLetter); // A -> B, B -> A/C
        const neighborSeat = rowData.find((s: any) => s.coordinates.x === neighborLetter);

        if (neighborSeat && neighborSeat.travelerPricingStatus === 'OCCUPIED') {
            // 🚨 ALARM: YANIN DOLDU!
            // Spam check
            const existingAlert = await prisma.guardianAlert.findFirst({
                where: { tripId: segment.tripId, segmentId: segment.id, type: 'SEAT_SPY' }
            });

            if (!existingAlert) {
                await prisma.guardianAlert.create({
                    data: {
                        tripId: segment.tripId,
                        segmentId: segment.id,
                        type: 'SEAT_SPY',
                        severity: 'WARNING',
                        title: 'Konfor Uyarısı: Yanınız Doldu!',
                        message: `Seçtiğiniz ${segment.userSeat} koltuğunun yanına (${neighborLetter}) biri oturdu. Daha boş bir yere geçmek ister misiniz?`,
                        actionLabel: 'Koltuk Değiştir'
                    }
                });
                console.log(`🚨 Seat Spy alert created for segment ${segment.id}`);
            }
        }

    } catch (error) {
        console.error("Seat Spy Error:", error);
    }
}

// Yardımcı: Yan koltuğun harfini bul
function getNeighborLetter(seat: string) {
    const map: any = { 'A': 'B', 'B': 'A', 'C': 'B', 'D': 'E', 'E': 'D', 'F': 'E' };
    return map[seat] || 'B';
}
