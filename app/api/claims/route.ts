import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth/currentUser';

// Uploaded claim documents (passport/ticket) contain PII for an active legal
// process, so they're written outside /public — never directly served by
// the web server — and only referenced by path in ClaimRequest.documentPath.
const UPLOAD_ROOT = path.join(process.cwd(), 'private-uploads', 'claims');

export async function POST(req: Request) {
    const userId = await getCurrentUserId();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let formData: FormData;
    try {
        formData = await req.formData();
    } catch {
        return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
    }

    const tripId = String(formData.get('tripId') || '');
    const fullName = String(formData.get('fullName') || '').trim();
    const email = String(formData.get('email') || '').trim().toLowerCase();
    const consentGiven = formData.get('consentGiven') === 'true';
    const signatureDataUrl = formData.get('signatureDataUrl');
    const document = formData.get('document');

    if (!tripId || !fullName || !email) {
        return NextResponse.json({ error: 'tripId, fullName, and email are required' }, { status: 400 });
    }

    if (!consentGiven) {
        return NextResponse.json({ error: 'Legal authorization consent is required' }, { status: 400 });
    }

    const trip = await prisma.monitoredTrip.findUnique({ where: { id: tripId } });
    if (!trip || trip.userId !== userId) {
        return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    let documentPath: string | null = null;
    let documentName: string | null = null;

    if (document instanceof File && document.size > 0) {
        const tripUploadDir = path.join(UPLOAD_ROOT, tripId);
        await mkdir(tripUploadDir, { recursive: true });

        const safeExtension = path.extname(document.name).slice(0, 10);
        const storedFilename = `${randomUUID()}${safeExtension}`;
        const fullPath = path.join(tripUploadDir, storedFilename);

        const buffer = Buffer.from(await document.arrayBuffer());
        await writeFile(fullPath, buffer);

        documentPath = path.relative(process.cwd(), fullPath);
        documentName = document.name;
    }

    const claim = await prisma.claimRequest.create({
        data: {
            tripId,
            userId,
            fullName,
            email,
            documentPath,
            documentName,
            signatureDataUrl: typeof signatureDataUrl === 'string' ? signatureDataUrl : null,
            consentGiven,
        },
    });

    return NextResponse.json({ id: claim.id }, { status: 201 });
}
