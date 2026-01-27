import { NextResponse } from 'next/server';
import { generateClaimPDF } from '@/services/legal/pdfGenerator';
// import { sendEmailWithAttachment } from '@/services/notifications/sender'; // (Varsayımsal sender fonksiyonu)

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { tripId, iban } = body;

        // 1. Veritabanından Uçuş Bilgilerini Çek (Mock)
        // const trip = await prisma.monitoredTrip.findUnique(...)
        const tripData = {
            userName: "Serter User",
            pnr: "QLWZE",
            flightNumber: "TK1984",
            date: "12 Feb 2026",
            route: "Brisbane -> Istanbul",
            delayDuration: "3 hours 45 minutes",
            amount: "600 EUR",
            iban: iban || "TR12 3456 ...." // Kullanıcıdan alınmalı
        };

        // 2. ⚖️ PDF DİLEKÇESİNİ OLUŞTUR (Execution)
        const pdfBuffer = await generateClaimPDF(tripData);

        // 3. 📤 HAVAYOLUNA E-POSTA AT (Simülasyon)
        // Gerçek hayatta burası: claims@turkishairlines.com olur.
        // Şimdilik test için konsola basıyoruz veya kullanıcıya CC atıyoruz.
        console.log(`[ACTION] PDF Dilekçe Oluşturuldu (${pdfBuffer.byteLength} bytes).`);
        console.log(`[ACTION] Sending email to airline for PNR: ${tripData.pnr}...`);

        // await sendEmailWithAttachment(...) 

        // 4. Veritabanında durumu güncelle
        // await prisma.guardianAlert.update({ where: { ... }, data: { isActioned: true, status: 'SENT' }})

        return NextResponse.json({
            success: true,
            message: 'Claim sent successfully',
            pdfUrl: '/mock-claim.pdf' // İstersek kullanıcıya indirmesi için link döneriz
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, error: 'Failed to process claim' }, { status: 500 });
    }
}
