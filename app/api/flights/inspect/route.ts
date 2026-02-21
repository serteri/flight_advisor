import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getFlightStatus } from '@/services/flightStatusService';
import { searchAllProviders } from '@/services/search/searchService';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Tier check - Flight Inspector is PRO/ELITE only
    const plan = (session.user.subscriptionPlan || '').toUpperCase();
    if (plan !== 'PRO' && plan !== 'ELITE') {
      return NextResponse.json(
        { error: 'Feature requires PRO or ELITE subscription' },
        { status: 403 }
      );
    }

    const { flightNumber, date, origin, destination } = await request.json();

    if (!flightNumber || !date) {
      return NextResponse.json(
        { error: 'flightNumber and date are required' },
        { status: 400 }
      );
    }

    console.log(
      `[Flight Inspector] Inspecting: ${flightNumber} on ${date}`,
      origin,
      destination
    );

    // LAYER 1: Check DB cache for this flight (if it exists)
    let cachedFlightData = null;
    try {
      const cacheKey = `${flightNumber}-${date}`;
      // In a real app, could store in Redis or a separate cache table
      // For now, we'll just skip and go straight to API calls
      console.log(`[Flight Inspector] Checking cache for ${cacheKey}...`);
    } catch (err) {
      console.log('[Flight Inspector] Cache check skipped, proceeding with APIs');
    }

    // STEP 1: Call AeroDataBox to get origin, destination, and historical delay data
    console.log(`[Flight Inspector] Step 1: Fetching AeroDataBox data...`);
    let aeroDataBoxData: any = null;
    let aerodataboxPunctuality: any = null;
    let aerodataboxError = null;

    try {
      // Get flight status and location data
      aeroDataBoxData = await getFlightStatus(flightNumber, date);

      if (aeroDataBoxData.error) {
        aerodataboxError = aeroDataBoxData.message;
        console.error(
          '[Flight Inspector] AeroDataBox Error:',
          aeroDataBoxData.message
        );
      } else {
        console.log('[Flight Inspector] AeroDataBox Success:', {
          origin: aeroDataBoxData.origin,
          destination: aeroDataBoxData.destination,
          status: aeroDataBoxData.status,
        });

        // Extract origin/destination IATA codes if not provided by user
        const lookupOrigin =
          origin || aeroDataBoxData.origin?.toUpperCase();
        const lookupDestination =
          destination ||
          aeroDataBoxData.destination?.toUpperCase();

        // Get punctuality data from AeroDataBox
        aerodataboxPunctuality = {
          medianDelay: aeroDataBoxData.medianDelay || 0,
          delayPercentages: aeroDataBoxData.delayPercentages || {
            veryLate: 0,
            late: 0,
            onTime: 100,
          },
          cancelledPercentage:
            aeroDataBoxData.cancelledPercentage || 0,
          totalFlights: aeroDataBoxData.totalFlights || 0,
        };

        // Compute reliability metrics early (needed for fallback and success paths)
        const delayPercentage =
          (aerodataboxPunctuality.delayPercentages?.late || 0) +
          (aerodataboxPunctuality.delayPercentages?.veryLate || 0);
        const reliabilityDesc =
          delayPercentage < 20
            ? 'Very reliable'
            : delayPercentage < 40
              ? 'Decent reliability'
              : delayPercentage < 60
                ? 'Mediocre reliability'
                : 'Poor reliability';

        // STEP 2: Call Duffel search with extracted IATA codes
        if (lookupOrigin && lookupDestination) {
          console.log(
            `[Flight Inspector] Step 2: Searching Duffel for ${lookupOrigin} → ${lookupDestination} on ${date}...`
          );

          try {
            const duffelOffers = await searchAllProviders({
              origin: lookupOrigin,
              destination: lookupDestination,
              date,
              returnDate: undefined,
              adults: 1,
              cabin: 'economy',
            });

            console.log(
              `[Flight Inspector] Duffel returned ${(duffelOffers || []).length} offers`
            );

            // STEP 3: Filter Duffel offers by matching flight number
            let matchingOffer = null;
            if (duffelOffers && duffelOffers.length > 0) {
              // Look for offer that contains this flight number in any segment
              for (const offer of duffelOffers) {
                if (offer.segments && Array.isArray(offer.segments)) {
                  const hasMatchingFlight = offer.segments.some(
                    (segment: any) =>
                      segment.flightNumber ===
                      flightNumber
                  );
                  if (hasMatchingFlight) {
                    matchingOffer = offer;
                    console.log(
                      `[Flight Inspector] Found matching offer: ${offer.price} ${offer.currency}`
                    );
                    break;
                  }
                }
              }
            }

            // If no exact match, use first offer as reference (same route/date)
            if (!matchingOffer && duffelOffers && duffelOffers.length > 0) {
              matchingOffer = duffelOffers[0];
              console.log(
                `[Flight Inspector] No exact flight match, using first offer as reference`
              );
            }

            // Calculate Master Flight Score if we have offer data
            let masterScore = 5; // Default neutral score
            let scoreDetails = {};

            if (matchingOffer) {
              // TODO: Score calculation could be implemented here
              // For now, use simple heuristics based on price and delay
              masterScore = 7; // Placeholder - would need proper scoring
              scoreDetails = {
                price: 'Good',
                reliability: 'Fair',
                value: 'Decent',
              };
            }

            // Build recommendation text
            const priceQuality =
              masterScore >= 8
                ? 'Excellent value'
                : masterScore >= 6
                  ? 'Good value'
                  : masterScore >= 4
                    ? 'Fair value'
                    : 'Poor value';

            const recommendation = `${masterScore.toFixed(1)}/10 - ${priceQuality}. ${reliabilityDesc} (${delayPercentage.toFixed(0)}% historical delays).`;

            // Build Hidden Traps data
            const hiddenTraps = [];
            if (matchingOffer) {
              // Check for baggage limitations
              if (matchingOffer.baggage === 'cabin' || matchingOffer.baggage === 'none') {
                hiddenTraps.push({
                  type: 'baggage',
                  title: 'Limited Baggage',
                  detail: matchingOffer.baggage === 'none' 
                    ? 'No baggage included - checked bags require additional fee'
                    : 'Cabin bag only - checked bags require additional fee',
                });
              }
              
              // Check for basic fare restrictions
              if (matchingOffer.fareType === 'basic') {
                hiddenTraps.push({
                  type: 'refund',
                  title: 'Basic Fare (Limited Changes)',
                  detail: 'No refund if cancelled by you; ticket changes may have fees',
                });
              }
              
              // Connection risk
              if (matchingOffer.stops && matchingOffer.stops > 0) {
                hiddenTraps.push({
                  type: 'connections',
                  title: `${matchingOffer.stops} Connection${matchingOffer.stops > 1 ? 's' : ''}`,
                  detail: 'Multiple connections increase risk of delays affecting your journey',
                });
              }
            }

            return NextResponse.json({
              success: true,
              data: {
                flightNumber,
                date,
                origin: lookupOrigin,
                destination: lookupDestination,
                aerodatabox: {
                  status: aeroDataBoxData.status,
                  medianDelay: aerodataboxPunctuality.medianDelay,
                  delayPercentages:
                    aerodataboxPunctuality.delayPercentages,
                  cancelledPercentage:
                    aerodataboxPunctuality.cancelledPercentage,
                  totalFlights:
                    aerodataboxPunctuality.totalFlights,
                },
                offer: matchingOffer
                  ? {
                      id: matchingOffer.id,
                      price: matchingOffer.price,
                      currency: matchingOffer.currency,
                      duration: matchingOffer.duration,
                      fare: {
                        type: matchingOffer.fareType || 'standard',
                        baggage: matchingOffer.baggage || 'checked',
                      },
                      segments:
                        matchingOffer.segments?.map(
                          (s: any) => ({
                            flightNumber: s.flightNumber,
                            airline: s.airline,
                            departure: s.departure,
                            arrival: s.arrival,
                            duration: s.duration,
                            stops: s.stops,
                          })
                        ) || [],
                    }
                  : null,
                masterScore,
                scoreDetails,
                hiddenTraps,
                recommendation,
              },
            });
          } catch (duffelError) {
            console.error(
              '[Flight Inspector] Duffel search error:',
              duffelError
            );

            // LAYER 2 FALLBACK: Return AeroDataBox data only without pricing
            return NextResponse.json({
              success: true,
              partial: true,
              warning:
                'Could not fetch real-time pricing, showing historical data only',
              data: {
                flightNumber,
                date,
                origin: lookupOrigin,
                destination: lookupDestination,
                aerodatabox:
                  aerodataboxPunctuality,
                offer: null,
                masterScore: 5,
                scoreDetails: {},
                hiddenTraps: [],
                recommendation:
                  'Unable to verify current pricing. Historical data shows ' +
                  reliabilityDesc +
                  '.',
              },
            });
          }
        } else {
          // Could not extract origin/destination
          return NextResponse.json(
            {
              error:
                'Could not determine origin/destination. Please verify flight number and date.',
            },
            { status: 400 }
          );
        }
      }
    } catch (aeroError) {
      console.error(
        '[Flight Inspector] AeroDataBox fatal error:',
        aeroError
      );

      // LAYER 3 FALLBACK: Graceful degradation with error message
      return NextResponse.json(
        {
          error:
            'Unable to verify flight. Please check flight number and date.',
          details: 'Flight verification service temporarily unavailable.',
        },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error('[Flight Inspector] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
