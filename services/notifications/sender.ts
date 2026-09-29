
import { Resend } from 'resend';
import { getNotificationFromEmail } from '@/lib/config/runtimeEnv';

export async function sendEmail(to: string, subject: string, attachment: Buffer, filename: string) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.error(`[sendEmail] RESEND_API_KEY is missing — attachment email to ${to} not sent`);
        return { success: false, message: 'RESEND_API_KEY is missing' };
    }

    try {
        const resend = new Resend(apiKey);

        const response = await resend.emails.send({
            from: getNotificationFromEmail(),
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
            console.error(`[sendEmail] Resend rejected attachment email to ${to}: ${response.error.message}`);
            return { success: false, message: response.error.message };
        }

        return { success: true, message: 'Email accepted by Resend', id: response.data?.id };
    } catch (error: any) {
        const message = error?.message || 'Unknown email send error';
        console.error(`[sendEmail] Exception sending attachment email to ${to}: ${message}`);
        return { success: false, message };
    }
}
