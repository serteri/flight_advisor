import PDFDocument from 'pdfkit';

interface ClaimData {
    userName: string;
    pnr: string;
    flightNumber: string;
    date: string;
    route: string;
    delayDuration: string; // "3 hours 10 minutes"
    amount: string; // "600 EUR"
    iban: string; // Kullanıcının parayı isteyeceği yer
}

export function generateClaimPDF(data: ClaimData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on('data', (buffer) => buffers.push(buffer));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // --- 1. BAŞLIK (Resmiyet Hissi) ---
        doc.fontSize(20).font('Helvetica-Bold').text('FORMAL NOTICE OF CLAIM', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).font('Helvetica').text('Regulation (EC) No 261/2004', { align: 'center' });
        doc.moveDown(2);

        // --- 2. TARAF BİLGİLERİ ---
        doc.fontSize(10).font('Helvetica-Bold').text(`TO: Legal Department / Customer Claims`);
        doc.font('Helvetica').text(`Airline Operations Center`);
        doc.moveDown();

        doc.font('Helvetica-Bold').text(`FROM: ${data.userName}`);
        doc.font('Helvetica').text(`Represented by: Travel Guardian Legal Tech`);
        doc.moveDown(2);

        // --- 3. OLAYIN ÖZETİ ---
        doc.fontSize(12).font('Helvetica-Bold').text('SUBJECT: Demand for Compensation under Article 7', { underline: true });
        doc.moveDown();

        doc.font('Helvetica').text(`Dear Sir/Madam,`);
        doc.moveDown();
        doc.text(`I am writing to you regarding flight ${data.flightNumber} from ${data.route} on ${data.date}. The booking reference (PNR) is ${data.pnr}.`);
        doc.moveDown();
        doc.text(`This flight arrived at its final destination with a delay of ${data.delayDuration}. This delay was not caused by extraordinary circumstances.`);
        doc.moveDown();

        // --- 4. HUKUKİ DAYANAK (Can Alıcı Nokta) ---
        doc.font('Helvetica-Bold').text('Legal Basis:');
        doc.font('Helvetica').text(`According to the judgment of the European Court of Justice (Sturgeon v Condor, C-402/07), passengers whose flights are delayed by 3 hours or more are entitled to compensation as defined in Article 7 of Regulation (EC) No 261/2004.`);
        doc.moveDown();

        // --- 5. TALEP ---
        doc.fontSize(14).font('Helvetica-Bold').text(`PAYMENT DEMAND: ${data.amount}`);
        doc.moveDown();
        doc.fontSize(10).font('Helvetica').text(`I hereby request immediate payment of the above amount to the following bank account within 14 days:`);
        doc.moveDown();

        doc.font('Helvetica-Bold').text(`IBAN: ${data.iban}`);
        doc.text(`Account Holder: ${data.userName}`);
        doc.moveDown(2);

        // --- 6. İMZA ---
        doc.font('Helvetica').text('Sincerely,');
        doc.moveDown();
        doc.font('Helvetica-Bold').text(data.userName);
        doc.text('(Digitally generated via Travel Guardian)');

        doc.end();
    });
}
