
export async function sendEmail(to: string, subject: string, attachment: Buffer, filename: string) {
    console.log(`\n--- [MOCK EMAIL SERVICE] ---`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Attachment: ${filename} (${(attachment.length / 1024).toFixed(2)} KB)`);
    console.log(`Sending...`);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    console.log(`[SUCCESS] Email sent to ${to}`);
    console.log(`----------------------------\n`);

    return { success: true, message: 'Email queued for delivery' };
}
