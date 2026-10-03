import { deliverEmail } from '@/lib/email/deliver';

// Claim PDF email. Provider selection, delivery policy and the legal footer
// are applied by deliverEmail.
export async function sendEmail(to: string, subject: string, attachment: Buffer, filename: string) {
    const result = await deliverEmail('claim-attachment', {
        to,
        subject,
        text: `Attachment included: ${filename}`,
        attachments: [{ filename, contentType: 'application/pdf', base64: attachment.toString('base64') }],
    });

    if (!result.success) {
        return { success: false, message: result.error ?? 'Unknown email send error' };
    }
    if (result.mocked) {
        return { success: true, message: 'Mocked outside production', id: 'mock-non-production' };
    }
    return { success: true, message: 'Email accepted by provider', id: result.messageId };
}
