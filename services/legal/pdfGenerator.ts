import PDFDocument from 'pdfkit';
import type { CompensationRegime } from '@/lib/compensation/engine';
import { NOT_LEGAL_ADVICE, regulationReference } from '@/lib/compensation/claimLetter';

interface ClaimData {
    userName: string;
    pnr: string;
    flightNumber: string;
    date: string;
    route: string;
    delayDuration: string; // "3 hours 10 minutes"
    amount: string; // "600 EUR" — from the compensation engine only
    regime: CompensationRegime;
    iban: string; // Kullanıcının parayı isteyeceği yer
}

// The passenger writes this request themselves. Wording stays non-definitive:
// no representation claim and no assertion about extraordinary circumstances,
// which cannot be established from flight data.
export function generateClaimPDF(data: ClaimData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on('data', (buffer) => buffers.push(buffer));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // --- 1. BAŞLIK ---
        doc.fontSize(20).font('Helvetica-Bold').text('Request for Compensation Review', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).font('Helvetica').text(regulationReference(data.regime), { align: 'center' });
        doc.moveDown(2);

        // --- 2. TARAF BİLGİLERİ ---
        doc.fontSize(10).font('Helvetica-Bold').text('TO: Customer Relations / Claims');
        doc.moveDown();
        doc.font('Helvetica-Bold').text(`FROM: ${data.userName}`);
        doc.moveDown(2);

        // --- 3. OLAYIN ÖZETİ ---
        doc.fontSize(12).font('Helvetica-Bold').text('SUBJECT: Possible compensation under Article 7', { underline: true });
        doc.moveDown();

        doc.font('Helvetica').text('Dear Sir/Madam,');
        doc.moveDown();
        doc.text(`I am writing regarding flight ${data.flightNumber} from ${data.route} on ${data.date}. The booking reference (PNR) is ${data.pnr}.`);
        doc.moveDown();
        doc.text(`According to the information currently available, this flight arrived at its final destination with a delay of about ${data.delayDuration}.`);
        doc.moveDown();
        doc.text(`Based on this information I believe I may be entitled to compensation of ${data.amount}. If you consider that extraordinary circumstances apply, please tell me which circumstances you rely on and provide the supporting evidence.`);
        doc.moveDown();

        // --- 4. ÖDEME BİLGİSİ ---
        doc.text('If you accept the request, please pay the amount to the following account:');
        doc.moveDown();
        doc.font('Helvetica-Bold').text(`IBAN: ${data.iban}`);
        doc.text(`Account Holder: ${data.userName}`);
        doc.moveDown();
        doc.font('Helvetica').text('I would be grateful for a written response within 14 days.');
        doc.moveDown(2);

        // --- 5. İMZA ---
        doc.text('Yours faithfully,');
        doc.moveDown();
        doc.font('Helvetica-Bold').text(data.userName);
        doc.moveDown(2);
        doc.fontSize(8).font('Helvetica').fillColor('#555555').text(NOT_LEGAL_ADVICE);

        doc.end();
    });
}
