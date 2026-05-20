import { prisma } from '@/lib/prisma';

const DAY_MS = 24 * 60 * 60 * 1000;

function dateBeforeDays(days: number) {
  return new Date(Date.now() - days * DAY_MS);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const retention = {
    priceSnapshotsDays: 180,
    alertLogsDays: 90,
    searchHistoryDays: 30,
    flightSearchRecordDays: 30,
    searchAnalyticsDays: 60,
  };

  const thresholds = {
    priceSnapshots: dateBeforeDays(retention.priceSnapshotsDays),
    alertLogs: dateBeforeDays(retention.alertLogsDays),
    searchHistory: dateBeforeDays(retention.searchHistoryDays),
    flightSearchRecord: dateBeforeDays(retention.flightSearchRecordDays),
    searchAnalytics: dateBeforeDays(retention.searchAnalyticsDays),
  };

  const summary = await prisma.$transaction(async (tx) => {
    const counts = {
      flightOption: await tx.flightOption.count(),
      connectionCacheExpired: await tx.connectionCache.count({
        where: { expiresAt: { lt: new Date() } },
      }),
      priceSnapshotOld: await tx.priceSnapshot.count({
        where: { timestamp: { lt: thresholds.priceSnapshots } },
      }),
      alertLogOld: await tx.alertLog.count({
        where: { sentAt: { lt: thresholds.alertLogs } },
      }),
      searchHistoryOld: await tx.searchHistory.count({
        where: { createdAt: { lt: thresholds.searchHistory } },
      }),
      flightSearchRecordOld: await tx.flightSearchRecord.count({
        where: { createdAt: { lt: thresholds.flightSearchRecord } },
      }),
      searchAnalyticsOld: await tx.searchAnalytics.count({
        where: { searchTimestamp: { lt: thresholds.searchAnalytics } },
      }),
    };

    if (dryRun) {
      return { dryRun: true, counts };
    }

    const deleted = {
      flightOption: (await tx.flightOption.deleteMany({})).count,
      connectionCacheExpired: (await tx.connectionCache.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      })).count,
      priceSnapshotOld: (await tx.priceSnapshot.deleteMany({
        where: { timestamp: { lt: thresholds.priceSnapshots } },
      })).count,
      alertLogOld: (await tx.alertLog.deleteMany({
        where: { sentAt: { lt: thresholds.alertLogs } },
      })).count,
      searchHistoryOld: (await tx.searchHistory.deleteMany({
        where: { createdAt: { lt: thresholds.searchHistory } },
      })).count,
      flightSearchRecordOld: (await tx.flightSearchRecord.deleteMany({
        where: { createdAt: { lt: thresholds.flightSearchRecord } },
      })).count,
      searchAnalyticsOld: (await tx.searchAnalytics.deleteMany({
        where: { searchTimestamp: { lt: thresholds.searchAnalytics } },
      })).count,
    };

    return { dryRun: false, counts, deleted };
  });

  console.log('[cleanup_legacy_flight_data] Result:');
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error('[cleanup_legacy_flight_data] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
