// scripts/test_notification.ts
import { NotificationDispatcher } from '../services/notifications/dispatcher';
import { UserPreferences, NotificationPayload } from '../services/notifications/types';

// Mock Users
const freeUser: UserPreferences = {
    tier: 'FREE',
    tone: 'STANDARD',
    channels: { email: true, sms: false, push: true, telegram: false },
    contact: { email: 'free@user.com', phone: '+905550000001' }
};

const eliteUser: UserPreferences = {
    tier: 'ELITE',
    tone: 'STANDARD',
    channels: { email: true, sms: true, push: true, telegram: true },
    contact: { email: 'vip@ceo.com', phone: '+905559999999' }
};

const juniorFamily: UserPreferences = {
    tier: 'PRO',
    tone: 'JUNIOR_GUARDIAN', // Çocuk Modu Açık! 🧸
    channels: { email: true, sms: false, push: true, telegram: false },
    contact: { email: 'mom@family.com', phone: '+905551234567' }
};

async function runTest() {
    const dispatcher = NotificationDispatcher.getInstance();

    console.log("--- TEST 1: FREE USER (Critical Alert) ---");
    // Beklenti: Sadece Email gitmeli. SMS gitmemeli (Hakkı yok).
    await dispatcher.dispatch(freeUser, {
        userId: 'u1',
        type: 'DISRUPTION',
        title: 'Flight Cancelled',
        message: 'Original message will be replaced by template',
        priority: 'CRITICAL',
        data: { flightNumber: 'TK1920', amount: '600€' }
    });

    console.log("\n--- TEST 2: ELITE USER (Critical Alert) ---");
    // Beklenti: SMS + Email gitmeli. (Uykudan uyandır!)
    await dispatcher.dispatch(eliteUser, {
        userId: 'u2',
        type: 'DISRUPTION',
        title: 'Flight Cancelled',
        message: 'Original message',
        priority: 'CRITICAL',
        data: { flightNumber: 'QR555', amount: '600€' }
    });

    console.log("\n--- TEST 3: JUNIOR FAMILY (Gate Change) ---");
    // Beklenti: Eğlenceli "Saklambaç" mesajı gitmeli.
    await dispatcher.dispatch(juniorFamily, {
        userId: 'u3',
        type: 'GATE_CHANGE',
        title: 'Gate Changed',
        message: 'Gate changed to B12',
        priority: 'WARNING',
        data: { flightNumber: 'LH123', gate: 'B12' }
    });
}

runTest();
