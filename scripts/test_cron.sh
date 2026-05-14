#!/bin/bash
# Test Guardian Cron Endpoint using CRON_SECRET from local .env.

set -euo pipefail

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [ -z "${CRON_SECRET:-}" ]; then
  echo "CRON_SECRET is not set in .env"
  exit 1
fi

LOCAL_URL="${LOCAL_URL:-http://localhost:3000}"
TARGET_URL="${TARGET_URL:-$LOCAL_URL}"

echo "Testing Guardian Cron Endpoint..."
echo "Target: $TARGET_URL"
echo ""

echo "Testing GET /api/cron/guardian"
curl -X GET "$TARGET_URL/api/cron/guardian" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "User-Agent: Vercel" \
  -v

echo ""
echo ""

echo "Testing POST /api/cron/guardian"
curl -X POST "$TARGET_URL/api/cron/guardian" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "User-Agent: Vercel" \
  -H "Content-Type: application/json" \
  -v

echo ""
echo "Cron tests complete."
