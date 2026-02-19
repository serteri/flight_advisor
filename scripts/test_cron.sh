#!/bin/bash
# Test Guardian Cron Endpoint

CRON_SECRET="guardian_cron_secret_flight_ai_2026_kryptonite_xyz"
LOCAL_URL="http://localhost:3000"
PROD_URL="https://flightagent.io"  # Update with your actual domain

echo "🧪 Testing Guardian Cron Endpoint..."
echo ""

# Test GET request
echo "📤 Testing GET /api/cron/guardian"
curl -X GET "$LOCAL_URL/api/cron/guardian" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "User-Agent: Vercel" \
  -v

echo ""
echo ""

# Test POST request
echo "📤 Testing POST /api/cron/guardian"
curl -X POST "$LOCAL_URL/api/cron/guardian" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "User-Agent: Vercel" \
  -H "Content-Type: application/json" \
  -v

echo ""
echo "✅ Cron tests complete!"
