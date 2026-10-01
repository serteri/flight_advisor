import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isClaimDocumentUploadEnabled } from '@/lib/featureFlags';

test('claim document upload is disabled by default', () => {
    const prev = process.env.CLAIM_DOCUMENT_UPLOAD_ENABLED;
    delete process.env.CLAIM_DOCUMENT_UPLOAD_ENABLED;
    try {
        assert.equal(isClaimDocumentUploadEnabled(), false);
        process.env.CLAIM_DOCUMENT_UPLOAD_ENABLED = '1';
        assert.equal(isClaimDocumentUploadEnabled(), false, 'only the literal "true" enables it');
        process.env.CLAIM_DOCUMENT_UPLOAD_ENABLED = 'true';
        assert.equal(isClaimDocumentUploadEnabled(), true);
    } finally {
        if (prev === undefined) delete process.env.CLAIM_DOCUMENT_UPLOAD_ENABLED;
        else process.env.CLAIM_DOCUMENT_UPLOAD_ENABLED = prev;
    }
});
