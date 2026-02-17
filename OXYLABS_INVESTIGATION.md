/*
OXYLABS INVESTIGATION
======================

Sources tested:
✅ google_search - Works but returns web results, not flight prices
❌ google_flights - NOT SUPPORTED on this account ("Unsupported source")

Issue: We can't scrape Google Flights data for actual pricing via Oxylabs.

ALTERNATIVES:
=============

1. **Kiwi.com API** (Recommended)
   - Free tier available
   - Real flight prices
   - Good coverage worldwide
   - Rate limits: 10 requests/second

2. **Flixbus/Rome2Rio API**
   - Multi-modal search
   - Flight + train + bus

3. **Kayak/Momondo APIs**
   - Limited public API
   - Mostly through affiliate programs

4. **SkyScanner API**
   - Paid API
   - Very comprehensive

5. **Stick with Duffel + add another source**
   - Duffel is working (155+ flights)
   - Add Kiwi.com as secondary source
   - Or add Amadeus test account

RECOMMENDATION: 
Replace Oxylabs with Kiwi.com API - it's free, has good coverage, and provides actual flight data.
*/
