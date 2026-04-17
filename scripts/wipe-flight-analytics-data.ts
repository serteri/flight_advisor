import { prisma } from '../lib/prisma';

async function main() {
  const [
    flightSearchRecord,
    searchAnalytics,
    routeInsight,
    flightSelectionEvent,
    searchHistory,
    userPreference,
  ] = await prisma.$transaction([
    prisma.flightSearchRecord.deleteMany({}),
    prisma.searchAnalytics.deleteMany({}),
    prisma.routeInsight.deleteMany({}),
    prisma.flightSelectionEvent.deleteMany({}),
    prisma.searchHistory.deleteMany({}),
    prisma.userPreference.deleteMany({}),
  ]);

  console.log(
    JSON.stringify(
      {
        wiped: {
          flightSearchRecord: flightSearchRecord.count,
          searchAnalytics: searchAnalytics.count,
          routeInsight: routeInsight.count,
          flightSelectionEvent: flightSelectionEvent.count,
          searchHistory: searchHistory.count,
          userPreference: userPreference.count,
        },
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error('[wipe-flight-analytics-data] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
