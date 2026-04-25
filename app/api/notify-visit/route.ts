import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as { company?: string | null; path?: string; timestamp?: number };
        const company = body.company || 'unknown';
        const path = body.path || '/';
        const timestamp = typeof body.timestamp === 'number' ? body.timestamp : Date.now();

        const time = new Date(timestamp).toLocaleString('en-AU', {
            timeZone: 'Australia/Sydney',
            dateStyle: 'medium',
            timeStyle: 'short',
        });

        await resend.emails.send({
            from: 'noreply@providershield.com.au',
            to: process.env.NOTIFY_EMAIL!,
            subject: `Visitor from ${company}`,
            text: `Company: ${company}\nPath: ${path}\nTime: ${time}`,
        });

        return NextResponse.json({ ok: true });
    } catch {
        // Never surface errors to caller — this is fire-and-forget
        return NextResponse.json({ ok: false });
    }
}
