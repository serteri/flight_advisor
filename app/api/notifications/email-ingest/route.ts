import { NextRequest } from 'next/server';

import { POST as webhookEmailIngestPost } from '@/app/api/webhooks/email-ingest/route';

export async function POST(request: NextRequest) {
    return webhookEmailIngestPost(request);
}
