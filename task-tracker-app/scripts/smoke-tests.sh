#!/bin/bash
set -e

BASE_URL="https://projects.sapcindia.com"

echo "🧪 Running smoke tests..."

# Test login page
echo ""
echo "1. Testing login page..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/login")
if [ "$STATUS" != "200" ]; then
  echo "❌ Login page failed: HTTP $STATUS"
  exit 1
fi
echo "✅ Login page accessible (HTTP $STATUS)"

# Test root page
echo ""
echo "2. Testing root page..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
if [ "$STATUS" != "200" ]; then
  echo "❌ Root page failed: HTTP $STATUS"
  exit 1
fi
echo "✅ Root page accessible (HTTP $STATUS)"

# Test API health endpoints
echo ""
echo "3. Testing service health endpoints..."
SERVICES=("auth" "project" "subproject" "metrics" "jobs" "structural-elements" "excel")
for SERVICE in "${SERVICES[@]}"; do
  echo "   Checking $SERVICE..."
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/$SERVICE/health" 2>/dev/null || echo "000")
  if [ "$STATUS" != "200" ]; then
    echo "   ❌ $SERVICE health check failed: HTTP $STATUS"
    exit 1
  fi
  echo "   ✅ $SERVICE healthy (HTTP $STATUS)"
done

# Test authentication (optional - only if credentials are available)
if [ -n "$TEST_USERNAME" ] && [ -n "$TEST_PASSWORD" ]; then
  echo ""
  echo "4. Testing authentication..."
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$TEST_USERNAME\",\"password\":\"$TEST_PASSWORD\"}")
  
  TOKEN=$(echo "$RESPONSE" | jq -r '.token' 2>/dev/null || echo "null")
  
  if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
    echo "❌ Authentication failed"
    echo "Response: $RESPONSE"
    exit 1
  fi
  echo "✅ Authentication working"
  
  # Test authenticated endpoint
  echo ""
  echo "5. Testing authenticated endpoint..."
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/projects" \
    -H "Authorization: Bearer $TOKEN")
  if [ "$STATUS" != "200" ]; then
    echo "❌ Authenticated request failed: HTTP $STATUS"
    exit 1
  fi
  echo "✅ Authenticated request successful (HTTP $STATUS)"
else
  echo ""
  echo "⚠️  Skipping authentication tests (TEST_USERNAME/TEST_PASSWORD not set)"
fi

# Test MongoDB connection (via any API endpoint)
echo ""
echo "6. Testing database connectivity..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/projects/health")
if [ "$STATUS" != "200" ]; then
  echo "❌ Database connectivity check failed: HTTP $STATUS"
  exit 1
fi
echo "✅ Database connectivity verified"

# Test Redis connection (via cache endpoint)
echo ""
echo "7. Testing Redis connectivity..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/metrics/health")
if [ "$STATUS" != "200" ]; then
  echo "❌ Redis connectivity check failed: HTTP $STATUS"
  exit 1
fi
echo "✅ Redis connectivity verified"

echo ""
echo "✅ All smoke tests passed"
echo ""
echo "Summary:"
echo "  ✅ Web pages accessible"
echo "  ✅ All microservices healthy"
if [ -n "$TEST_USERNAME" ]; then
  echo "  ✅ Authentication working"
fi
echo "  ✅ Database connected"
echo "  ✅ Cache connected"
