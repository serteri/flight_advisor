
import { Resend } from 'resend';

export async function sendEmail(to: string, subject: string, attachment: Buffer, filename: string) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        return { success: false, message: 'RESEND_API_KEY is missing' };
    }

    const resend = new Resend(apiKey);

    const response = await resend.emails.send({
        from: process.env.NOTIFICATION_FROM_EMAIL || 'onboarding@resend.dev',
        to,
        subject,
        text: `Attachment included: ${filename}`,
        attachments: [
            {
                filename,
                content: attachment.toString('base64'),
            },
        ],
    });

    if (response.error) {
        return { success: false, message: response.error.message };
    }

    return { success: true, message: 'Email accepted by Resend', id: response.data?.id };
}
