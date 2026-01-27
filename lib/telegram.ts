import TelegramBot from 'node-telegram-bot-api';
import type { Route } from '@prisma/client';
import type { AnalysisResult } from './anomalyDetector';

let bot: TelegramBot | null = null;

function getTelegramBot(): TelegramBot | null {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
        console.warn('[Telegram] TELEGRAM_BOT_TOKEN not set, bot disabled');
        return null;
    }

    if (!bot) {
        bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
            polling: false, // We only send messages, no polling
        });
    }

    return bot;
}

function formatAlertMessage(route: Route, analysis: AnalysisResult): string {
    const departureDate = route.startDate.toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const score = analysis.dealScore;
    // Note: analysis object currently comes from anomalyDetector. 
    // We should ideally pass the snapshot details here. 
    // For now, let's assume analysis might validly contain explanation.

    return `
🚨 *FLIGHT DEAL ALERT!*

✈️ ${route.originCode} → ${route.destinationCode}
📅 ${departureDate}
🎫 ${route.cabin}

💰 Price: *${analysis.currentPrice.toFixed(0)} TRY*
⭐ Quality Score: *${score}/10*
📉 Drop: *${analysis.dropPercent.toFixed(1)}%*

${analysis.explanation ? `💡 _${analysis.explanation}_` : ''}

_Check dashboard for verified details._
    `.trim();
}

export async function sendTelegramAlert(
    chatId: string,
    route: Route,
    analysis: AnalysisResult
): Promise<boolean> {
    const bot = getTelegramBot();

    if (!bot) {
        console.log('[Telegram] Bot not initialized, skipping alert');
        return false;
    }

    try {
        const message = formatAlertMessage(route, analysis);

        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
        });

        console.log(`[Telegram] Alert sent to ${chatId} for route ${route.originCode}→${route.destinationCode}`);

        return true;
    } catch (error) {
        console.error('[Telegram] Failed to send alert:', error);
        return false;
    }
}

export async function sendTelegramAlertToDefault(
    route: Route,
    analysis: AnalysisResult
): Promise<boolean> {
    const chatId = process.env.TELEGRAM_DEFAULT_CHAT_ID;

    if (!chatId) {
        console.warn('[Telegram] TELEGRAM_DEFAULT_CHAT_ID not set, cannot send alert');
        return false;
    }

    return sendTelegramAlert(chatId, route, analysis);
}
